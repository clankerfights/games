#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

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
  const config = readConfig(paths);
  const [kind, ...args] = argv;
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
  ].join("\n");
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
