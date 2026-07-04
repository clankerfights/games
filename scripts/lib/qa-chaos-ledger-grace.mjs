import { existsSync, readFileSync } from "node:fs";

import { makeFailure } from "./qa-chaos-reporting.mjs";

export function countWorkerLedgerEntries(workers) {
  return Object.fromEntries(
    workers.map((worker) => [worker.name, countLedgerEntries(worker.testsPath)]),
  );
}

export async function waitForLedgerGrace({
  workers,
  ledgerGraceMs,
  checkIntervalMs = 1000,
  delayFn = delay,
  nowFn = () => Date.now(),
}) {
  const startedAt = nowFn();
  const deadlineAt = startedAt + ledgerGraceMs;
  let ledgerEntryCounts = countWorkerLedgerEntries(workers);
  if (allLedgersNonEmpty(ledgerEntryCounts)) {
    return {
      status: "all_ledgers_non_empty",
      expired: false,
      elapsedMs: 0,
      ledgerEntryCounts,
    };
  }

  while (true) {
    const now = nowFn();
    if (now >= deadlineAt) {
      return {
        status: "grace_expired",
        expired: true,
        elapsedMs: now - startedAt,
        ledgerEntryCounts,
      };
    }

    await delayFn(Math.min(checkIntervalMs, deadlineAt - now));
    ledgerEntryCounts = countWorkerLedgerEntries(workers);
    if (allLedgersNonEmpty(ledgerEntryCounts)) {
      return {
        status: "all_ledgers_non_empty",
        expired: false,
        elapsedMs: nowFn() - startedAt,
        ledgerEntryCounts,
      };
    }
  }
}

export function makeQaLedgerEmptyFailures({
  workers,
  ledgerEntryCounts,
  roomCode,
  ledgerGraceMs,
}) {
  return workers
    .filter((worker) => (ledgerEntryCounts[worker.name] ?? 0) === 0)
    .map((worker) =>
      makeFailure(
        "QA_LEDGER_EMPTY",
        "high",
        `${worker.name} tests.jsonl had zero entries after ledger grace expired`,
        {
          roomCode,
          worker: worker.name,
          testsPath: worker.testsPath,
          ledgerEntryCount: ledgerEntryCounts[worker.name] ?? 0,
          ledgerGraceMs,
        },
        "Keep workers alive after game_over long enough to append at least one QA ledger entry.",
      ),
    );
}

function countLedgerEntries(testsPath) {
  if (!testsPath || !existsSync(testsPath)) return 0;
  try {
    return readFileSync(testsPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "").length;
  } catch {
    return 0;
  }
}

function allLedgersNonEmpty(ledgerEntryCounts) {
  const counts = Object.values(ledgerEntryCounts);
  return counts.length > 0 && counts.every((count) => count >= 1);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
