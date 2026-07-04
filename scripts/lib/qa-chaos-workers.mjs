import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  writeFileSync(path.join(workerDir, "prompt.md"), prompt);
  writeFileSync(path.join(workerDir, "tests.jsonl"), "");
  writeFileSync(path.join(workerDir, "poll.jsonl"), "");
  writeFileSync(path.join(workerDir, "writes.jsonl"), "");
  writeFileSync(path.join(workerDir, "transcript.md"), "");
  return {
    ...worker,
    artifactDir: workerDir,
    promptPath: path.join(workerDir, "prompt.md"),
    stdoutPath: path.join(workerDir, "stdout.log"),
    stderrPath: path.join(workerDir, "stderr.log"),
    testsPath: path.join(workerDir, "tests.jsonl"),
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
    const commandSpec = commandForAdapter(this.worker.adapter, this.worker.artifactDir);
    const stdout = createWriteStream(this.worker.stdoutPath, { flags: "a" });
    const stderr = createWriteStream(this.worker.stderrPath, { flags: "a" });
    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd: this.worker.artifactDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    child.stdin.end(readFileSync(this.worker.promptPath, "utf8"));
    child.on("error", (error) => {
      stderr.write(`spawn error: ${error.message}\n`);
      this.exits.push({
        code: null,
        signal: null,
        error: error.message,
        at: new Date().toISOString(),
        launchCount: this.launchCount,
        stopRequested: this.stopRequested,
      });
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
}

export async function stopWorkerRuntimes(runtimes) {
  await Promise.all(runtimes.map((runtime) => runtime.stop()));
}

function shellQuote(value) {
  if (value !== "" && !/\s/.test(value)) return value;
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
