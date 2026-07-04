import { spawn } from "node:child_process";
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_TRUST_MODES = new Set(["scoped", "full"]);
const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLL_LOOP_TEMPLATE_PATH = path.join(SCRIPTS_DIR, "qa-chaos-poll-loop.mjs");
const ACT_HELPER_TEMPLATE_PATH = path.join(SCRIPTS_DIR, "qa-chaos-act.mjs");

export function commandForAdapter(adapter, workerDir, options = {}) {
  const workerTrust = options.workerTrust ?? "scoped";
  if (!WORKER_TRUST_MODES.has(workerTrust)) {
    throw new Error(`Unsupported worker trust ${workerTrust}; expected scoped or full`);
  }

  if (adapter === "claude") {
    const args = ["-p", "--model", "sonnet", "--effort", "low"];
    if (workerTrust === "full") {
      args.push("--dangerously-skip-permissions");
    } else {
      args.push("--allowedTools", "Bash");
    }
    return {
      command: "claude",
      args,
    };
  }
  if (adapter === "codex") {
    return {
      command: "codex",
      args: [
        "exec",
        "-m",
        "gpt-5.5",
        "-c",
        'model_reasoning_effort="low"',
        "-c",
        "sandbox_workspace_write.network_access=true",
        "--sandbox",
        "workspace-write",
        "-C",
        workerDir,
      ],
    };
  }
  throw new Error(`Unsupported worker adapter ${adapter}`);
}

export function formatCommandLine(commandSpec) {
  return [commandSpec.command, ...commandSpec.args].map(shellQuote).join(" ");
}

export function resolveCommandSpecForSpawn(commandSpec) {
  if (process.platform !== "win32") return commandSpec;

  const command = resolveWindowsExecutable(commandSpec.command);
  if (!isWindowsBatchFile(command)) {
    return { ...commandSpec, command };
  }

  const shimTarget = resolveNpmCmdShim(command);
  if (!shimTarget) return { ...commandSpec, command };
  return {
    ...commandSpec,
    command: shimTarget.command,
    args: [...shimTarget.args, ...commandSpec.args],
  };
}

export function isWorkerSpawnFailureExit(exit) {
  return exit?.type === "spawn_error";
}

export function workerSpawnFailureEvidence(worker, exit) {
  return {
    worker: worker.name,
    command: exit.command,
    error: exit.error,
  };
}

export function renderWorkerPrompt({ templatePath, values }) {
  let text = readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries(values)) {
    text = text.replaceAll(`{{${key}}}`, String(value));
  }
  const unresolved = text.match(/{{[A-Za-z0-9_]+}}/g);
  if (unresolved) {
    throw new Error(`Worker prompt has unresolved placeholders: ${unresolved.join(", ")}`);
  }
  return text;
}

export function prepareWorkerArtifacts({ worker, workerDir, prompt, workerConfig = null }) {
  mkdirSync(workerDir, { recursive: true });
  mkdirSync(path.join(workerDir, "screenshots"), { recursive: true });
  const pollPath = path.join(workerDir, "poll.jsonl");
  writeFileSync(path.join(workerDir, "prompt.md"), prompt);
  writeFileSync(path.join(workerDir, "tests.jsonl"), "");
  writeFileSync(pollPath, "");
  writeFileSync(path.join(workerDir, "writes.jsonl"), "");
  writeFileSync(path.join(workerDir, "actions.jsonl"), "");
  writeFileSync(path.join(workerDir, "observations.jsonl"), "");
  writeFileSync(path.join(workerDir, "console.jsonl"), "");
  writeFileSync(path.join(workerDir, "network.jsonl"), "");
  writeFileSync(path.join(workerDir, "transcript.md"), "");
  copyFileSync(ACT_HELPER_TEMPLATE_PATH, path.join(workerDir, "act.mjs"));
  if (worker.kind === "rest") {
    writeFileSync(
      path.join(workerDir, "worker-config.json"),
      JSON.stringify(workerConfigForArtifact({ worker, workerConfig }), null, 2),
    );
    copyFileSync(POLL_LOOP_TEMPLATE_PATH, path.join(workerDir, "poll-loop.mjs"));
  }
  return {
    ...worker,
    artifactDir: workerDir,
    promptPath: path.join(workerDir, "prompt.md"),
    stdoutPath: path.join(workerDir, "stdout.log"),
    stderrPath: path.join(workerDir, "stderr.log"),
    testsPath: path.join(workerDir, "tests.jsonl"),
    pollPath,
    writesPath: path.join(workerDir, "writes.jsonl"),
  };
}

function workerConfigForArtifact({ worker, workerConfig }) {
  const config = workerConfig ?? {};
  const credentials = worker.credentials ?? {};
  return {
    baseUrl: config.baseUrl,
    roomCode: config.roomCode,
    playerId: credentials.playerId ?? config.playerId,
    sessionToken: credentials.sessionToken ?? config.sessionToken,
    pollTimeoutMs: config.pollTimeoutMs,
    workerName: worker.name,
  };
}

export async function startAfterRestWorkersReady({
  restWorkers,
  runtimes = [],
  roomCode,
  workerBootMs,
  checkIntervalMs = 250,
  getEarlyExitFailure = null,
  start,
}) {
  await waitForRestWorkersReady({
    restWorkers,
    runtimes,
    roomCode,
    workerBootMs,
    checkIntervalMs,
    getEarlyExitFailure,
  });
  return start();
}

export async function waitForRestWorkersReady({
  restWorkers,
  runtimes = [],
  roomCode,
  workerBootMs,
  checkIntervalMs = 250,
  getEarlyExitFailure = null,
}) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + workerBootMs;
  let readiness = restWorkers.map(readRestWorkerReadiness);

  while (true) {
    const earlyExitFailure =
      typeof getEarlyExitFailure === "function" ? getEarlyExitFailure(runtimes) : null;
    if (earlyExitFailure) throw qaChaosFailureError(earlyExitFailure);

    readiness = restWorkers.map(readRestWorkerReadiness);
    if (readiness.every((worker) => worker.ready)) {
      return {
        roomCode,
        workerBootMs,
        durationMs: Date.now() - startedAt,
        workers: readiness,
      };
    }

    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) break;
    await delay(Math.min(checkIntervalMs, remainingMs));
  }

  throw qaChaosFailureError(
    workerBootTimeoutFailure({
      roomCode,
      workerBootMs,
      readiness,
    }),
  );
}

export class WorkerRuntime {
  constructor(worker) {
    this.worker = worker;
    this.launchCount = 0;
    this.child = null;
    this.exits = [];
    this.stopRequested = false;
  }

  launch() {
    this.launchCount += 1;
    const commandSpec = resolveCommandSpecForSpawn(
      this.worker.commandSpec ??
        commandForAdapter(this.worker.adapter, this.worker.artifactDir, {
          workerTrust: this.worker.workerTrust,
        }),
    );
    const commandLine = formatCommandLine(commandSpec);
    const stdout = createWriteStream(this.worker.stdoutPath, { flags: "a" });
    const stderr = createWriteStream(this.worker.stderrPath, { flags: "a" });
    let child;
    try {
      child = spawn(commandSpec.command, commandSpec.args, {
        cwd: this.worker.artifactDir,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      this.recordSpawnError({ error, commandLine, stdout, stderr });
      return;
    }
    this.child = child;
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    child.stdin.end(readFileSync(this.worker.promptPath, "utf8"));
    child.on("error", (error) => {
      this.recordSpawnError({ error, commandLine, stdout, stderr });
      if (this.child === child) this.child = null;
    });
    child.on("exit", (code, signal) => {
      stdout.end();
      stderr.end();
      this.exits.push({
        code,
        signal,
        at: new Date().toISOString(),
        launchCount: this.launchCount,
        stopRequested: this.stopRequested,
      });
      if (this.child === child) this.child = null;
    });
  }

  async stop() {
    this.stopRequested = true;
    if (!this.child || this.child.killed) return;
    const child = this.child;
    await delay(1500);
    if (!isChildRunning(child)) return;
    child.kill("SIGTERM");
    await delay(1500);
    if (isChildRunning(child)) child.kill("SIGKILL");
  }

  recordSpawnError({ error, commandLine, stdout, stderr }) {
    stderr.write(`spawn error: ${error.message}\n`);
    stdout.end();
    stderr.end();
    this.exits.push({
      type: "spawn_error",
      code: null,
      signal: null,
      command: commandLine,
      error: error.message,
      at: new Date().toISOString(),
      launchCount: this.launchCount,
      stopRequested: this.stopRequested,
    });
  }
}

export async function stopWorkerRuntimes(runtimes) {
  await Promise.all(runtimes.map((runtime) => runtime.stop()));
}

function isChildRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function shellQuote(value) {
  if (value !== "" && !/\s/.test(value)) return value;
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

function resolveWindowsExecutable(command) {
  if (path.basename(command) !== command || path.isAbsolute(command)) {
    return resolveWindowsExecutableAtPath(command);
  }

  const pathEntries = windowsPathEntries();
  const extensions = windowsExecutableExtensions(command);
  for (const pathEntry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(pathEntry, `${command}${extension}`);
      if (isExistingFile(candidate)) return candidate;
    }
  }
  return command;
}

function resolveWindowsExecutableAtPath(command) {
  if (isExistingFile(command)) return command;
  for (const extension of windowsExecutableExtensions(command)) {
    const candidate = `${command}${extension}`;
    if (isExistingFile(candidate)) return candidate;
  }
  return command;
}

function windowsPathEntries() {
  const rawPath =
    process.env.PATH ?? process.env.Path ?? process.env.path ?? "";
  return rawPath
    .split(path.delimiter)
    .map((entry) => (entry === "" ? process.cwd() : entry))
    .filter((entry) => entry !== "");
}

function windowsExecutableExtensions(command) {
  if (path.extname(command) !== "") return [""];
  const rawPathext = process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  return rawPathext
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => extension !== "")
    .map((extension) => (extension.startsWith(".") ? extension : `.${extension}`));
}

function isExistingFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isWindowsBatchFile(filePath) {
  return /\.(?:cmd|bat)$/i.test(filePath);
}

function resolveNpmCmdShim(command) {
  let text;
  try {
    text = readFileSync(command, "utf8");
  } catch {
    return null;
  }

  const match = text.match(/"%_prog%"\s+"%dp0%\\([^"]+)"\s+%\*/i);
  if (!match) return null;

  const shimDir = path.dirname(command);
  const targetPath = path.join(shimDir, match[1]);
  if (!isExistingFile(targetPath)) return null;

  const bundledNode = path.join(shimDir, "node.exe");
  return {
    command: isExistingFile(bundledNode) ? bundledNode : process.execPath,
    args: [targetPath],
  };
}

function readRestWorkerReadiness(worker) {
  const pollPath = worker.pollPath ?? path.join(worker.artifactDir, "poll.jsonl");
  let text;
  try {
    text = readFileSync(pollPath, "utf8");
  } catch (error) {
    return {
      worker: worker.name,
      pollPath,
      ready: false,
      parsedEntries: 0,
      lineCount: 0,
      parseErrors: [],
      readError: error.message,
    };
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const parseErrors = [];
  let parsedEntries = 0;
  for (const [index, line] of lines.entries()) {
    try {
      JSON.parse(line);
      parsedEntries += 1;
    } catch (error) {
      parseErrors.push({ line: index + 1, error: error.message });
    }
  }
  return {
    worker: worker.name,
    pollPath,
    ready: lines.length >= 1,
    parsedEntries,
    lineCount: lines.length,
    parseErrors,
  };
}

function workerBootTimeoutFailure({ roomCode, workerBootMs, readiness }) {
  const neverReadyWorkers = readiness
    .filter((worker) => !worker.ready)
    .map((worker) => worker.worker);
  return {
    code: "WORKER_BOOT_TIMEOUT",
    severity: "high",
    message: `REST worker boot timeout after ${workerBootMs}ms: ${neverReadyWorkers.join(", ")}`,
    evidence: {
      roomCode,
      workerBootMs,
      neverReadyWorkers,
      readiness,
    },
    fixHint:
      "Inspect worker stdout/stderr and poll.jsonl. REST workers must append at least one non-empty poll line before the room starts; parseErrors are diagnostic only.",
  };
}

function qaChaosFailureError(failure) {
  const error = new Error(failure.message);
  error.qaChaosFailure = failure;
  return error;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
