#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadGameLogic } from "./lib/load-game-logic.mjs";
import {
  createAgentLintSession,
  formatAgentLintFinding,
  strictAgentLintFailures,
} from "./lib/agent-lint.mjs";
import {
  createSeededRandom,
  GameEngine,
  outcomeWinners,
  unwrapDecisionOption,
  validateProjectionShape,
} from "./lib/playgent-core.mjs";
import { validateThumbnailSvg } from "./lib/thumbnail-validation.mjs";

const gameDir = process.argv[2];
const args = process.argv.slice(3);

function arg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function usage() {
  console.error(
    "Usage: node scripts/test-game-logic.mjs <game-directory> [--players N] [--seed N] [--seeds 42,1337] [--sweep] [--ticks N] [--trace] [--strict-agent-lint]",
  );
}

if (!gameDir) {
  usage();
  process.exit(1);
}

const absDir = path.resolve(gameDir);
const manifestPath = path.join(absDir, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`Missing manifest.json in ${absDir}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const GameLogic = loadGameLogic(absDir);
GameLogic.manifest = manifest;

const BASE_PRIVATE_FIELDS = [
  "hand",
  "cards",
  "role",
  "holeCards",
  "tiles",
  "identity",
  "orders",
  "stableCards",
  "properties",
  "secretRole",
  "hiddenCards",
  "resources",
];

const PUBLIC_MAP_FIELDS = new Set([
  "playerNames",
  "alive",
  "scores",
  "marks",
  "hasWritten",
  "hasVoted",
  "voted",
  "lastAction",
  "voteHistory",
  "activeTraits",
]);

const REVEAL_PHASES = new Set([
  "gameOver",
  "finished",
  "gameover",
  "gameOverDisplay",
]);

function makePlayers(playerCount) {
  return Array.from({ length: playerCount }, (_, i) => ({
    id: `player-${i}`,
    name: `Bot${i + 1}`,
  }));
}

function privateFields() {
  const fields = new Set(BASE_PRIVATE_FIELDS);
  for (const field of manifest.privateFields ?? []) fields.add(field);
  return fields;
}

function json(value) {
  return JSON.stringify(value);
}

function transition(state, playerId, decision) {
  return GameLogic.apply(state, playerId, decision);
}

function runGameInvariants(state, label, players) {
  if (typeof GameLogic.invariants !== "function") return [];
  let result;
  try {
    result = GameLogic.invariants(state, {
      label,
      players,
      manifest,
    });
  } catch (err) {
    return [
      `INVARIANT: ${label}: invariants() threw: ${err instanceof Error ? err.message : String(err)}`,
    ];
  }
  if (result == null) return [];
  const entries = Array.isArray(result) ? result : [result];
  const failures = [];
  for (const entry of entries) {
    if (entry === true || entry == null) continue;
    if (entry === false) {
      failures.push(`INVARIANT: ${label}: invariant returned false`);
      continue;
    }
    if (typeof entry === "string") {
      failures.push(`INVARIANT: ${label}: ${entry}`);
      continue;
    }
    if (typeof entry === "object") {
      if (entry.ok === false) {
        failures.push(
          `INVARIANT: ${label}: ${entry.error || entry.message || "invariant failed"}${entry.code ? ` (${entry.code})` : ""}`,
        );
      } else if (entry.ok !== true && entry.error) {
        failures.push(`INVARIANT: ${label}: ${entry.error}`);
      }
      continue;
    }
    failures.push(
      `INVARIANT: ${label}: unsupported invariant result ${json(entry)}`,
    );
  }
  return failures;
}

function checkBasicContract() {
  const failures = [];
  const opportunityContract =
    typeof GameLogic.setup === "function" &&
    typeof GameLogic.apply === "function" &&
    typeof GameLogic.opportunities === "function" &&
    typeof GameLogic.outcome === "function" &&
    typeof GameLogic.project === "function";
  if (!GameLogic.rules?.visibility) {
    failures.push("CONTRACT: GameLogic.rules.visibility is required");
  }
  if (!opportunityContract) {
    failures.push(
      "CONTRACT: games must expose setup(), apply(), project(), opportunities(), and outcome()",
    );
  }
  if (
    !manifest.rules ||
    typeof manifest.rules !== "string" ||
    manifest.rules.length < 100
  ) {
    failures.push(
      "CONTRACT: manifest.rules must be a string of at least 100 characters",
    );
  }
  if (
    !Number.isInteger(manifest.minPlayers) ||
    !Number.isInteger(manifest.maxPlayers)
  ) {
    failures.push(
      "CONTRACT: manifest.minPlayers and manifest.maxPlayers must be integers",
    );
  } else if (manifest.maxPlayers < manifest.minPlayers) {
    failures.push(
      "CONTRACT: manifest.maxPlayers must be >= manifest.minPlayers",
    );
  }
  failures.push(...validateThumbnailSvg(manifest, absDir));
  return failures;
}

function checkProjectionShapes(engine, players) {
  const failures = [];
  const opportunityContract = typeof GameLogic.opportunities === "function";
  for (const player of players) {
    failures.push(
      ...validateProjectionShape(
        engine.getProjection(player.id),
        `project(${player.id})`,
        { opportunityContract },
      ),
    );
  }
  failures.push(
    ...validateProjectionShape(engine.getProjection(null), "project(null)", {
      opportunityContract,
    }),
  );
  return failures;
}

function checkOpportunityShapes(engine, players) {
  if (typeof GameLogic.opportunities !== "function") return [];
  const failures = [];
  const active = [];
  const actors = players
    .map((player) => ({ id: player.id, label: player.id }))
    .concat([{ id: "__system__", label: "__system__" }]);
  for (const actor of actors) {
    const opportunities = engine.getOpportunities(actor.id);
    if (opportunities.length > 0) active.push({ actor, opportunities });
    for (const opportunity of opportunities) {
      if (!opportunity || typeof opportunity !== "object") {
        failures.push(
          `OPPORTUNITY: ${actor.label} returned a non-object opportunity`,
        );
        continue;
      }
      if (opportunity.actorId !== undefined) {
        failures.push(
          `OPPORTUNITY: ${actor.label} must not include actorId; actor comes from opportunities(state, actorId)`,
        );
      }
      if (
        typeof opportunity.kind !== "string" ||
        opportunity.kind.length === 0
      ) {
        failures.push(
          `OPPORTUNITY: ${actor.label} opportunity is missing kind`,
        );
      }
      if (typeof opportunity.id !== "string" || opportunity.id.length === 0) {
        failures.push(`OPPORTUNITY: ${actor.label} opportunity is missing id`);
      }
      if (
        typeof opportunity.prompt !== "string" ||
        opportunity.prompt.length === 0
      ) {
        failures.push(
          `OPPORTUNITY: ${actor.label} opportunity is missing prompt`,
        );
      }
      if (!opportunity.decision || typeof opportunity.decision !== "object") {
        failures.push(
          `OPPORTUNITY: ${actor.label} opportunity is missing decision`,
        );
      } else if (opportunity.decision.type === "choose") {
        if (
          !Array.isArray(opportunity.decision.options) ||
          opportunity.decision.options.length === 0
        ) {
          failures.push(
            `OPPORTUNITY: ${actor.label} choose decision must include options`,
          );
        } else {
          for (const option of opportunity.decision.options) {
            if (looksLikeActionWrapper(option)) {
              failures.push(
                `OPPORTUNITY: ${actor.label} choose options must be raw decisions or {decision, label?, schema?, required?}, not {action}`,
              );
              break;
            }
            const decision = unwrapDecisionOption(option);
            if (
              !decision ||
              typeof decision !== "object" ||
              typeof decision.type !== "string"
            ) {
              failures.push(
                `OPPORTUNITY: ${actor.label} choose option must resolve to a decision object with string type`,
              );
              break;
            }
          }
        }
      }
      if (opportunity.deadline !== undefined) {
        if (
          typeof opportunity.deadline.id !== "string" ||
          opportunity.deadline.id.length === 0
        ) {
          failures.push(`OPPORTUNITY: ${actor.label} deadline is missing id`);
        }
        if (
          !Number.isInteger(opportunity.deadline.timeoutMs) ||
          opportunity.deadline.timeoutMs < 0
        ) {
          failures.push(
            `OPPORTUNITY: ${actor.label} deadline.timeoutMs must be a nonnegative integer`,
          );
        }
        if (opportunity.deadline.onExpire === undefined) {
          failures.push(
            `OPPORTUNITY: ${actor.label} deadline is missing onExpire`,
          );
        }
      }
      if (
        opportunity.deadline?.onExpire &&
        opportunity.decision?.type === "choose"
      ) {
        const options = opportunity.decision.options ?? [];
        if (looksLikeActionWrapper(opportunity.deadline.onExpire)) {
          failures.push(
            `OPPORTUNITY: ${actor.label} deadline.onExpire must be a raw decision, not {action}`,
          );
        } else if (
          !options.some(
            (option) =>
              json(unwrapDecisionOption(option)) ===
              json(opportunity.deadline.onExpire),
          )
        ) {
          failures.push(
            `OPPORTUNITY: ${actor.label} deadline.onExpire must be one of the choose options`,
          );
        }
      }
    }
  }
  if (active.length === 0 && engine.getResult() === null) {
    failures.push("OPPORTUNITY: ongoing game has no active opportunities");
  }
  return failures;
}

function looksLikeActionWrapper(option) {
  if (!option || typeof option !== "object" || Array.isArray(option))
    return false;
  if (!("action" in option)) return false;
  return Object.keys(option).every(
    (key) =>
      key === "action" ||
      key === "label" ||
      key === "schema" ||
      key === "required",
  );
}

function checkOutcomeShape(engine) {
  if (typeof GameLogic.outcome !== "function") return [];
  const outcome = engine.getResult();
  if (outcome === null) return [];
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
    return ["OUTCOME: outcome() must return null or a GameOutcome object"];
  }
  if (
    outcome.type !== "winners" &&
    outcome.type !== "draw" &&
    outcome.type !== "void"
  ) {
    return ["OUTCOME: outcome.type must be winners, draw, or void"];
  }
  if (outcome.type === "winners" && !Array.isArray(outcome.playerIds)) {
    return ["OUTCOME: winners outcomes must include playerIds"];
  }
  if (
    outcome.type === "draw" &&
    outcome.playerIds !== undefined &&
    !Array.isArray(outcome.playerIds)
  ) {
    return ["OUTCOME: draw playerIds must be an array when present"];
  }
  if (outcome.type === "void" && typeof outcome.reason !== "string") {
    return ["OUTCOME: void outcomes must include reason"];
  }
  if (outcome.winners !== undefined) {
    return ["OUTCOME: use playerIds; winners is not part of GameOutcome"];
  }
  return [];
}

function checkViewSecrecy(engine, players, state) {
  const playerIds = players.map((p) => p.id);
  const playerIdSet = new Set(playerIds);
  const livingPlayers = state.alive
    ? players.filter((p) => state.alive[p.id] !== false)
    : players;

  if (state.seed !== undefined) {
    const seedStr = json(state.seed);
    for (const player of livingPlayers) {
      const viewJson = json(engine.getView(player.id));
      if (
        viewJson.includes(`"seed":${seedStr}`) ||
        viewJson.includes(`"seed": ${seedStr}`)
      ) {
        return `LEAK: state.seed (${seedStr}) visible in ${player.name}'s view`;
      }
    }
  }

  if (Array.isArray(state.deck) && state.deck.length > 0) {
    const deckStr = json(state.deck);
    for (const player of livingPlayers) {
      if (json(engine.getView(player.id)).includes(deckStr)) {
        return `LEAK: state.deck visible in ${player.name}'s view`;
      }
    }
  }

  if (REVEAL_PHASES.has(state.phase ?? "")) return null;

  for (const key of Object.keys(state)) {
    if (PUBLIC_MAP_FIELDS.has(key)) continue;
    const val = state[key];
    if (val === null || typeof val !== "object" || Array.isArray(val)) continue;
    const objKeys = Object.keys(val);
    const playerKeyCount = objKeys.filter((k) => playerIdSet.has(k)).length;
    if (playerKeyCount < 2) continue;
    const hasPrivateValues = objKeys.some((k) => {
      if (!playerIdSet.has(k)) return false;
      const v = val[k];
      if (
        v === null ||
        v === undefined ||
        typeof v === "boolean" ||
        typeof v === "number"
      )
        return false;
      if (typeof v === "string" && (playerIdSet.has(v) || v === "skip"))
        return false;
      return true;
    });
    if (!hasPrivateValues) continue;

    const fullMapStr = json(val);
    for (const viewer of livingPlayers) {
      const view = engine.getView(viewer.id);
      if (
        view[key] !== undefined &&
        typeof view[key] === "object" &&
        !Array.isArray(view[key])
      ) {
        if (json(view[key]) === fullMapStr) {
          const uniqueVals = new Set(Object.values(val).map((v) => json(v)));
          if (uniqueVals.size > 1) {
            return `LEAK: full '${key}' map visible in ${viewer.name}'s view`;
          }
        }
      }
    }
  }

  const fields = privateFields();
  if (Array.isArray(state.players)) {
    for (const entry of state.players) {
      if (entry === null || typeof entry !== "object") continue;
      const ownerId = entry.id;
      if (!ownerId || !playerIdSet.has(ownerId)) continue;
      for (const field of fields) {
        if (
          entry[field] === undefined ||
          entry[field] === null ||
          typeof entry[field] !== "object"
        )
          continue;
        const secret = json(entry[field]);
        for (const viewer of livingPlayers) {
          if (viewer.id === ownerId) continue;
          if (json(engine.getView(viewer.id)).includes(secret)) {
            return `LEAK: ${ownerId}'s ${field} visible in ${viewer.name}'s view`;
          }
        }
      }
    }
  }

  for (const key of Object.keys(state)) {
    if (PUBLIC_MAP_FIELDS.has(key) || fields.has(key)) continue;
    const val = state[key];
    if (val === null || typeof val !== "object" || Array.isArray(val)) continue;
    const playerEntries = Object.entries(val).filter(([k]) =>
      playerIdSet.has(k),
    );
    if (playerEntries.length < 2) continue;
    if (!playerEntries.some(([, v]) => v !== null && typeof v === "object"))
      continue;
    for (const [ownerId, ownerVal] of playerEntries) {
      if (ownerVal === null || typeof ownerVal !== "object") continue;
      const secret = json(ownerVal);
      if (secret.length < 5) continue;
      for (const viewer of livingPlayers) {
        if (viewer.id === ownerId) continue;
        if (json(engine.getView(viewer.id)).includes(secret)) {
          return `LEAK: ${ownerId}'s ${key} data visible in ${viewer.name}'s view`;
        }
      }
    }
  }

  return null;
}

function runTest(playerCount, seed) {
  const rngSeed = seed || Math.floor(Math.random() * 2147483647);
  const rng = createSeededRandom(rngSeed);
  const players = makePlayers(playerCount);
  const engine = new GameEngine(GameLogic, players, {}, rngSeed);
  const agentLint = createAgentLintSession(manifest);
  const strictAgentLint = hasFlag("strict-agent-lint");
  const maxTicks =
    Number.parseInt(arg("ticks", "0"), 10) || manifest.maxTicks || 500;
  const failures = [
    ...checkBasicContract(),
    ...checkProjectionShapes(engine, players),
    ...checkOpportunityShapes(engine, players),
  ];
  const actionLog = [];
  const phasesVisited = new Set();
  let actionCount = 0;
  let mutationDetected = false;
  let staleActionCount = 0;
  const checkedSystemDefaults = new Set();

  console.log(`Testing ${manifest.name} (${manifest.slug})`);
  console.log(`Players: ${playerCount}  Seed: ${rngSeed}`);

  failures.push(
    ...runGameInvariants(engine.getState(), "initial state", players),
  );

  for (let tick = 0; tick < maxTicks; tick++) {
    const state = engine.getState();
    if (state.phase !== undefined) phasesVisited.add(state.phase);
    if (engine.getResult() !== null) break;
    agentLint.inspect(engine, players);

    const playerActions = [];
    for (const player of players) {
      const actions = engine.getActions(player.id);
      if (actions.length > 0) playerActions.push({ player, actions });
    }

    const sysConfig = engine.getTurnConfig(null);
    if (sysConfig?.onExpire) {
      const key = `${state.phase ?? "unknown"}|${json(sysConfig.onExpire)}|${playerActions.length > 0 ? "with-player-actions" : "no-player-actions"}`;
      if (!checkedSystemDefaults.has(key)) {
        checkedSystemDefaults.add(key);
        const before = json(state);
        const afterState = transition(
          JSON.parse(before),
          "__system__",
          sysConfig.onExpire,
        );
        if (before === json(afterState)) {
          failures.push(
            `UNREACHABLE: system onExpire ${json(sysConfig.onExpire)} does not advance state at phase '${state.phase ?? "unknown"}'${playerActions.length > 0 ? " while player actions are still legal" : ""}`,
          );
          break;
        }
      }
    }

    if (
      playerActions.length > 0 &&
      sysConfig?.onExpire &&
      tick > 0 &&
      tick % 20 === 0
    ) {
      engine.processAction("__system__", sysConfig.onExpire);
      actionLog.push({
        playerId: "__system__",
        action: sysConfig.onExpire,
      });
      actionCount++;
      failures.push(
        ...runGameInvariants(
          engine.getState(),
          `after action #${actionCount}`,
          players,
        ),
      );
      continue;
    }

    if (playerActions.length === 0) {
      if (sysConfig?.onExpire) {
        engine.processAction("__system__", sysConfig.onExpire);
        actionLog.push({
          playerId: "__system__",
          action: sysConfig.onExpire,
        });
        actionCount++;
        failures.push(
          ...runGameInvariants(
            engine.getState(),
            `after action #${actionCount}`,
            players,
          ),
        );
        continue;
      }

      let handled = false;
      for (const player of players) {
        const playerConfig = engine.getTurnConfig(player.id);
        if (!playerConfig?.onExpire) continue;
        const before = json(state);
        const afterState = transition(
          JSON.parse(before),
          player.id,
          playerConfig.onExpire,
        );
        if (before !== json(afterState)) {
          engine.processAction(player.id, playerConfig.onExpire);
          actionLog.push({
            playerId: player.id,
            action: playerConfig.onExpire,
          });
          actionCount++;
          failures.push(
            ...runGameInvariants(
              engine.getState(),
              `after action #${actionCount}`,
              players,
            ),
          );
          handled = true;
          break;
        }
      }
      if (handled) continue;

      failures.push(
        `FREEZE: no players can act and no timer at phase '${state.phase ?? "unknown"}'`,
      );
      break;
    }

    if (actionCount % 10 === 0) {
      const leak = checkViewSecrecy(engine, players, state);
      if (leak && !failures.includes(leak)) failures.push(leak);
    }

    for (const { player, actions } of playerActions) {
      const option = rng.pick(actions);
      const action = unwrapDecisionOption(option);
      const before = json(engine.getState());

      if (!mutationDetected && actionCount % 10 === 0) {
        const inputSnapshot = JSON.parse(before);
        transition(inputSnapshot, player.id, action);
        if (json(inputSnapshot) !== before) {
          failures.push(
            `MUTATION: apply() mutated input at action #${actionCount}`,
          );
          mutationDetected = true;
        }
      }

      engine.processAction(player.id, action);
      const after = json(engine.getState());
      failures.push(
        ...runGameInvariants(
          engine.getState(),
          `after action #${actionCount + 1}`,
          players,
        ),
      );
      if (before === after) {
        staleActionCount++;
        if (
          staleActionCount >= 5 &&
          !failures.some((f) => f.startsWith("STALE"))
        ) {
          failures.push(
            "STALE: apply() returned unchanged state for 5+ legal actions",
          );
        }
      } else {
        staleActionCount = 0;
      }
      actionLog.push({ playerId: player.id, action });
      actionCount++;
      if (engine.getResult() !== null) break;
    }
  }

  if (engine.getResult() === null) {
    failures.push(`NON-TERMINATION: game did not finish in ${maxTicks} ticks`);
  }
  failures.push(...checkOutcomeShape(engine));

  const finalLeak = checkViewSecrecy(engine, players, engine.getState());
  if (finalLeak && !failures.includes(finalLeak)) failures.push(finalLeak);

  const agentLintFindings = agentLint.findings();
  for (const finding of agentLintFindings) {
    console.log(formatAgentLintFinding(finding, { strict: strictAgentLint }));
  }
  if (strictAgentLint) {
    failures.push(...strictAgentLintFailures(agentLintFindings));
  }

  if (engine.getResult() !== null && actionLog.length > 0) {
    const replay = new GameEngine(GameLogic, players, {}, rngSeed);
    for (const entry of actionLog)
      replay.processAction(entry.playerId, entry.action);
    if (json(replay.getState()) !== json(engine.getState())) {
      failures.push(
        "REPLAY DIVERGENCE: replaying the action log produced a different final state",
      );
    }
  }

  const result = engine.getResult();
  const passed = failures.length === 0 && result !== null;

  console.log("\n-------------------------------------------");
  console.log("  LOGIC TEST REPORT");
  console.log("-------------------------------------------");
  console.log(`  Game:       ${manifest.name}`);
  console.log(`  Players:    ${playerCount}`);
  console.log(`  Seed:       ${rngSeed}`);
  console.log(`  Actions:    ${actionCount}`);
  if (phasesVisited.size > 0)
    console.log(`  Phases:     ${[...phasesVisited].join(" -> ")}`);
  if (result) {
    console.log(`  Result:     ${result.summary || "game over"}`);
    const winners = outcomeWinners(result);
    if (winners.length > 0) console.log(`  Winners:    ${winners.join(", ")}`);
  }
  if (failures.length > 0) {
    console.log(`  Status:     FAIL (${failures.length} issue(s))`);
    for (const failure of failures) console.log(`    - ${failure}`);
    console.log(
      `  Replay:     node scripts/test-game-logic.mjs ${gameDir} --players ${playerCount} --seed ${rngSeed} --ticks ${maxTicks} --trace`,
    );
    if (hasFlag("trace") && actionLog.length > 0) {
      console.log("  Recent actions:");
      for (const entry of actionLog.slice(-20)) {
        console.log(`    - ${entry.playerId}: ${json(entry.action)}`);
      }
    }
  } else {
    console.log("  Status:     PASS");
  }
  console.log("-------------------------------------------\n");

  return passed;
}

if (hasFlag("sweep")) {
  const counts = new Set([manifest.minPlayers, manifest.maxPlayers]);
  const mid = Math.floor((manifest.minPlayers + manifest.maxPlayers) / 2);
  if (mid > manifest.minPlayers && mid < manifest.maxPlayers) counts.add(mid);
  let allPassed = true;
  const seedsArg = arg("seeds", "");
  const seedArg = Number.parseInt(arg("seed", "0"), 10) || null;
  const seeds = seedsArg
    ? seedsArg
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [seedArg];
  for (const count of [...counts].sort((a, b) => a - b)) {
    for (const seed of seeds) {
      if (!runTest(count, seed)) allPassed = false;
    }
  }
  process.exit(allPassed ? 0 : 1);
}

const playerCount = Number.parseInt(
  arg("players", String(manifest.minPlayers)),
  10,
);
const seed = Number.parseInt(arg("seed", "0"), 10) || null;
process.exit(runTest(playerCount, seed) ? 0 : 1);
