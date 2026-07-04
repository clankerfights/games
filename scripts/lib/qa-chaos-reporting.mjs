import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RECOGNIZED_WORKER_FAILURE_CODES = new Set([
  "PRIVACY_LEAK",
  "EXPECTATION_MISMATCH",
  "BROWSER_BYPASS",
  "UI_LAYOUT_FAILURE",
  "ACTION_REJECTED",
  "ACTION_TIMEOUT",
  "CHAT_PRIVACY_LEAK",
]);

export function createRunLayout({ outDir, timestamp, gameSlug, runIndex, totalRuns }) {
  const sessionDir = path.join(outDir, `${timestamp}-qa-chaos-${gameSlug}`);
  if (totalRuns === 1) return sessionDir;
  return path.join(sessionDir, `run-${String(runIndex).padStart(2, "0")}`);
}

export function createSweepLayout({ outDir, timestamp }) {
  return path.join(outDir, `${timestamp}-qa-chaos-sweep`);
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
  const caseSources = [];
  const parseFailures = [];
  for (const worker of workers) {
    if (!existsSync(worker.testsPath)) continue;
    const lines = readFileSync(worker.testsPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    for (const [index, line] of lines.entries()) {
      try {
        const entry = JSON.parse(line);
        cases.push(entry);
        caseSources.push({ worker: worker.name, line: index + 1, entry });
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
  return { cases, caseSources, parseFailures };
}

export function writeReports({ runDir, expectation, workers, failures, result }) {
  const { cases, caseSources, parseFailures } = aggregateWorkerTests(workers);
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
  allFailures.push(...collectWorkerReportedFailures(caseSources));
  writeFailures(runDir, allFailures);
  writeFileSync(
    path.join(runDir, "reports", "summary.md"),
    renderSummary({ expectation, cases, failures: allFailures, result }),
  );
  return { cases, failures: allFailures };
}

export function collectWorkerReportedFailures(caseSources) {
  const failures = [];
  for (const source of caseSources) {
    const entry = source.entry;
    if (!isWorkerFailureStatus(entry?.status)) continue;
    const rawCode = typeof entry.code === "string" ? entry.code.trim() : "";
    const code = RECOGNIZED_WORKER_FAILURE_CODES.has(rawCode)
      ? rawCode
      : "WORKER_REPORTED_FAILURE";
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id : "(no id)";
    const worker =
      typeof entry.worker === "string" && entry.worker.trim()
        ? entry.worker
        : source.worker;
    failures.push({
      code,
      severity: code === "PRIVACY_LEAK" ? "critical" : "high",
      message: `Worker ${worker} reported failed QA case ${id}`,
      evidence: {
        worker: source.worker,
        line: source.line,
        entry,
        originalCode: rawCode || null,
      },
      fixHint: "Inspect the worker test ledger evidence and reproduce the reported failure.",
    });
  }
  return failures;
}

export function writeSweepReports({ sweepDir, results }) {
  mkdirSync(path.join(sweepDir, "reports"), { recursive: true });
  const byGame = Object.fromEntries(
    results.map((result) => [
      result.game,
      {
        status: result.status,
        failureCodes: result.failureCodes,
        durationMs: result.durationMs,
        runDir: result.runDir,
      },
    ]),
  );
  writeJson(path.join(sweepDir, "reports", "sweep-results.json"), byGame);
  writeFileSync(
    path.join(sweepDir, "reports", "sweep-summary.md"),
    renderSweepSummary(results),
  );
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

function isWorkerFailureStatus(status) {
  return typeof status === "string" && /^(fail|failed|failure|error)$/i.test(status.trim());
}

function renderSweepSummary(results) {
  const lines = [];
  lines.push("# QA Chaos Sweep Summary");
  lines.push("");
  lines.push(`- Games: ${results.length}`);
  lines.push(`- Gate: ${results.some((result) => result.status === "fail") ? "fail" : "pass"}`);
  lines.push("");
  lines.push("| Game | Status | Failure Codes | Duration (ms) |");
  lines.push("| --- | --- | --- | ---: |");
  for (const result of results) {
    lines.push(
      `| ${result.game} | ${result.status} | ${result.failureCodes.join(", ") || "-"} | ${result.durationMs} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
