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

import {
  makeQaLedgerEmptyFailures,
  waitForLedgerGrace,
} from "./lib/qa-chaos-ledger-grace.mjs";
import {
  ensureReportDirs,
  writeReports,
  writeRunJson,
} from "./lib/qa-chaos-reporting.mjs";

const root = mkdtempSync(path.join(tmpdir(), "qa-chaos-ledger-grace-"));

try {
  await exerciseEarlyGraceExit();
  console.log("ledger grace early exit: green");
  await exerciseGraceExpiryFailure();
  console.log("ledger grace expiry failure: green");
} finally {
  rmSync(root, { recursive: true, force: true });
}

async function exerciseEarlyGraceExit() {
  const runDir = path.join(root, "early-exit");
  ensureReportDirs(runDir);
  const workers = [
    createWorker(runDir, "REST-1"),
    createWorker(runDir, "REST-2"),
  ];
  appendLedgerEntry(workers[0], "Initial action was accepted");

  const delayedLedger = setTimeout(() => {
    appendLedgerEntry(workers[1], "Game-over state was observed after completion");
  }, 80);

  try {
    const grace = await waitForLedgerGrace({
      workers,
      ledgerGraceMs: 1000,
      checkIntervalMs: 10,
    });

    assert(!grace.expired, "early case should not expire the grace budget");
    assert(
      grace.status === "all_ledgers_non_empty",
      "early case should report all ledgers non-empty",
    );
    assert(grace.elapsedMs < 1000, "early case should return before the grace budget");
    assert(
      grace.ledgerEntryCounts["REST-1"] === 1 &&
        grace.ledgerEntryCounts["REST-2"] === 1,
      "early case should record one ledger entry per worker",
    );

    const failures = makeQaLedgerEmptyFailures({
      workers,
      ledgerEntryCounts: grace.ledgerEntryCounts,
      roomCode: "EARLY",
      ledgerGraceMs: 1000,
    });
    assert(failures.length === 0, "early case should not produce QA_LEDGER_EMPTY");

    const outcome = {
      status: "passed",
      reason: null,
      finalStatus: "game_over",
      ledgerEntryCounts: grace.ledgerEntryCounts,
      ledgerGrace: { status: grace.status, elapsedMs: grace.elapsedMs },
    };
    writeRunJson(runDir, { outcome });
    const report = writeReports({
      runDir,
      expectation: "Delayed game-over ledger entry should pass before grace expires.",
      workers,
      failures,
      result: { status: "passed", outcome: "game_over" },
    });

    assert(report.failures.length === 0, "early case report should pass the gate");
    assert(
      readJson(path.join(runDir, "reports", "failures.json")).length === 0,
      "early case failures.json should be empty",
    );
    assert(
      readJson(path.join(runDir, "run.json")).outcome.ledgerEntryCounts["REST-2"] === 1,
      "early case run.json should record REST-2 ledger count",
    );
  } finally {
    clearTimeout(delayedLedger);
  }
}

async function exerciseGraceExpiryFailure() {
  const runDir = path.join(root, "grace-expired");
  ensureReportDirs(runDir);
  const workers = [
    createWorker(runDir, "REST-1"),
    createWorker(runDir, "REST-2"),
  ];
  appendLedgerEntry(workers[0], "Initial action was accepted");

  const grace = await waitForLedgerGrace({
    workers,
    ledgerGraceMs: 80,
    checkIntervalMs: 10,
  });

  assert(grace.expired, "expiry case should exhaust the grace budget");
  assert(grace.status === "grace_expired", "expiry case should report grace_expired");
  assert(grace.elapsedMs >= 70, "expiry case should wait close to the grace budget");
  assert(grace.ledgerEntryCounts["REST-2"] === 0, "expiry case should count REST-2 as empty");

  const failures = makeQaLedgerEmptyFailures({
    workers,
    ledgerEntryCounts: grace.ledgerEntryCounts,
    roomCode: "EMPTY",
    ledgerGraceMs: 80,
  });
  assert(failures.length === 1, "expiry case should produce one empty-ledger failure");
  assert(failures[0].code === "QA_LEDGER_EMPTY", "expiry code must be QA_LEDGER_EMPTY");

  const outcome = {
    status: "failed",
    reason: "QA_LEDGER_EMPTY",
    finalStatus: "game_over",
    ledgerEntryCounts: grace.ledgerEntryCounts,
    ledgerGrace: { status: grace.status, elapsedMs: grace.elapsedMs },
  };
  writeRunJson(runDir, { outcome });
  writeReports({
    runDir,
    expectation: "Empty worker ledger should fail after grace expires.",
    workers,
    failures,
    result: { status: "failed", reason: "QA_LEDGER_EMPTY", outcome: "game_over" },
  });

  const reportedFailures = readJson(path.join(runDir, "reports", "failures.json"));
  assert(
    reportedFailures.some((failure) => failure.code === "QA_LEDGER_EMPTY"),
    "expiry failures.json should contain QA_LEDGER_EMPTY",
  );
  assert(
    readJson(path.join(runDir, "run.json")).outcome.ledgerEntryCounts["REST-2"] === 0,
    "expiry run.json should record REST-2 zero ledger count",
  );
}

function createWorker(runDir, name) {
  const artifactDir = path.join(runDir, "workers", name);
  mkdirSync(artifactDir, { recursive: true });
  const testsPath = path.join(artifactDir, "tests.jsonl");
  writeFileSync(testsPath, "");
  return { name, artifactDir, testsPath };
}

function appendLedgerEntry(worker, risk) {
  appendFileSync(
    worker.testsPath,
    `${JSON.stringify({
      at: "2026-07-04T00:00:00.000Z",
      id: `${worker.name}-001`,
      worker: worker.name,
      status: "pass",
      risk,
      steps: "Synthetic offline ledger-grace exercise",
      expected: "The runner counts this non-empty tests.jsonl line",
      observed: "The line was counted",
      evidence: worker.testsPath,
    })}\n`,
  );
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
