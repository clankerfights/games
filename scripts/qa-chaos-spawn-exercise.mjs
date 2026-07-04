#!/usr/bin/env node
import {
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WorkerRuntime,
  isWorkerSpawnFailureExit,
  prepareWorkerArtifacts,
  workerSpawnFailureEvidence,
} from "./lib/qa-chaos-workers.mjs";
import {
  ensureReportDirs,
  makeFailure,
  writeReports,
} from "./lib/qa-chaos-reporting.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const tempRoot = path.join(repoRoot, ".tmp", "qa-chaos-spawn-exercise");

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  rmSync(tempRoot, { recursive: true, force: true });
  mkdirSync(tempRoot, { recursive: true });
  try {
    await exerciseExistingCommand();
    console.log("PASS existing command spawned and stdout.log captured hi");
    await exerciseMissingCommand();
    console.log("PASS nonexistent command wrote WORKER_SPAWN_FAILED without deadline wait");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function exerciseExistingCommand() {
  const runDir = path.join(tempRoot, "existing-command");
  ensureReportDirs(runDir);
  const worker = prepareExerciseWorker({
    runDir,
    name: "SPAWN-OK",
    commandSpec: {
      command: "node",
      args: ["-e", "console.log('hi')"],
    },
  });
  const runtime = new WorkerRuntime(worker);
  runtime.launch();
  const exit = await waitForRuntimeExit(runtime, 5000);
  if (isWorkerSpawnFailureExit(exit)) {
    throw new Error(`Expected node command to spawn, got ${exit.error}`);
  }
  if (exit.code !== 0) {
    throw new Error(`Expected node command exit 0, got ${exit.code}`);
  }
  await waitForFileContains(worker.stdoutPath, "hi", 2000);
}

async function exerciseMissingCommand() {
  const runDir = path.join(tempRoot, "missing-command");
  ensureReportDirs(runDir);
  const worker = prepareExerciseWorker({
    runDir,
    name: "SPAWN-MISSING",
    commandSpec: {
      command: "qa-chaos-command-that-does-not-exist-835",
      args: [],
    },
  });
  const runtime = new WorkerRuntime(worker);
  const startedAt = Date.now();
  runtime.launch();
  const exit = await waitForRuntimeExit(runtime, 5000);
  const elapsedMs = Date.now() - startedAt;
  if (!isWorkerSpawnFailureExit(exit)) {
    throw new Error(`Expected spawn failure exit, got ${JSON.stringify(exit)}`);
  }
  if (elapsedMs >= 5000) {
    throw new Error(`Spawn failure waited too long: ${elapsedMs}ms`);
  }

  const failure = makeFailure(
    "WORKER_SPAWN_FAILED",
    "high",
    `${worker.name} failed to spawn worker command`,
    workerSpawnFailureEvidence(worker, exit),
    "Install the worker CLI, fix PATH, or repair Windows shim resolution before rerunning qa-chaos.",
  );
  writeReports({
    runDir,
    expectation: "Missing worker command should fail before any run deadline.",
    workers: [worker],
    failures: [failure],
    result: {
      status: "failed",
      reason: "WORKER_SPAWN_FAILED",
    },
  });

  const savedFailures = JSON.parse(
    readFileSync(path.join(runDir, "reports", "failures.json"), "utf8"),
  );
  const savedFailure = savedFailures[0];
  if (savedFailure?.code !== "WORKER_SPAWN_FAILED") {
    throw new Error("failures.json did not contain WORKER_SPAWN_FAILED");
  }
  if (
    savedFailure.evidence?.worker !== worker.name ||
    typeof savedFailure.evidence?.command !== "string" ||
    typeof savedFailure.evidence?.error !== "string"
  ) {
    throw new Error("WORKER_SPAWN_FAILED did not include worker, command, and error evidence");
  }
}

function prepareExerciseWorker({ runDir, name, commandSpec }) {
  const workerDir = path.join(runDir, "workers", name);
  return prepareWorkerArtifacts({
    worker: {
      seatIndex: 1,
      name,
      role: "spawn-exercise",
      kind: "rest",
      adapter: "exercise",
      commandSpec,
    },
    workerDir,
    prompt: "qa-chaos spawn exercise\n",
  });
}

async function waitForRuntimeExit(runtime, timeoutMs) {
  const deadlineAt = Date.now() + timeoutMs;
  while (Date.now() < deadlineAt) {
    const exit = runtime.exits.find((entry) => !entry.stopRequested);
    if (exit) return exit;
    await delay(25);
  }
  throw new Error(`Timed out waiting ${timeoutMs}ms for worker runtime exit`);
}

async function waitForFileContains(filePath, expectedText, timeoutMs) {
  const deadlineAt = Date.now() + timeoutMs;
  while (Date.now() < deadlineAt) {
    const text = readFileSync(filePath, "utf8");
    if (text.includes(expectedText)) return;
    await delay(25);
  }
  throw new Error(`${filePath} did not contain ${expectedText}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
