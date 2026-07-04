#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  countWorkerActionSubmissions,
  observedActionCount,
} from "./lib/qa-chaos-action-budget.mjs";
import { extractActionCount } from "./lib/qa-chaos-rest-client.mjs";

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "qa-chaos-action-budget-"));

try {
  const restWrites = path.join(tempRoot, "rest-writes.jsonl");
  const uiWrites = path.join(tempRoot, "ui-writes.jsonl");
  writeFileSync(
    restWrites,
    [
      JSON.stringify({ type: "poll", cursor: "c1" }),
      JSON.stringify({
        type: "action",
        worker: "REST-1",
        actionSetId: "set-1",
        decision: "move",
      }),
      JSON.stringify({
        method: "POST",
        url: "http://localhost:3000/api/rooms/ABCD/action",
      }),
      "",
    ].join("\n"),
  );
  writeFileSync(
    uiWrites,
    [
      JSON.stringify({ event: "observation", phase: "lobby" }),
      JSON.stringify({
        kind: "action",
        worker: "UI-1",
        phase: "main",
        gesture: "click",
      }),
      "",
    ].join("\n"),
  );

  const workers = [
    { name: "REST-1", writesPath: restWrites },
    { name: "UI-1", writesPath: uiWrites },
  ];
  const workerActions = countWorkerActionSubmissions(workers);
  const initialTurnNumber = extractActionCount({
    version: 1,
    state: { turnNumber: 10 },
  });
  const currentTurnNumber = extractActionCount({
    version: 2,
    changed: true,
    state: { turnNumber: 14 },
    agentView: {},
  });
  const observed = observedActionCount({
    workerActionCount: workerActions.actionCount,
    initialTurnNumber,
    currentTurnNumber,
  });

  console.log(
    JSON.stringify(
      {
        workerActionCount: workerActions.actionCount,
        countedWorkers: workerActions.countedEntries.map((entry) => entry.worker),
        initialTurnNumber,
        currentTurnNumber,
        observedActionCount: observed.actionCount,
        turnDelta: observed.turnDelta,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
