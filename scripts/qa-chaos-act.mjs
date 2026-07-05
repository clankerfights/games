#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEST_STATUSES = new Set(["pass", "fail", "blocked"]);
const TEST_ARG_NAMES = new Set([
  "status",
  "risk",
  "id",
  "steps",
  "expected",
  "observed",
  "evidence",
  "code",
]);

if (isMainModule()) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(2);
  });
}

async function main() {
  process.exitCode = await runAct(process.argv.slice(2));
}

export async function runAct(
  argv,
  { scriptDir = SCRIPT_DIR, stdout = process.stdout } = {},
) {
  const paths = pathsFor(scriptDir);
  const [kind, ...args] = argv;
  if (kind === "test") {
    const entry = appendTestLedgerEntry(parseTestArgs(args), { scriptDir, paths });
    stdout.write(`${JSON.stringify(entry)}\n`);
    return 0;
  }

  const config = readConfig(paths);
  if (kind === "action") {
    await submitAction({ config, paths, args, stdout });
    return 0;
  }
  if (kind === "chat") {
    await submitChat({ config, paths, args, stdout });
    return 0;
  }
  throw new Error(usage());
}

export function appendTestLedgerEntry(
  input,
  { scriptDir = SCRIPT_DIR, paths = pathsFor(scriptDir), at = new Date().toISOString() } = {},
) {
  const entry = normalizeTestLedgerEntry(input, { scriptDir, paths, at });
  appendFileSync(paths.testsPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

async function submitAction({ config, paths, args, stdout }) {
  const [rawAction, actionSetId, rawExtra] = args;
  if (!rawAction || !actionSetId) throw new Error(usage());
  if (!/^\d+$/.test(rawAction)) {
    throw new Error(`action number must be a positive integer, got ${rawAction}`);
  }

  const action = Number(rawAction);
  const extra = rawExtra === undefined ? {} : parseExtra(rawExtra);
  const body = {
    ...extra,
    action,
    actionSetId,
  };
  const result = await postJson(config, "/action", body);
  appendWrite({
    paths,
    kind: "action",
    action,
    actionSetId,
    ok: result.ok,
    status: result.status,
  });
  printResponse(result, stdout);
}

async function submitChat({ config, paths, args, stdout }) {
  const [text, channel] = args;
  if (!text) throw new Error(usage());
  const body = { text };
  if (channel) body.channel = channel;
  const result = await postJson(config, "/chat", body);
  appendWrite({
    paths,
    kind: "chat",
    channel: channel ?? null,
    ok: result.ok,
    status: result.status,
  });
  printResponse(result, stdout);
}

async function postJson(config, suffix, body) {
  const url = new URL(
    `/api/rooms/${encodeURIComponent(config.roomCode)}${suffix}`,
    `${config.baseUrl.replace(/\/+$/, "")}/`,
  );
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`TRANSPORT_ERROR: ${error.message}`);
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text: await response.text(),
  };
}

function pathsFor(scriptDir) {
  return {
    configPath: path.join(scriptDir, "worker-config.json"),
    testsPath: path.join(scriptDir, "tests.jsonl"),
    writesPath: path.join(scriptDir, "writes.jsonl"),
  };
}

function readConfig(paths) {
  let text;
  try {
    text = readFileSync(paths.configPath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read ${paths.configPath}: ${error.message}`);
  }
  try {
    const config = JSON.parse(text);
    for (const key of ["baseUrl", "roomCode", "sessionToken"]) {
      if (config[key] === undefined || config[key] === null || config[key] === "") {
        throw new Error(`missing ${key}`);
      }
    }
    return config;
  } catch (error) {
    throw new Error(`Invalid ${paths.configPath}: ${error.message}`);
  }
}

function parseExtra(rawExtra) {
  try {
    const parsed = JSON.parse(rawExtra);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("extra JSON must be an object");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid extra JSON: ${error.message}`);
  }
}

function appendWrite({ paths, ...entry }) {
  appendFileSync(
    paths.writesPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      ...entry,
    })}\n`,
  );
}

function parseTestArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected test argument ${arg}\n${usage()}`);
    }
    const equalsIndex = arg.indexOf("=");
    const name = equalsIndex === -1 ? arg.slice(2) : arg.slice(2, equalsIndex);
    if (!TEST_ARG_NAMES.has(name)) {
      throw new Error(`Unknown test option --${name}\n${usage()}`);
    }
    if (Object.hasOwn(values, name)) {
      throw new Error(`Duplicate test option --${name}`);
    }
    const value = equalsIndex === -1 ? args[index + 1] : arg.slice(equalsIndex + 1);
    if (value === undefined || (equalsIndex === -1 && value.startsWith("--"))) {
      throw new Error(`--${name} requires a value`);
    }
    values[name] = value;
    if (equalsIndex === -1) index += 1;
  }
  return values;
}

function normalizeTestLedgerEntry(input, { scriptDir, paths, at }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("test entry must be an object");
  }
  const status = requiredString(input, "status").toLowerCase();
  if (!TEST_STATUSES.has(status)) {
    throw new Error(
      `--status must be one of ${Array.from(TEST_STATUSES).join("|")}, got ${input.status}`,
    );
  }
  const risk = requiredString(input, "risk");
  const worker = optionalString(input, "worker").trim() || inferWorkerName(paths, scriptDir);
  const id = optionalString(input, "id").trim() || nextTestId(paths.testsPath, worker);
  const entry = {
    at,
    id,
    worker,
    status,
    risk,
    steps: optionalString(input, "steps"),
    expected: optionalString(input, "expected"),
    observed: optionalString(input, "observed"),
    evidence: optionalString(input, "evidence"),
  };
  const code = optionalString(input, "code").trim();
  if (code) entry.code = code;
  return entry;
}

function requiredString(input, name) {
  const value = optionalString(input, name).trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function optionalString(input, name) {
  const value = input[name];
  if (value === undefined || value === null) return "";
  return String(value);
}

function inferWorkerName(paths, scriptDir) {
  try {
    const config = JSON.parse(readFileSync(paths.configPath, "utf8"));
    if (typeof config.workerName === "string" && config.workerName.trim()) {
      return config.workerName.trim();
    }
  } catch {
    // Browser workers have no REST config; their artifact directory name is stable.
  }
  return path.basename(scriptDir);
}

function nextTestId(testsPath, worker) {
  let text = "";
  try {
    text = readFileSync(testsPath, "utf8");
  } catch {
    return `${worker}-001`;
  }

  let maxIndex = 0;
  const idPattern = new RegExp(`^${escapeRegExp(worker)}-(\\d+)$`);
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  for (const [lineIndex, line] of lines.entries()) {
    maxIndex = Math.max(maxIndex, lineIndex + 1);
    try {
      const entry = JSON.parse(line);
      const match = typeof entry.id === "string" ? entry.id.match(idPattern) : null;
      if (match) maxIndex = Math.max(maxIndex, Number(match[1]));
    } catch {
      // Invalid historical lines still consume a ledger slot for monotonic IDs.
    }
  }
  return `${worker}-${String(maxIndex + 1).padStart(3, "0")}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printResponse(result, stdout) {
  if (!result.ok) {
    stdout.write(`HTTP ${result.status} ${result.statusText}\n`);
  }
  stdout.write(result.text);
  if (!result.text.endsWith("\n")) stdout.write("\n");
}

function usage() {
  return [
    "Usage:",
    "  node act.mjs action <n> <actionSetId> ['{\"args\":...}']",
    '  node act.mjs chat "<text>" [channel]',
    '  node act.mjs test --status pass|fail|blocked --risk "..." [--id X] [--steps "..."] [--expected "..."] [--observed "..."] [--evidence "..."] [--code PRIVACY_LEAK|...]',
  ].join("\n");
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
