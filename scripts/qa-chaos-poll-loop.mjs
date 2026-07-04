#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MAX_ITERATIONS = 60;
const MAX_NETWORK_RETRIES = 5;

if (isMainModule()) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(2);
  });
}

async function main() {
  process.exitCode = await runPollLoop();
}

export async function runPollLoop({ scriptDir = SCRIPT_DIR, stdout = process.stdout } = {}) {
  const paths = pathsFor(scriptDir);
  const config = readConfig(paths);
  let cursor = readCursor(paths);
  let latestPoll = "";
  let networkFailures = 0;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    let responseText;
    try {
      responseText = await poll(config, cursor);
      networkFailures = 0;
    } catch (error) {
      networkFailures += 1;
      if (networkFailures > MAX_NETWORK_RETRIES) {
        const message = `TRANSPORT_ERROR: ${error.message}`;
        stdout.write(`${message}\n`);
        return 2;
      }
      await delay(backoffMs(networkFailures));
      iteration -= 1;
      continue;
    }

    latestPoll = responseText;
    const pollJson = parsePollJson(responseText);
    const nextCursor = extractCursor(responseText, pollJson);
    if (nextCursor) {
      cursor = nextCursor;
      writeFileSync(paths.cursorPath, cursor);
    }

    const status = statusText(pollJson?.status);
    writeFileSync(paths.lastPollPath, responseText);
    appendPollEntry({ paths, status });

    if (shouldWakeModel({ responseText, pollJson, status, config })) {
      stdout.write(responseText);
      if (!responseText.endsWith("\n")) stdout.write("\n");
      return 0;
    }
  }

  stdout.write(latestPoll);
  if (latestPoll && !latestPoll.endsWith("\n")) stdout.write("\n");
  return 0;
}

function pathsFor(scriptDir) {
  return {
    scriptDir,
    configPath: path.join(scriptDir, "worker-config.json"),
    cursorPath: path.join(scriptDir, "cursor.txt"),
    pollPath: path.join(scriptDir, "poll.jsonl"),
    lastPollPath: path.join(scriptDir, "last-poll.txt"),
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
    for (const key of ["baseUrl", "roomCode", "playerId", "sessionToken", "pollTimeoutMs"]) {
      if (config[key] === undefined || config[key] === null || config[key] === "") {
        throw new Error(`missing ${key}`);
      }
    }
    return {
      ...config,
      workerName: config.workerName ?? path.basename(paths.scriptDir),
      pollTimeoutMs: Number(config.pollTimeoutMs),
    };
  } catch (error) {
    throw new Error(`Invalid ${paths.configPath}: ${error.message}`);
  }
}

function readCursor(paths) {
  if (!existsSync(paths.cursorPath)) return "";
  return readFileSync(paths.cursorPath, "utf8").trim();
}

async function poll(config, cursor) {
  const url = new URL(
    `/api/rooms/${encodeURIComponent(config.roomCode)}/poll`,
    `${config.baseUrl.replace(/\/+$/, "")}/`,
  );
  if (cursor) url.searchParams.set("cursor", cursor);
  url.searchParams.set("timeout_ms", String(config.pollTimeoutMs));
  url.searchParams.set("wake", "attention");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.sessionToken}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${truncate(text, 500)}`);
  }
  return text;
}

function parsePollJson(text) {
  const pollLine = text.split(/\r?\n/).find((line) => /^\s*POLL:\s*/i.test(line));
  if (!pollLine) return null;
  const jsonText = pollLine.replace(/^\s*POLL:\s*/i, "");
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function extractCursor(text, pollJson) {
  for (const value of [pollJson?.cursor, pollJson?.nextCursor, pollJson?.pollCursor]) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }

  const cursorLine = text
    .split(/\r?\n/)
    .find((line) => /^\s*(CURSOR|NEXT_CURSOR|NEXT CURSOR|POLL_CURSOR):\s*/i.test(line));
  if (!cursorLine) return "";
  return cursorLine.replace(/^\s*(CURSOR|NEXT_CURSOR|NEXT CURSOR|POLL_CURSOR):\s*/i, "").trim();
}

function appendPollEntry({ paths, status }) {
  appendFileSync(
    paths.pollPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      kind: "poll",
      status,
    })}\n`,
  );
}

function shouldWakeModel({ responseText, pollJson, status, config }) {
  if (lineContains(responseText, /^TOOLS:\s*/i, /submit_action/i)) return true;
  if (/^your_turn$/i.test(status)) return true;
  if (/game[_-]?over/i.test(status)) return true;
  if (/^\s*RESULT\b/im.test(responseText)) return true;
  return attentionMentionsWorker({ responseText, pollJson, config });
}

function lineContains(text, labelPattern, valuePattern) {
  return text
    .split(/\r?\n/)
    .some((line) => labelPattern.test(line) && valuePattern.test(line));
}

function attentionMentionsWorker({ responseText, pollJson, config }) {
  const candidates = [config.workerName, config.playerId]
    .filter((value) => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim().toLowerCase());
  if (candidates.length === 0) return false;

  const attentionText = responseText
    .split(/\r?\n/)
    .filter((line) => /^\s*ATTENTION\b/i.test(line))
    .join("\n")
    .toLowerCase();
  const pollAttention =
    pollJson && Object.hasOwn(pollJson, "attention")
      ? JSON.stringify(pollJson.attention).toLowerCase()
      : "";
  const combined = `${attentionText}\n${pollAttention}`;
  return candidates.some((candidate) => combined.includes(candidate));
}

function statusText(value) {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (value === undefined || value === null) return "unknown";
  return String(value);
}

function backoffMs(failureCount) {
  return Math.min(4000, 250 * 2 ** (failureCount - 1));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
