#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADAPTERS,
  MODES,
  buildRoster,
  readManifest,
  resolveGameIdentity,
  resolvePlayerCount,
} from "./lib/qa-chaos-topology.mjs";
import {
  assertReachable,
  createRoom,
  detectAutoplayedPlayers,
  extractActionCount,
  extractCursor,
  extractJoinedPlayerCount,
  fingerprintPoll,
  isGameOverPoll,
  joinRoom,
  normalizeBaseUrl,
  pollRoom,
  startRoom,
} from "./lib/qa-chaos-rest-client.mjs";
import {
  WorkerRuntime,
  commandForAdapter,
  formatCommandLine,
  isWorkerSpawnFailureExit,
  prepareWorkerArtifacts,
  renderWorkerPrompt,
  resolveCommandSpecForSpawn,
  startAfterRestWorkersReady,
  stopWorkerRuntimes,
  workerSpawnFailureEvidence,
} from "./lib/qa-chaos-workers.mjs";
import {
  countWorkerActionSubmissions,
  observedActionCount,
} from "./lib/qa-chaos-action-budget.mjs";
import {
  createSweepLayout,
  createRunLayout,
  ensureReportDirs,
  makeFailure,
  timestampForPath,
  writeSweepReports,
  writeReports,
  writeRunJson,
} from "./lib/qa-chaos-reporting.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const promptTemplatePath = path.join(__dirname, "qa-chaos-rest-prompt.md");
const browserPromptTemplatePath = path.join(__dirname, "qa-chaos-browser-prompt.md");

const DEFAULTS = {
  adapter: "claude",
  runs: 1,
  base: "http://localhost:3000",
  mode: "smoke",
  maxActions: 300,
  maxMinutes: 20,
  pollTimeoutMs: 5000,
  stallMs: 90000,
  pollIntervalMs: 2000,
  workerBootMs: 120000,
  workerTrust: "scoped",
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed.help) {
    usage();
    return;
  }
  const config = resolveConfig(parsed);
  if (config.dryRun) {
    if (config.sweep) printSweepDryRun(config);
    else printDryRun(config);
    return;
  }
  if (config.sweep) await runSweep(config);
  else await runAll(config);
}

function usage() {
  console.log(
    [
      "Usage: node scripts/qa-chaos.mjs <game-dir> [options]",
      "       node scripts/qa-chaos.mjs --all [options]",
      "",
      "Options:",
      "  --adapter NAME          claude|codex|mixed (default: claude)",
      "  --players N             Player count (default: manifest.minPlayers)",
      "  --browser               Replace one REST player seat with UI-1 browser worker",
      "  --all                   Run every top-level game directory with manifest.json",
      "  --runs N                Independent room runs (default: 1)",
      "  --base URL              Host base URL (default: http://localhost:3000)",
      "  --mode MODE             smoke|full|weird (default: smoke)",
      "  --max-actions N         Total submitted action budget (default: 300)",
      "  --max-minutes N         Wall-clock budget per run (default: 20)",
      "  --stall-ms N            No-progress stall threshold (default: 90000)",
      "  --poll-timeout-ms N     Host poll timeout (default: 5000)",
      "  --worker-boot-ms N      Wait for REST worker poll liveness before /start (default: 120000)",
      "  --worker-trust MODE     scoped|full, full adds dangerous worker permission bypass (default: scoped)",
      "  --out-dir DIR           Artifact root (default: e2e-runs)",
      "  --dry-run               Print topology, commands, budgets, and render worker artifacts; spawn nothing",
      "  --help                  Show this help",
    ].join("\n"),
  );
}

function parseCli(argv) {
  const options = new Map();
  const flags = new Set();
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      flags.add("help");
      continue;
    }
    if (arg === "--dry-run") {
      flags.add("dry-run");
      continue;
    }
    if (arg === "--all") {
      flags.add("all");
      continue;
    }
    if (arg === "--browser") {
      flags.add("browser");
      continue;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const equalsIndex = arg.indexOf("=");
    const name = equalsIndex === -1 ? arg.slice(2) : arg.slice(2, equalsIndex);
    if (!knownValueOptions().has(name)) {
      throw new Error(`Unknown option ${arg}`);
    }
    const value = equalsIndex === -1 ? argv[index + 1] : arg.slice(equalsIndex + 1);
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }
    options.set(name, value);
    if (equalsIndex === -1) index += 1;
  }
  return {
    help: flags.has("help"),
    dryRun: flags.has("dry-run"),
    all: flags.has("all"),
    browser: flags.has("browser"),
    positionals,
    options,
  };
}

function resolveConfig(parsed) {
  const timestamp = timestampForPath();
  const outDir = path.resolve(
    process.cwd(),
    stringOption(parsed, "out-dir", "e2e-runs"),
  );
  if (parsed.all) {
    if (parsed.positionals.length !== 0) {
      throw new Error("--all does not accept a <game-dir>. Use --help for usage.");
    }
    const games = listCatalogGameDirs(process.cwd()).map((gameDir) =>
      resolveGameConfig(parsed, gameDir, { outDir, timestamp }),
    );
    if (games.length === 0) {
      throw new Error("No top-level game directories with manifest.json were found.");
    }
    return {
      sweep: true,
      dryRun: parsed.dryRun,
      outDir,
      timestamp,
      sweepDir: createSweepLayout({ outDir, timestamp }),
      games,
    };
  }

  if (parsed.positionals.length !== 1) {
    throw new Error("Expected exactly one <game-dir>, or --all. Use --help for usage.");
  }
  return resolveGameConfig(parsed, path.resolve(process.cwd(), parsed.positionals[0]), {
    outDir,
    timestamp,
  });
}

function resolveGameConfig(parsed, gameDir, { outDir, timestamp }) {
  if (!existsSync(path.join(gameDir, "manifest.json"))) {
    throw new Error(`Missing manifest.json in ${gameDir}`);
  }

  const manifest = readManifest(gameDir);
  const gameId = resolveGameIdentity(manifest, gameDir);
  const adapter = stringOption(parsed, "adapter", DEFAULTS.adapter);
  if (!ADAPTERS.has(adapter)) {
    throw new Error(`Unsupported --adapter ${adapter}; expected claude, codex, or mixed`);
  }
  const mode = stringOption(parsed, "mode", DEFAULTS.mode);
  if (!MODES.has(mode)) {
    throw new Error(`Unsupported --mode ${mode}; expected smoke, full, or weird`);
  }
  const workerTrust = stringOption(parsed, "worker-trust", DEFAULTS.workerTrust);
  if (!new Set(["scoped", "full"]).has(workerTrust)) {
    throw new Error(`Unsupported --worker-trust ${workerTrust}; expected scoped or full`);
  }

  const requestedPlayers = parsed.options.has("players")
    ? positiveIntegerOption(parsed, "players")
    : null;
  const playerRange = resolvePlayerCount(manifest, requestedPlayers, gameDir);
  const roster = buildRoster({
    adapter,
    playerCount: playerRange.playerCount,
    browser: parsed.browser,
  });
  const baseUrl = normalizeBaseUrl(stringOption(parsed, "base", DEFAULTS.base));
  const runCount = positiveIntegerOption(parsed, "runs", DEFAULTS.runs);
  const maxActions = positiveIntegerOption(parsed, "max-actions", DEFAULTS.maxActions);
  const maxMinutes = positiveIntegerOption(parsed, "max-minutes", DEFAULTS.maxMinutes);
  const pollTimeoutMs = positiveIntegerOption(
    parsed,
    "poll-timeout-ms",
    DEFAULTS.pollTimeoutMs,
  );
  const stallMs = positiveIntegerOption(parsed, "stall-ms", DEFAULTS.stallMs);
  const workerBootMs = positiveIntegerOption(
    parsed,
    "worker-boot-ms",
    DEFAULTS.workerBootMs,
  );

  return {
    sweep: false,
    gameDir,
    manifest,
    gameId,
    gameSlug: manifest.slug ?? gameId,
    adapter,
    browser: parsed.browser,
    mode,
    baseUrl,
    workerTrust,
    outDir,
    timestamp,
    runCount,
    dryRun: parsed.dryRun,
    playerRange,
    roster,
    budgets: {
      maxActions,
      maxMinutes,
      pollTimeoutMs,
      stallMs,
      workerBootMs,
      pollIntervalMs: DEFAULTS.pollIntervalMs,
    },
  };
}

function printDryRun(config) {
  console.log(`QA chaos dry run for ${config.gameSlug}`);
  console.log(`Game directory: ${config.gameDir}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Mode: ${config.mode}`);
  console.log(`Browser worker: ${config.browser ? "enabled" : "disabled"}`);
  console.log(`Worker trust: ${config.workerTrust}`);
  console.log(`Runs: ${config.runCount}`);
  console.log(
    `Budgets: maxActions=${config.budgets.maxActions}, maxMinutes=${config.budgets.maxMinutes}, pollTimeoutMs=${config.budgets.pollTimeoutMs}, stallMs=${config.budgets.stallMs}, workerBootMs=${config.budgets.workerBootMs}`,
  );
  for (let runIndex = 1; runIndex <= config.runCount; runIndex += 1) {
    const runDir = createRunLayout({
      outDir: config.outDir,
      timestamp: config.timestamp,
      gameSlug: config.gameSlug,
      runIndex,
      totalRuns: config.runCount,
    });
    console.log(`Run ${runIndex} report path: ${runDir}`);
    ensureReportDirs(runDir);
    for (const worker of config.roster) {
      const workerDir = path.join(runDir, "workers", worker.name);
      const dryWorker = dryRunWorker(worker);
      const prompt = renderWorkerPrompt({
        templatePath: promptTemplateForWorker(worker),
        values: {
          workerName: worker.name,
          role: worker.role,
          adapter: worker.adapter,
          playerId: dryWorker.credentials?.playerId ?? "(browser joins through UI)",
          sessionToken: dryWorker.credentials?.sessionToken ?? "(not provided to browser workers)",
          roomCode: "DRYRUN",
          baseUrl: config.baseUrl,
          artifactDir: workerDir,
          gameId: config.gameId,
          gameName: config.manifest.name ?? config.gameSlug,
          playerCount: config.playerRange.playerCount,
          mode: config.mode,
          manifestRules: indentRules(config.manifest.rules),
          maxActions: config.budgets.maxActions,
          maxMinutes: config.budgets.maxMinutes,
          pollTimeoutMs: config.budgets.pollTimeoutMs,
          stallMs: config.budgets.stallMs,
        },
      });
      const command = resolveCommandSpecForSpawn(
        commandForAdapter(worker.adapter, workerDir, {
          workerTrust: config.workerTrust,
        }),
      );
      prepareWorkerArtifacts({
        worker: {
          ...dryWorker,
          workerTrust: config.workerTrust,
          commandSpec: command,
        },
        workerDir,
        prompt,
        workerConfig: {
          baseUrl: config.baseUrl,
          roomCode: "DRYRUN",
          pollTimeoutMs: config.budgets.pollTimeoutMs,
        },
      });
      console.log(
        `Worker ${worker.name}/${worker.kind} (${worker.adapter}) command: ${formatCommandLine(command)} < ${path.join(workerDir, "prompt.md")}`,
      );
      console.log(`Worker ${worker.name}/${worker.kind} prompt template: ${promptTemplateForWorker(worker)}`);
    }
  }
}

function dryRunWorker(worker) {
  if (worker.kind === "browser") {
    return { ...worker, credentials: null };
  }
  return {
    ...worker,
    credentials: {
      playerId: `dry-run-${worker.name.toLowerCase()}`,
      sessionToken: `dry-run-token-${worker.name.toLowerCase()}`,
    },
  };
}

function printSweepDryRun(config) {
  console.log("QA chaos sweep dry run");
  console.log(`Games: ${config.games.length}`);
  console.log(`Aggregate report path: ${path.join(config.sweepDir, "reports")}`);
  for (const [index, gameConfig] of config.games.entries()) {
    console.log("");
    console.log(`[${index + 1}/${config.games.length}] ${gameConfig.gameSlug}`);
    printDryRun(gameConfig);
  }
}

async function runAll(config) {
  for (let runIndex = 1; runIndex <= config.runCount; runIndex += 1) {
    await runOne(config, runIndex);
  }
}

async function runSweep(config) {
  const results = [];
  for (const gameConfig of config.games) {
    const startedAt = Date.now();
    try {
      await runAll(gameConfig);
      results.push({
        game: gameConfig.gameSlug,
        status: "pass",
        failureCodes: [],
        durationMs: Date.now() - startedAt,
        runDir: createRunLayout({
          outDir: gameConfig.outDir,
          timestamp: gameConfig.timestamp,
          gameSlug: gameConfig.gameSlug,
          runIndex: 1,
          totalRuns: gameConfig.runCount,
        }),
      });
    } catch (error) {
      results.push({
        game: gameConfig.gameSlug,
        status: "fail",
        failureCodes: Array.isArray(error.failureCodes)
          ? error.failureCodes
          : ["QA_CHAOS_RUN_FAILED"],
        durationMs: Date.now() - startedAt,
        runDir: error.runDir ?? null,
        error: error.message,
      });
    }
  }

  writeSweepReports({ sweepDir: config.sweepDir, results });
  const failed = results.filter((result) => result.status === "fail");
  if (failed.length > 0) {
    throw new Error(
      `QA chaos sweep failed for ${failed.map((result) => result.game).join(", ")}; see ${path.join(config.sweepDir, "reports", "sweep-results.json")}`,
    );
  }
}

async function runOne(config, runIndex) {
  const runDir = createRunLayout({
    outDir: config.outDir,
    timestamp: config.timestamp,
    gameSlug: config.gameSlug,
    runIndex,
    totalRuns: config.runCount,
  });
  ensureReportDirs(runDir);

  const startedAt = new Date();
  const failures = [];
  const runJson = {
    config: publicConfig(config, runDir, runIndex),
    roster: [],
    timings: { startedAt: startedAt.toISOString(), endedAt: null },
    outcome: { status: "running" },
  };
  writeRunJson(runDir, runJson);

  let roomCode = null;
  let workers = [];
  let runtimes = [];
  let reachedHost = false;
  try {
    await assertReachable(config.baseUrl);
    reachedHost = true;
    const host = config.roster[0];
    const created = await createRoom({
      baseUrl: config.baseUrl,
      gameId: config.gameId,
      hostName: host.name,
      maxPlayers: config.playerRange.playerCount,
      seatPolicy: config.browser ? "anyone" : "agents-only",
    });
    roomCode = created.roomCode;
    const rosterWithCredentials = [
      { ...host, credentials: created.hostCredentials },
    ];
    for (const worker of config.roster.slice(1)) {
      if (worker.kind === "browser") {
        rosterWithCredentials.push({ ...worker, credentials: null });
        continue;
      }
      const joined = await joinRoom({
        baseUrl: config.baseUrl,
        roomCode,
        workerName: worker.name,
      });
      rosterWithCredentials.push({ ...worker, credentials: joined.credentials });
    }
    workers = rosterWithCredentials.map((worker) =>
      prepareLiveWorker({ config, runDir, roomCode, worker }),
    );
    runJson.roster = workers.map((worker) => ({
      seatIndex: worker.seatIndex,
      name: worker.name,
      role: worker.role,
      kind: worker.kind,
      adapter: worker.adapter,
      playerId: worker.credentials?.playerId ?? null,
      artifactDir: worker.artifactDir,
    }));
    runJson.room = { code: roomCode, started: false };
    writeRunJson(runDir, runJson);

    const browserRuntimes = workers
      .filter((worker) => worker.kind === "browser")
      .map((worker) => new WorkerRuntime(worker));
    runtimes.push(...browserRuntimes);
    for (const runtime of browserRuntimes) runtime.launch();

    if (browserRuntimes.length > 0) {
      await waitForBrowserSeats({
        config,
        roomCode,
        hostToken: created.hostCredentials.sessionToken,
        expectedPlayerCount: config.playerRange.playerCount,
        runtimes,
        failures,
        startedAt,
      });
    }

    const restRuntimes = workers
      .filter((worker) => worker.kind !== "browser")
      .map((worker) => new WorkerRuntime(worker));
    runtimes.push(...restRuntimes);
    for (const runtime of restRuntimes) runtime.launch();

    await startAfterRestWorkersReady({
      restWorkers: workers.filter((worker) => worker.kind !== "browser"),
      runtimes,
      roomCode,
      workerBootMs: config.budgets.workerBootMs,
      checkIntervalMs: config.budgets.pollIntervalMs,
      getEarlyExitFailure: () => handleWorkerExits(runtimes, roomCode),
      start: () =>
        startRoom({
          baseUrl: config.baseUrl,
          roomCode,
          sessionToken: created.hostCredentials.sessionToken,
        }),
    });
    runJson.room = { code: roomCode, started: true };
    writeRunJson(runDir, runJson);

    const result = await monitorRoom({
      config,
      roomCode,
      hostToken: created.hostCredentials.sessionToken,
      workers,
      runtimes,
      failures,
      startedAt,
    });
    runJson.outcome = result;
  } catch (error) {
    const failure =
      error.qaChaosFailure ??
      makeFailure(
        error.name === "QaChaosHttpError" && !reachedHost
          ? "HOST_UNREACHABLE"
          : "ROOM_LIFECYCLE_FAILED",
        "high",
        error.message,
        error.details ?? { roomCode },
        "Verify the host is running, the REST endpoint contract matches qa-chaos, and the game id is available.",
      );
    failures.push(failure);
    runJson.outcome = { status: "failed", reason: failure.code };
  } finally {
    await stopWorkerRuntimes(runtimes);
    runJson.timings.endedAt = new Date().toISOString();
    writeRunJson(runDir, runJson);
    const report = writeReports({
      runDir,
      expectation: expectationText(config, runIndex),
      workers,
      failures,
      result: {
        status: runJson.outcome.status,
        reason: runJson.outcome.reason,
        outcome: runJson.outcome.finalStatus,
        actionCount: runJson.outcome.actionCount,
      },
    });
    if (report.failures.length > 0) {
      const failureMessages = report.failures
        .map((failure) => `${failure.code}: ${failure.message}`)
        .join("; ");
      const error = new Error(
        `QA chaos run failed: ${failureMessages}; see ${path.join(runDir, "reports", "failures.json")}`,
      );
      error.failureCodes = report.failures.map((failure) => failure.code);
      error.runDir = runDir;
      throw error;
    }
  }
}

function prepareLiveWorker({ config, runDir, roomCode, worker }) {
  const workerDir = path.join(runDir, "workers", worker.name);
  mkdirSync(workerDir, { recursive: true });
  const prompt = renderWorkerPrompt({
    templatePath: promptTemplateForWorker(worker),
    values: {
      workerName: worker.name,
      role: worker.role,
      adapter: worker.adapter,
      playerId: worker.credentials?.playerId ?? "(browser joins through UI)",
      sessionToken: worker.credentials?.sessionToken ?? "(not provided to browser workers)",
      roomCode,
      baseUrl: config.baseUrl,
      artifactDir: workerDir,
      gameId: config.gameId,
      gameName: config.manifest.name ?? config.gameSlug,
      playerCount: config.playerRange.playerCount,
      mode: config.mode,
      manifestRules: indentRules(config.manifest.rules),
      maxActions: config.budgets.maxActions,
      maxMinutes: config.budgets.maxMinutes,
      pollTimeoutMs: config.budgets.pollTimeoutMs,
      stallMs: config.budgets.stallMs,
    },
  });
  return prepareWorkerArtifacts({
    worker: {
      ...worker,
      workerTrust: config.workerTrust,
      commandSpec: commandForAdapter(worker.adapter, workerDir, {
        workerTrust: config.workerTrust,
      }),
    },
    workerDir,
    prompt,
    workerConfig: {
      baseUrl: config.baseUrl,
      roomCode,
      pollTimeoutMs: config.budgets.pollTimeoutMs,
    },
  });
}

async function waitForBrowserSeats({
  config,
  roomCode,
  hostToken,
  expectedPlayerCount,
  runtimes,
  startedAt,
}) {
  let cursor = null;
  const deadlineAt = startedAt.getTime() + config.budgets.maxMinutes * 60_000;
  while (Date.now() < deadlineAt) {
    const earlyExitFailure = handleWorkerExits(runtimes, roomCode);
    if (earlyExitFailure) {
      throw qaChaosFailureError(earlyExitFailure);
    }
    const poll = await pollRoom({
      baseUrl: config.baseUrl,
      roomCode,
      sessionToken: hostToken,
      cursor,
      timeoutMs: config.budgets.pollTimeoutMs,
    });
    cursor = extractCursor(poll) ?? cursor;
    const joinedPlayerCount = extractJoinedPlayerCount(poll);
    if (joinedPlayerCount !== null && joinedPlayerCount >= expectedPlayerCount) return;
    await delay(config.budgets.pollIntervalMs);
  }
  throw new Error(
    `Timed out waiting for browser worker to join room ${roomCode} before start`,
  );
}

async function monitorRoom({
  config,
  roomCode,
  hostToken,
  workers,
  runtimes,
  failures,
  startedAt,
}) {
  let cursor = null;
  let lastFingerprint = null;
  let lastProgressAt = Date.now();
  let initialTurnNumber = null;
  let currentTurnNumber = null;
  let lastActionCount = 0;

  while (true) {
    const now = Date.now();
    if (now - startedAt.getTime() > config.budgets.maxMinutes * 60_000) {
      failures.push(
        makeFailure(
          "MAX_MINUTES_EXCEEDED",
          "high",
          `Wall-clock budget exceeded ${config.budgets.maxMinutes} minute(s)`,
          { roomCode, maxMinutes: config.budgets.maxMinutes },
          "Reduce run scope or investigate why the room did not finish.",
        ),
      );
      return { status: "failed", reason: "MAX_MINUTES_EXCEEDED", actionCount: lastActionCount };
    }

    const earlyExitFailure = handleWorkerExits(runtimes, roomCode);
    if (earlyExitFailure) {
      failures.push(earlyExitFailure);
      return { status: "failed", reason: earlyExitFailure.code, actionCount: lastActionCount };
    }

    const poll = await pollRoom({
      baseUrl: config.baseUrl,
      roomCode,
      sessionToken: hostToken,
      cursor,
      timeoutMs: config.budgets.pollTimeoutMs,
    });
    cursor = extractCursor(poll) ?? cursor;
    const fingerprint = fingerprintPoll(poll);
    if (fingerprint !== lastFingerprint) {
      lastFingerprint = fingerprint;
      lastProgressAt = Date.now();
    }
    const turnNumber = extractActionCount(poll);
    if (turnNumber !== null) {
      if (initialTurnNumber === null) initialTurnNumber = turnNumber;
      currentTurnNumber = turnNumber;
    }
    const workerActions = countWorkerActionSubmissions(workers);
    const actionSignal = observedActionCount({
      workerActionCount: workerActions.actionCount,
      currentTurnNumber,
      initialTurnNumber,
    });
    lastActionCount = actionSignal.actionCount;
    if (lastActionCount > config.budgets.maxActions) {
      failures.push(
        makeFailure(
          "MAX_ACTIONS_EXCEEDED",
          "high",
          `Submitted action budget exceeded ${config.budgets.maxActions}`,
          {
            roomCode,
            actionCount: lastActionCount,
            maxActions: config.budgets.maxActions,
            workerActionCount: actionSignal.workerActionCount,
            turnDelta: actionSignal.turnDelta,
            countedEntries: workerActions.countedEntries,
          },
          "Lower worker exploration or increase the action budget for this game.",
        ),
      );
      return { status: "failed", reason: "MAX_ACTIONS_EXCEEDED", actionCount: lastActionCount };
    }
    const autoplayedPlayers = detectAutoplayedPlayers(poll);
    if (autoplayedPlayers.length > 0) {
      failures.push(
        makeFailure(
          "REST_TURN_AUTOPLAYED",
          "high",
          `Player autoPlayCount exceeded zero: ${autoplayedPlayers
            .map((player) => `${player.label}=${player.autoPlayCount}`)
            .join(", ")}`,
          { roomCode, autoplayedPlayers },
          "Inspect worker stdout and turn deadlines; workers must submit before urgent deadlines.",
        ),
      );
      return { status: "failed", reason: "REST_TURN_AUTOPLAYED", actionCount: lastActionCount };
    }
    if (isGameOverPoll(poll)) {
      return {
        status: "passed",
        reason: null,
        finalStatus: "game_over",
        actionCount: lastActionCount,
      };
    }
    if (Date.now() - lastProgressAt > config.budgets.stallMs) {
      failures.push(
        makeFailure(
          "GAME_STALLED",
          "high",
          `No poll version/state change for ${config.budgets.stallMs}ms`,
          { roomCode, cursor, lastFingerprint },
          "Inspect worker logs and room state to determine why no legal progress occurred.",
        ),
      );
      return { status: "failed", reason: "GAME_STALLED", actionCount: lastActionCount };
    }
    await delay(config.budgets.pollIntervalMs);
  }
}

function handleWorkerExits(runtimes, roomCode) {
  for (const runtime of runtimes) {
    const earlyExitIndex = runtime.exits.findIndex((exit) => !exit.stopRequested);
    if (earlyExitIndex === -1) continue;
    const [earlyExit] = runtime.exits.splice(earlyExitIndex, 1);
    if (isWorkerSpawnFailureExit(earlyExit)) {
      return makeFailure(
        "WORKER_SPAWN_FAILED",
        "high",
        `${runtime.worker.name} failed to spawn worker command`,
        workerSpawnFailureEvidence(runtime.worker, earlyExit),
        "Install the worker CLI, fix PATH, or repair Windows shim resolution before rerunning qa-chaos.",
      );
    }
    if (runtime.launchCount === 1) {
      runtime.launch();
      continue;
    }
    return makeFailure(
      "REST_WORKER_EXITED_EARLY",
      "high",
      `${runtime.worker.name} exited twice while room was still live`,
      { roomCode, worker: runtime.worker.name, exits: runtime.exits.concat(earlyExit) },
      "Inspect the worker stderr/stdout log and make the prompt or adapter invocation keep running through game over.",
    );
  }
  return null;
}

function qaChaosFailureError(failure) {
  const error = new Error(failure.message);
  error.qaChaosFailure = failure;
  return error;
}

function publicConfig(config, runDir, runIndex) {
  return {
    gameDir: config.gameDir,
    gameId: config.gameId,
    gameSlug: config.gameSlug,
    adapter: config.adapter,
    browser: config.browser,
    mode: config.mode,
    baseUrl: config.baseUrl,
    runIndex,
    runCount: config.runCount,
    playerCount: config.playerRange.playerCount,
    workerTrust: config.workerTrust,
    budgets: config.budgets,
    runDir,
  };
}

function expectationText(config, runIndex) {
  const workerMode = config.browser
    ? "REST model workers plus one Playwright UI worker"
    : "isolated REST model workers";
  return [
    `Run ${runIndex} should create, fill, start, and complete one ${config.gameSlug} room through ${workerMode}.`,
    `Workers must use only their own seat credentials, stay within ${config.budgets.maxActions} submitted actions and ${config.budgets.maxMinutes} minute(s), and append QA ledger entries to tests.jsonl.`,
  ].join(" ");
}

function indentRules(rules) {
  if (typeof rules !== "string" || rules.trim() === "") {
    return "(manifest.rules is empty)";
  }
  return rules
    .split(/\r?\n/)
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function stringOption(parsed, name, defaultValue) {
  return parsed.options.get(name) ?? defaultValue;
}

function positiveIntegerOption(parsed, name, defaultValue = undefined) {
  const raw = parsed.options.get(name);
  if (raw === undefined) {
    if (defaultValue === undefined) throw new Error(`--${name} is required`);
    return defaultValue;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`--${name} must be a positive integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

function knownValueOptions() {
  return new Set([
    "adapter",
    "players",
    "runs",
    "base",
    "mode",
    "max-actions",
    "max-minutes",
    "stall-ms",
    "poll-timeout-ms",
    "worker-boot-ms",
    "worker-trust",
    "out-dir",
  ]);
}

function promptTemplateForWorker(worker) {
  return worker.kind === "browser" ? browserPromptTemplatePath : promptTemplatePath;
}

function listCatalogGameDirs(rootDir) {
  return readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))
    .filter((gameDir) => existsSync(path.join(gameDir, "manifest.json")))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
