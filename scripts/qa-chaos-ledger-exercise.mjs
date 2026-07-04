#!/usr/bin/env node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { appendTestLedgerEntry } from "./qa-chaos-act.mjs";
import { writeReports } from "./lib/qa-chaos-reporting.mjs";

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const root = mkdtempSync(path.join(tmpdir(), "qa-chaos-ledger-"));
  try {
    const workerDir = path.join(root, "REST-1");
    mkdirSync(workerDir, { recursive: true });
    writeFileSync(
      path.join(workerDir, "worker-config.json"),
      `${JSON.stringify({ workerName: "REST-1" }, null, 2)}\n`,
    );
    const testsPath = path.join(workerDir, "tests.jsonl");
    writeFileSync(testsPath, "");

    const helperEntry = appendTestLedgerEntry(
      {
        status: "pass",
        risk: "Helper generated ledger entry is parseable",
        steps: "Call appendTestLedgerEntry in-process",
        expected: "A single JSONL object is appended",
        observed: "A single JSONL object was appended",
        evidence: "exercise temp ledger",
      },
      { scriptDir: workerDir, at: "2026-07-04T00:00:00.000Z" },
    );

    assert(helperEntry.id === "REST-1-001", "helper should auto-id as REST-1-001");
    assert(helperEntry.worker === "REST-1", "helper should infer worker from config");
    const helperLines = readNonEmptyLines(testsPath);
    assert(helperLines.length === 1, "helper should append exactly one JSONL line");
    assert(JSON.parse(helperLines[0]).risk === helperEntry.risk, "helper line should parse");

    const failingEntry = {
      at: "2026-07-04T00:01:00.000Z",
      id: "REST-1-002",
      worker: "REST-1",
      status: "fail",
      risk: "Privacy leak report promotion",
      steps: "Report a parsed failing worker test",
      expected: "Reporter promotes the failure",
      observed: "Reporter promoted the failure",
      evidence: "synthetic failure",
      code: "PRIVACY_LEAK",
    };
    writeFileSync(
      testsPath,
      [
        JSON.stringify(helperEntry),
        "id:REST-1-999 worker:REST-1 risk:prose status:pass evidence:not-json",
        JSON.stringify(failingEntry),
        "",
      ].join("\n"),
    );

    const runDir = path.join(root, "run");
    mkdirSync(path.join(runDir, "reports"), { recursive: true });
    const report = writeReports({
      runDir,
      expectation: "Exercise invalid ledger preservation and failure derivation.",
      workers: [{ name: "REST-1", testsPath }],
      failures: [],
      result: { status: "passed" },
    });

    const cases = readJson(path.join(runDir, "reports", "test-cases.json"));
    const failures = readJson(path.join(runDir, "reports", "failures.json"));
    const summary = readFileSync(path.join(runDir, "reports", "summary.md"), "utf8");
    const invalidCases = cases.filter((testCase) => testCase.format === "invalid");

    assert(report.cases.length === 3, "report should return 3 test cases");
    assert(cases.length === 3, "test-cases.json should contain 3 entries");
    assert(invalidCases.length === 1, "test-cases.json should preserve one invalid line");
    assert(invalidCases[0].raw.includes("risk:prose"), "invalid entry should preserve raw text");
    assert(invalidCases[0].worker === "REST-1", "invalid entry should preserve worker");
    assert(invalidCases[0].line === 2, "invalid entry should preserve line number");
    assert(
      !failures.some((failure) => failure.code === "QA_TEST_LEDGER_INVALID"),
      "invalid prose line should not become QA_TEST_LEDGER_INVALID",
    );
    assert(
      failures.some((failure) => failure.code === "PRIVACY_LEAK"),
      "parsed fail status should land in failures.json",
    );
    assert(failures.length === 1, "only the parsed failing case should fail the gate");
    assert(summary.includes("WARN"), "summary should include a WARN note");
    assert(summary.includes("ignored for gate"), "summary should note invalid line is ignored");

    console.log("qa-chaos ledger exercise passed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function readNonEmptyLines(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
