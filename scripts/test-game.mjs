#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const gameDir = process.argv[2];
const args = process.argv.slice(3);

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function arg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

function usage() {
  console.error(
    "Usage: node scripts/test-game.mjs <game-directory> [--ui] [--all] [--seeds 42,1337] [--ticks N] [--max-snapshots N] [--strict-agent-lint]",
  );
}

if (!gameDir) {
  usage();
  process.exit(1);
}

const absDir = path.resolve(gameDir);
if (!existsSync(path.join(absDir, "manifest.json"))) {
  console.error(`Missing manifest.json in ${absDir}`);
  process.exit(1);
}

const includeUi = hasFlag("ui") || hasFlag("all");
const includeScenarios = !hasFlag("no-scenarios");
const seeds = arg("seeds", arg("seed", "42"));
const ticks = arg("ticks", "");
const maxSnapshots = arg("max-snapshots", "");
const failures = [];

function runStep(name, commandArgs) {
  console.log(`\n=== ${name} ===`);
  console.log(`${process.execPath} ${commandArgs.join(" ")}`);
  const result = spawnSync(process.execPath, commandArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
    shell: false,
  });
  if (result.error) {
    console.error(`${name} failed to launch: ${result.error.message}`);
    failures.push(name);
    return;
  }
  if (result.status !== 0) failures.push(name);
}

const logicArgs = [
  "scripts/test-game-logic.mjs",
  gameDir,
  "--sweep",
  "--seeds",
  seeds,
];
if (ticks) logicArgs.push("--ticks", ticks);
if (hasFlag("trace")) logicArgs.push("--trace");
if (hasFlag("strict-agent-lint")) logicArgs.push("--strict-agent-lint");
runStep("Logic contract and simulation", logicArgs);

if (includeScenarios) {
  const scenarioFile = arg("scenario-file", "scenarios.json");
  const scenarioPath = path.resolve(absDir, scenarioFile);
  if (existsSync(scenarioPath)) {
    const scenarioArgs = [
      "scripts/test-game-scenarios.mjs",
      gameDir,
      "--file",
      scenarioFile,
    ];
    if (hasFlag("trace")) scenarioArgs.push("--trace");
    runStep("Scenario fixtures", scenarioArgs);
  } else {
    console.log(`\n=== Scenario fixtures ===`);
    console.log(`No ${scenarioFile} file found; skipping optional scenarios.`);
  }
}

if (includeUi) {
  const uiArgs = ["scripts/test-game-ui.mjs", gameDir];
  if (maxSnapshots) uiArgs.push("--max-snapshots", maxSnapshots);
  if (arg("ui-seed", "")) uiArgs.push("--seed", arg("ui-seed", ""));
  runStep("Browser UI compatibility", uiArgs);
}

console.log("\n-------------------------------------------");
console.log("  GAME GAUNTLET REPORT");
console.log("-------------------------------------------");
console.log(`  Game:       ${gameDir}`);
console.log(`  Logic:      sweep, seeds ${seeds}`);
console.log(`  Scenarios:  ${includeScenarios ? "optional" : "skipped"}`);
console.log(`  UI:         ${includeUi ? "included" : "skipped"}`);
if (failures.length > 0) {
  console.log(`  Status:     FAIL (${failures.join(", ")})`);
  console.log("-------------------------------------------\n");
  process.exit(1);
}
console.log("  Status:     PASS");
console.log("-------------------------------------------\n");
