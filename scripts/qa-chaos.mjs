#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
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
  describesAutoplay,
  extractActionCount,
  extractCursor,
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
  prepareWorkerArtifacts,
  renderWorkerPrompt,
  stopWorkerRuntimes,
} from "./lib/qa-chaos-workers.mjs";
import {
  createRunLayout,
  ensureReportDirs,
  makeFailure,
  timestampForPath,
  writeReports,
  writeRunJson,
} from "./lib/qa-chaos-reporting.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const promptTemplatePath = path.join(__dirname, "qa-chaos-worker-prompt.md");

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
    printDryRun(config);
    return;
  }
  await runAll(config);
}

function usage() {
  console.log(
    [
      "Usage: node scripts/qa-chaos.mjs <game-dir> [options]",
      "",
      "Options:",
      "  --adapter NAME          claude|codex|mixed (default: claude)",
      "  --players N             Player count (default: manifest.minPlayers)",
      "  --runs N                Independent room runs (default: 1)",
      "  --base URL              Host base URL (default: http://localhost:3000)",
      "  --mode MODE             smoke|full|weird (default: smoke)",
      "  --max-actions N         Total submitted action budget (default: 300)",
      "  --max-minutes N         Wall-clock budget per run (default: 20)",
      "  --stall-ms N            No-progress stall threshold (default: 90000)",
      "  --poll-timeout-ms N     Host poll timeout (default: 5000)",
      "  --out-dir DIR           Artifact root (default: e2e-runs)",
      "  --dry-run               Print topology, commands, budgets, and paths; spawn nothing",
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
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (!knownValueOptions().has(name)) {
      throw new Error(`Unknown option ${arg}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }
    options.set(name, value);
    index += 1;
  }
  return {
    help: flags.has("help"),
    dryRun: flags.has("dry-run"),
    positionals,
    options,
  };
}

function resolveConfig(parsed) {
  if (parsed.positionals.length !== 1) {
    throw new Error("Expected exactly one <game-dir>. Use --help for usage.");
  }
  const gameDir = path.resolve(process.cwd(), parsed.positionals[0]);
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

  const requestedPlayers = parsed.options.has("players")
    ? positiveIntegerOption(parsed, "players")
    : null;
  const playerRange = resolvePlayerCount(manifest, requestedPlayers, gameDir);
  const roster = buildRoster({ adapter, playerCount: playerRange.playerCount });
  const baseUrl = normalizeBaseUrl(stringOption(parsed, "base", DEFAULTS.base));
  const outDir = path.resolve(
    process.cwd(),
    stringOption(parsed, "out-dir", "e2e-runs"),
  );
  const timestamp = timestampForPath();
  const runCount = positiveIntegerOption(parsed, "runs", DEFAULTS.runs);
  const maxActions = positiveIntegerOption(parsed, "max-actions", DEFAULTS.maxActions);
  const maxMinutes = positiveIntegerOption(parsed, "max-minutes", DEFAULTS.maxMinutes);
  const pollTimeoutMs = positiveIntegerOption(
    parsed,
    "poll-timeout-ms",
    DEFAULTS.pollTimeoutMs,
  );
  const stallMs = positiveIntegerOption(parsed, "stall-ms", DEFAULTS.stallMs);

  return {
    gameDir,
    manifest,
    gameId,
    gameSlug: manifest.slug ?? gameId,
    adapter,
    mode,
    baseUrl,
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
      pollIntervalMs: DEFAULTS.pollIntervalMs,
    },
  };
}

function printDryRun(config) {
  console.log(`QA chaos dry run for ${config.gameSlug}`);
  console.log(`Game directory: ${config.gameDir}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Mode: ${config.mode}`);
  console.log(`Runs: ${config.runCount}`);
  console.log(
    `Budgets: maxActions=${config.budgets.maxActions}, maxMinutes=${config.budgets.maxMinutes}, pollTimeoutMs=${config.budgets.pollTimeoutMs}, stallMs=${config.budgets.stallMs}`,
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
    for (const worker of config.roster) {
      const workerDir = path.join(runDir, "workers", worker.name);
      const command = commandForAdapter(worker.adapter, workerDir);
      console.log(
        `Worker ${worker.name} (${worker.adapter}) command: ${formatCommandLine(command)} < ${path.join(workerDir, "prompt.md")}`,
      );
    }
  }
}

async function runAll(config) {
  for (let runIndex = 1; runIndex <= config.runCount; runIndex += 1) {
    await runOne(config, runIndex);
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
  try {
    await assertReachable(config.baseUrl);
    const host = config.roster[0];
    const created = await createRoom({
      baseUrl: config.baseUrl,
      gameId: config.gameId,
      hostName: host.name,
      maxPlayers: config.playerRange.playerCount,
    });
    roomCode = created.roomCode;
    const rosterWithCredentials = [
      { ...host, credentials: created.hostCredentials },
    ];
    for (const worker of config.roster.slice(1)) {
      const joined = await joinRoom({
        baseUrl: config.baseUrl,
        roomCode,
        workerName: worker.name,
      });
      rosterWithCredentials.push({ ...worker, credentials: joined.credentials });
    }
    await startRoom({
      baseUrl: config.baseUrl,
      roomCode,
      sessionToken: created.hostCredentials.sessionToken,
    });

    workers = rosterWithCredentials.map((worker) =>
      prepareLiveWorker({ config, runDir, roomCode, worker }),
    );
    runJson.roster = workers.map((worker) => ({
      seatIndex: worker.seatIndex,
      name: worker.name,
      role: worker.role,
      adapter: worker.adapter,
      playerId: worker.credentials.playerId,
      artifactDir: worker.artifactDir,
    }));
    runJson.room = { code: roomCode, started: true };
    writeRunJson(runDir, runJson);

    runtimes = workers.map((worker) => new WorkerRuntime(worker));
    for (const runtime of runtimes) runtime.launch();

    const result = await monitorRoom({
      config,
      roomCode,
      hostToken: created.hostCredentials.sessionToken,
      runtimes,
      failures,
      startedAt,
    });
    runJson.outcome = result;
  } catch (error) {
    const failure = makeFailure(
      error.name === "QaChaosHttpError" ? "HOST_UNREACHABLE" : "ROOM_LIFECYCLE_FAILED",
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
      throw new Error(
        `QA chaos run failed: ${failureMessages}; see ${path.join(runDir, "reports", "failures.json")}`,
      );
    }
  }
}

function prepareLiveWorker({ config, runDir, roomCode, worker }) {
  const workerDir = path.join(runDir, "workers", worker.name);
  mkdirSync(workerDir, { recursive: true });
  const prompt = renderWorkerPrompt({
    templatePath: promptTemplatePath,
    values: {
      workerName: worker.name,
      role: worker.role,
      adapter: worker.adapter,
      playerId: worker.credentials.playerId,
      sessionToken: worker.credentials.sessionToken,
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
  return prepareWorkerArtifacts({ worker, workerDir, prompt });
}

async function monitorRoom({
  config,
  roomCode,
  hostToken,
  runtimes,
  failures,
  startedAt,
}) {
  let cursor = null;
  let lastFingerprint = null;
  let lastProgressAt = Date.now();
  let lastActionCount = null;

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
    const actionCount = extractActionCount(poll);
    if (actionCount !== null) lastActionCount = actionCount;
    if (lastActionCount !== null && lastActionCount > config.budgets.maxActions) {
      failures.push(
        makeFailure(
          "MAX_ACTIONS_EXCEEDED",
          "high",
          `Submitted action budget exceeded ${config.budgets.maxActions}`,
          { roomCode, actionCount: lastActionCount, maxActions: config.budgets.maxActions },
          "Lower worker exploration or increase the action budget for this game.",
        ),
      );
      return { status: "failed", reason: "MAX_ACTIONS_EXCEEDED", actionCount: lastActionCount };
    }
    if (describesAutoplay(poll)) {
      failures.push(
        makeFailure(
          "REST_TURN_AUTOPLAYED",
          "high",
          "Poll evidence indicates an autoplay or missed deadline.",
          { roomCode, poll },
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
    const earlyExit = runtime.exits.find((exit) => !exit.stopRequested);
    if (!earlyExit) continue;
    runtime.exits = runtime.exits.filter((exit) => exit.stopRequested);
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

function publicConfig(config, runDir, runIndex) {
  return {
    gameDir: config.gameDir,
    gameId: config.gameId,
    gameSlug: config.gameSlug,
    adapter: config.adapter,
    mode: config.mode,
    baseUrl: config.baseUrl,
    runIndex,
    runCount: config.runCount,
    playerCount: config.playerRange.playerCount,
    budgets: config.budgets,
    runDir,
  };
}

function expectationText(config, runIndex) {
  return [
    `Run ${runIndex} should create, fill, start, and complete one ${config.gameSlug} room through isolated REST model workers.`,
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
    "out-dir",
  ]);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
