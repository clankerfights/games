#!/usr/bin/env node
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ensureReportDirs, writeFailures } from "./lib/qa-chaos-reporting.mjs";
import { startAfterRestWorkersReady } from "./lib/qa-chaos-workers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "qa-chaos-ready-barrier-"));

try {
  await exerciseReadyWorker();
  console.log("ready within budget: green");
  await exerciseBootTimeout();
  console.log("timeout before start: green");
} finally {
  rmSync(root, { recursive: true, force: true });
}

async function exerciseReadyWorker() {
  const workerDir = path.join(root, "ready", "workers", "REST-1");
  mkdirSync(workerDir, { recursive: true });
  const pollPath = path.join(workerDir, "poll.jsonl");
  writeFileSync(pollPath, "");

  let startCalls = 0;
  const nonJsonWriter = setTimeout(() => {
    writeFileSync(pollPath, "POLL: {\"status\":\"lobby\"}\n");
  }, 30);
  const jsonWriter = setTimeout(() => {
    appendFileSync(
      pollPath,
      `${JSON.stringify({ at: "2026-07-04T00:00:00.000Z", kind: "poll", status: "started" })}\n`,
    );
  }, 150);

  try {
    const result = await startAfterRestWorkersReady({
      restWorkers: [{ name: "REST-1", artifactDir: workerDir, pollPath }],
      roomCode: "READY",
      workerBootMs: 100,
      checkIntervalMs: 10,
      start: () => {
        startCalls += 1;
        const linesAtStart = nonEmptyLines(readFileSync(pollPath, "utf8"));
        assert(linesAtStart.length === 1, "ready case should unblock on the first non-empty line");
        assert(
          linesAtStart[0].startsWith("POLL:"),
          "ready case should tolerate a non-JSON poll line before JSON diagnostics arrive",
        );
        return "started";
      },
    });
    assert(result === "started", "ready case should return the start callback result");
    assert(startCalls === 1, "ready case should invoke start exactly once");
    await delay(170);
    const finalLines = nonEmptyLines(readFileSync(pollPath, "utf8"));
    assert(finalLines.length === 2, "ready case should contain the non-JSON line plus a JSON line");
    assert(finalLines[0].startsWith("POLL:"), "ready case first line should remain non-JSON");
    assert(
      JSON.parse(finalLines[1]).kind === "poll",
      "ready case second line should be parseable JSON diagnostics",
    );
  } finally {
    clearTimeout(nonJsonWriter);
    clearTimeout(jsonWriter);
  }
}

async function exerciseBootTimeout() {
  const runDir = path.join(root, "timeout");
  ensureReportDirs(runDir);
  const workerDir = path.join(runDir, "workers", "REST-1");
  mkdirSync(workerDir, { recursive: true });
  const pollPath = path.join(workerDir, "poll.jsonl");
  writeFileSync(pollPath, "");

  let startCalls = 0;
  let failure = null;
  try {
    await startAfterRestWorkersReady({
      restWorkers: [{ name: "REST-1", artifactDir: workerDir, pollPath }],
      roomCode: "TIMEOUT",
      workerBootMs: 50,
      checkIntervalMs: 10,
      start: () => {
        startCalls += 1;
      },
    });
  } catch (error) {
    failure = error.qaChaosFailure ?? null;
  }

  assert(failure?.code === "WORKER_BOOT_TIMEOUT", "timeout case should fail with WORKER_BOOT_TIMEOUT");
  assert(startCalls === 0, "timeout case must not invoke start");

  writeFailures(runDir, [failure]);
  const failuresPath = path.join(runDir, "reports", "failures.json");
  const failures = JSON.parse(readFileSync(failuresPath, "utf8"));
  assert(
    failures[0]?.code === "WORKER_BOOT_TIMEOUT",
    "timeout case should write WORKER_BOOT_TIMEOUT to failures.json",
  );
  assert(
    failures[0]?.evidence?.neverReadyWorkers?.includes("REST-1"),
    "timeout failure should name the never-ready worker",
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nonEmptyLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
