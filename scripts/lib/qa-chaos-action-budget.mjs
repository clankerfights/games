import { existsSync, readFileSync } from "node:fs";

export function countWorkerActionSubmissions(workers) {
  let actionCount = 0;
  const countedEntries = [];
  const parseFailures = [];

  for (const worker of workers) {
    if (!worker.writesPath || !existsSync(worker.writesPath)) continue;
    const result = countActionWritesText(
      readFileSync(worker.writesPath, "utf8"),
      worker.name,
    );
    actionCount += result.actionCount;
    countedEntries.push(...result.countedEntries);
    parseFailures.push(...result.parseFailures);
  }

  return { actionCount, countedEntries, parseFailures };
}

export function countActionWritesText(text, workerName = "(unknown worker)") {
  const countedEntries = [];
  const parseFailures = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      parseFailures.push({
        worker: workerName,
        line: index + 1,
        error: error.message,
        raw: line,
      });
      continue;
    }
    if (!isActionWriteEntry(entry)) continue;
    countedEntries.push({ worker: workerName, line: index + 1, entry });
  }

  return {
    actionCount: countedEntries.length,
    countedEntries,
    parseFailures,
  };
}

export function observedActionCount({
  workerActionCount,
  currentTurnNumber,
  initialTurnNumber,
}) {
  const turnDelta =
    Number.isInteger(currentTurnNumber) && Number.isInteger(initialTurnNumber)
      ? Math.max(0, currentTurnNumber - initialTurnNumber)
      : 0;
  return {
    actionCount: Math.max(workerActionCount, turnDelta),
    workerActionCount,
    turnDelta,
  };
}

export function isActionWriteEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const marker = firstString(entry, ["type", "kind", "event", "category"]);
  if (marker && /^action(_submission)?$/i.test(marker)) return true;

  const method = firstString(entry, ["method", "request.method"]);
  const target = firstString(entry, [
    "url",
    "endpoint",
    "path",
    "request.url",
    "request.endpoint",
    "request.path",
  ]);
  if (target && /\/action(?:\?|$)/i.test(target)) {
    return !method || method.toUpperCase() === "POST";
  }

  return (
    Object.hasOwn(entry, "actionSetId") &&
    (Object.hasOwn(entry, "decision") || Object.hasOwn(entry, "action"))
  );
}

function firstString(object, paths) {
  for (const path of paths) {
    const value = getPath(object, path);
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return current[key];
  }, object);
}
