#!/usr/bin/env node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeReports } from "./lib/qa-chaos-reporting.mjs";

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "qa-chaos-worker-failure-"));

try {
  const workerDir = path.join(tempRoot, "workers", "REST-1");
  const runDir = path.join(tempRoot, "run");
  mkdirSync(workerDir, { recursive: true });
  mkdirSync(path.join(runDir, "reports"), { recursive: true });
  const testsPath = path.join(workerDir, "tests.jsonl");
  writeFileSync(
    testsPath,
    [
      JSON.stringify({
        id: "REST-1-privacy",
        worker: "REST-1",
        status: "fail",
        code: "PRIVACY_LEAK",
        observed: "private card text visible",
      }),
      JSON.stringify({
        id: "REST-1-unknown",
        worker: "REST-1",
        status: "failed",
        code: "ODD_ASSERTION",
        observed: "worker-specific assertion failed",
      }),
      JSON.stringify({
        id: "REST-1-pass",
        worker: "REST-1",
        status: "pass",
      }),
      "",
    ].join("\n"),
  );

  const report = writeReports({
    runDir,
    expectation: "Synthetic worker failure promotion exercise.",
    workers: [{ name: "REST-1", testsPath }],
    failures: [],
    result: { status: "passed", actionCount: 0 },
  });

  console.log(
    JSON.stringify(
      {
        promotedCodes: report.failures.map((failure) => failure.code),
        failuresJson: JSON.parse(
          readFileSync(path.join(runDir, "reports", "failures.json"), "utf8"),
        ),
        summaryGateLine: readFileSync(
          path.join(runDir, "reports", "summary.md"),
          "utf8",
        )
          .split(/\r?\n/)
          .find((line) => line.startsWith("- Gate:")),
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
