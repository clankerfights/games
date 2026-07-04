import { spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export function commandForAdapter(adapter, workerDir) {
  if (adapter === "claude") {
    return {
      command: "claude",
      args: ["-p", "--model", "sonnet", "--effort", "low"],
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

export function prepareWorkerArtifacts({ worker, workerDir, prompt }) {
  mkdirSync(workerDir, { recursive: true });
  mkdirSync(path.join(workerDir, "screenshots"), { recursive: true });
  writeFileSync(path.join(workerDir, "prompt.md"), prompt);
  writeFileSync(path.join(workerDir, "tests.jsonl"), "");
  writeFileSync(path.join(workerDir, "poll.jsonl"), "");
  writeFileSync(path.join(workerDir, "writes.jsonl"), "");
  writeFileSync(path.join(workerDir, "actions.jsonl"), "");
  writeFileSync(path.join(workerDir, "observations.jsonl"), "");
  writeFileSync(path.join(workerDir, "console.jsonl"), "");
  writeFileSync(path.join(workerDir, "network.jsonl"), "");
  writeFileSync(path.join(workerDir, "transcript.md"), "");
  return {
    ...worker,
    artifactDir: workerDir,
    promptPath: path.join(workerDir, "prompt.md"),
    stdoutPath: path.join(workerDir, "stdout.log"),
    stderrPath: path.join(workerDir, "stderr.log"),
    testsPath: path.join(workerDir, "tests.jsonl"),
    writesPath: path.join(workerDir, "writes.jsonl"),
  };
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
      this.worker.commandSpec ?? commandForAdapter(this.worker.adapter, this.worker.artifactDir),
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
    child.kill("SIGTERM");
    await delay(1500);
    if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
