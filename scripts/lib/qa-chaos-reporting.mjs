import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function createRunLayout({ outDir, timestamp, gameSlug, runIndex, totalRuns }) {
  const sessionDir = path.join(outDir, `${timestamp}-qa-chaos-${gameSlug}`);
  if (totalRuns === 1) return sessionDir;
  return path.join(sessionDir, `run-${String(runIndex).padStart(2, "0")}`);
}

export function ensureReportDirs(runDir) {
  mkdirSync(path.join(runDir, "workers"), { recursive: true });
  mkdirSync(path.join(runDir, "reports"), { recursive: true });
}

export function writeRunJson(runDir, runJson) {
  writeJson(path.join(runDir, "run.json"), runJson);
}

export function writeFailures(runDir, failures) {
  writeJson(path.join(runDir, "reports", "failures.json"), failures);
}

export function aggregateWorkerTests(workers) {
  const cases = [];
  const parseFailures = [];
  for (const worker of workers) {
    if (!existsSync(worker.testsPath)) continue;
    const lines = readFileSync(worker.testsPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    for (const [index, line] of lines.entries()) {
      try {
        cases.push(JSON.parse(line));
      } catch (error) {
        parseFailures.push({
          worker: worker.name,
          line: index + 1,
          error: error.message,
          raw: line,
        });
      }
    }
  }
  return { cases, parseFailures };
}

export function writeReports({ runDir, expectation, workers, failures, result }) {
  const { cases, parseFailures } = aggregateWorkerTests(workers);
  writeJson(path.join(runDir, "reports", "test-cases.json"), cases);
  const allFailures = [...failures];
  for (const parseFailure of parseFailures) {
    allFailures.push({
      code: "QA_TEST_LEDGER_INVALID",
      severity: "medium",
      message: `Invalid tests.jsonl entry from ${parseFailure.worker} line ${parseFailure.line}`,
      evidence: parseFailure,
      fixHint: "Write one valid JSON object per tests.jsonl line.",
    });
  }
  writeFailures(runDir, allFailures);
  writeFileSync(
    path.join(runDir, "reports", "summary.md"),
    renderSummary({ expectation, cases, failures: allFailures, result }),
  );
  return { cases, failures: allFailures };
}

export function makeFailure(code, severity, message, evidence, fixHint) {
  return { code, severity, message, evidence, fixHint };
}

export function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderSummary({ expectation, cases, failures, result }) {
  const lines = [];
  lines.push("# QA Chaos Summary");
  lines.push("");
  lines.push("## Expectation");
  lines.push("");
  lines.push(expectation);
  lines.push("");
  lines.push("## QA Test Cases");
  lines.push("");
  if (cases.length === 0) {
    lines.push("- No worker test cases were recorded.");
  } else {
    for (const testCase of cases) {
      const id = testCase.id ?? "(no id)";
      const status = testCase.status ?? "(no status)";
      const risk = testCase.risk ?? "(no risk)";
      lines.push(`- ${id}: ${status} - ${risk}`);
    }
  }
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push(`- Status: ${result.status}`);
  lines.push(`- Gate: ${failures.length === 0 ? "pass" : "fail"}`);
  if (result.outcome) lines.push(`- Outcome: ${result.outcome}`);
  if (result.reason) lines.push(`- Reason: ${result.reason}`);
  if (result.actionCount !== undefined && result.actionCount !== null) {
    lines.push(`- Observed actions: ${result.actionCount}`);
  }
  if (failures.length > 0) {
    lines.push("");
    lines.push("Failures:");
    for (const failure of failures) {
      lines.push(`- ${failure.code}: ${failure.message}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
