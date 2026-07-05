#!/usr/bin/env node
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = mkdtempSync(path.join(tmpdir(), "qa-chaos-transport-"));

try {
  await exerciseTransportScripts();
} finally {
  rmSync(root, { recursive: true, force: true });
}

async function exerciseTransportScripts() {
  const workerDir = path.join(root, "workers", "REST-1");
  const requests = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        accept: request.headers.accept ?? "",
        contentType: request.headers["content-type"] ?? "",
        body,
      });
      routeRequest({ request, response, requests, body });
    });
  });

  let baseUrl;
  try {
    baseUrl = await listenLocal(server);
  } catch (error) {
    console.log(`transport scripts: BLOCKED-for-orchestrator: ${error.message}`);
    return;
  }

  try {
    mkdirSync(workerDir, { recursive: true });
    copyFileSync(path.join(__dirname, "qa-chaos-poll-loop.mjs"), path.join(workerDir, "poll-loop.mjs"));
    copyFileSync(path.join(__dirname, "qa-chaos-act.mjs"), path.join(workerDir, "act.mjs"));
    writeFileSync(
      path.join(workerDir, "worker-config.json"),
      JSON.stringify(
        {
          baseUrl,
          roomCode: "ROOM1",
          playerId: "player-rest-1",
          sessionToken: "token-rest-1",
          pollTimeoutMs: 25,
        },
        null,
        2,
      ),
    );
    writeFileSync(path.join(workerDir, "poll.jsonl"), "");
    writeFileSync(path.join(workerDir, "writes.jsonl"), "");

    const pollModule = await import(pathToFileURL(path.join(workerDir, "poll-loop.mjs")).href);
    const pollStdout = memoryWriter();
    const pollExitCode = await pollModule.runPollLoop({ stdout: pollStdout });
    assert(pollExitCode === 0, `poll-loop should exit 0, got ${pollExitCode}`);
    assert(
      pollStdout.text.includes('POLL: {"status":"your_turn","cursor":"c2"}'),
      "poll-loop should print the second poll body",
    );
    assert(readFileSync(path.join(workerDir, "cursor.txt"), "utf8") === "c2", "cursor.txt should store c2");
    assert(
      readFileSync(path.join(workerDir, "last-poll.txt"), "utf8").includes('"your_turn"'),
      "last-poll.txt should contain the latest raw poll",
    );
    const pollLines = nonEmptyLines(readFileSync(path.join(workerDir, "poll.jsonl"), "utf8"));
    assert(pollLines.length === 2, "poll.jsonl should contain two poll entries");
    assert(JSON.parse(pollLines[0]).status === "waiting", "first poll status should be waiting");
    assert(JSON.parse(pollLines[1]).status === "your_turn", "second poll status should be your_turn");

    const firstPollUrl = new URL(requests[0].url, baseUrl);
    const secondPollUrl = new URL(requests[1].url, baseUrl);
    assert(firstPollUrl.searchParams.get("timeout_ms") === "25", "poll timeout should come from worker-config");
    assert(firstPollUrl.searchParams.get("wake") === "attention", "poll should request attention wakeups");
    assert(secondPollUrl.searchParams.get("cursor") === "c1", "second poll should use the stored first cursor");
    assert(
      requests.slice(0, 2).every((entry) => entry.authorization === "Bearer token-rest-1"),
      "poll requests should use the worker Bearer token",
    );
    assert(
      requests.slice(0, 2).every((entry) => !/application\/json/i.test(entry.accept)),
      "poll requests should not request JSON format",
    );

    const actModule = await import(pathToFileURL(path.join(workerDir, "act.mjs")).href);
    const actStdout = memoryWriter();
    const actExitCode = await actModule.runAct(["action", "2", "set-9", '{"args":{"cell":4}}'], {
      stdout: actStdout,
    });
    assert(actExitCode === 0, `act.mjs should exit 0, got ${actExitCode}`);
    assert(actStdout.text.includes('POLL: {"status":"waiting","cursor":"c3"}'), "act.mjs should print response text");
    const actionRequest = requests.find((entry) => entry.url === "/api/rooms/ROOM1/action");
    assert(actionRequest, "act.mjs should POST /action");
    assert(actionRequest.authorization === "Bearer token-rest-1", "action should use the worker Bearer token");
    assert(/application\/json/i.test(actionRequest.contentType), "action should send JSON");
    assert(
      JSON.stringify(JSON.parse(actionRequest.body)) ===
        JSON.stringify({ args: { cell: 4 }, action: 2, actionSetId: "set-9" }),
      "action body should include action number, actionSetId, and args",
    );
    const writeLines = nonEmptyLines(readFileSync(path.join(workerDir, "writes.jsonl"), "utf8"));
    assert(writeLines.length === 1, "writes.jsonl should contain one action entry");
    const writeEntry = JSON.parse(writeLines[0]);
    assert(writeEntry.kind === "action", "writes entry should be kind action");
    assert(writeEntry.action === 2, "writes entry should record action 2");
    assert(writeEntry.actionSetId === "set-9", "writes entry should record actionSetId");

    console.log("poll-loop local stub: green");
    console.log("act helper local stub: green");
  } finally {
    await closeServer(server);
  }
}

function routeRequest({ request, response, requests }) {
  if (request.method === "GET" && request.url.startsWith("/api/rooms/ROOM1/poll")) {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    if (requests.filter((entry) => entry.url.startsWith("/api/rooms/ROOM1/poll")).length === 1) {
      response.end('POLL: {"status":"waiting","cursor":"c1"}\nATTENTION: none\n');
      return;
    }
    response.end('POLL: {"status":"your_turn","cursor":"c2"}\nTOOLS: submit_action\nACTION_SET: set-9\n');
    return;
  }
  if (request.method === "POST" && request.url === "/api/rooms/ROOM1/action") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end('POLL: {"status":"waiting","cursor":"c3"}\n');
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("not found\n");
}

function listenLocal(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function nonEmptyLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "");
}

function memoryWriter() {
  return {
    text: "",
    write(chunk) {
      this.text += String(chunk);
    },
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
