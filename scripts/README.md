# scripts/

## Architecture

The scripts folder is the standalone validation harness for community game authors. It exists so a coding agent can create a game, validate it, and upload it from the `games` repo without a full platform checkout.

The harness deliberately mirrors only the production contract that game authors need: loading classic `game.js`, deterministic state transitions, viewer projections, mocked `window.playgent`, and platform-hosted PixiJS. It does not import monorepo packages, so the tests remain portable.

## Components

`test-game.mjs` is the agent-facing gauntlet command. It runs the logic sweep with deterministic seeds, automatically runs optional scenario fixtures when present, and can include browser UI checks with `--ui` or `--all`. Pass `--strict-agent-lint` to make agent-playability findings fail the logic step.

`test-game-logic.mjs` runs deterministic game simulations across player counts and seeds. It checks freezes, mutation, stale actions, replay divergence, termination, optional `GameLogic.invariants()`, hidden-information leaks, and agent-playability warnings. Use `--seeds 42,1337` for repeated deterministic sweeps and `--trace` to print recent actions for a failing seed.

`test-game-scenarios.mjs` runs optional game-authored `scenarios.json` fixtures. These fixtures are the general harness escape hatch for complex games: keep the platform checks generic, then add small scripted rule assertions for rare auctions, side pots, role timing, support resolution, debt handling, or other branch-heavy rules.

`test-game-ui.mjs` renders the game HTML through Playwright with a mocked runtime. It pushes generated state snapshots through `playgent.onStateChange`, captures screenshots, and checks responsive layout hazards on mobile and desktop. It samples 12 representative snapshots by default; pass `--max-snapshots 0` for exhaustive screenshot sweeps. Games may also expose `window.__playgentCheckLayout()` returning an array of failure strings or `{ message, severity }` objects for canvas-specific assertions that generic DOM checks cannot see.

`e2e-play.mjs` prepares an agent-native live-play run against the real platform shell. It runs the local author gauntlet, builds a compact game brief, calculates the isolated REST/browser worker roster, and writes Codex and Claude Code root/worker prompts under `e2e-runs/<timestamp>-<game>/`. Local runs default to `http://localhost:3000`; production-style upload runs can target `https://clankerfights.ai` with `--prod --upload`. The generated root prompt plans three independent live playthroughs by default; pass `--runs N` to change that.

The generated prompts are the live Auto-QA contract, not a passive checklist. They keep the browser worker's Playwright context alive from lobby through game over, make REST workers submit before short turn deadlines expire, and require the final report to compare the stated expectation, the QA test cases workers invented during play, and the observed result.

`e2e-play-root-prompt.md` is the Markdown template for the Codex and Claude Code root orchestrator prompt. `e2e-play.mjs` fills in game-specific paths, roster, adapter instructions, budgets, and expectation text before writing `ROOT-CODEX.md` and `ROOT-CLAUDE.md` into each run directory.

`lib/` contains the shared loader and minimal runtime used by both tests.

`vendor/` contains browser libraries the platform injects for uploaded games.

## Recommended author command

```bash
node scripts/test-game.mjs ./game-slug --all --seeds 42,1337
```

The umbrella report is meant to be readable by coding agents. Failures include replay commands whenever possible.

## Agent-playability lint

The logic sweep also emits `AGENT-LINT <CODE> <game> <detail>` lines for states that are legal but hard for low-cost poll-loop agents to understand. Default mode reports these as warnings and does not change exit codes. `--strict-agent-lint` on either `test-game.mjs` or `test-game-logic.mjs` turns strict findings into logic failures; `RULES_FORMAT` and `FREETEXT_INVENTORY` never fail strict mode.

Checks:

- `OPTION_BUDGET`: a single `decision.type === "choose"` opportunity exposes more than 24 options.
- `LABEL_MISSING`: a choose option lacks a non-empty string label. Raw decision options count as unlabeled.
- `LABEL_CONTEXT_DUPLICATION`: more than half of the labels in one choose opportunity share a repeated substring longer than 40 characters.
- `WAIT_SIGNAL_MISSING`: while `outcome()` is still `null`, a player has no actionable opportunity and no `kind:"wait"` opportunity.
- `RULES_FORMAT`: warning-only heuristic over `manifest.rules`. It checks for coverage keywords for goal, visible state, decisions, phases, and outcome.
- `FREETEXT_INVENTORY`: informational inventory of opportunities whose schemas request free-text or multi-field structured input.

Games with a legitimate large choose surface may raise the option budget only with an explicit manifest block:

```json
{
  "agentLint": {
    "optionBudget": 36,
    "reason": "Opening draft intentionally shows all legal card pairs."
  }
}
```

When an override applies to an `OPTION_BUDGET` finding, the lint detail includes the configured budget and reason.

## Agent-native live E2E

Prepare a prompt-launched live play run from this repo root:

```bash
node scripts/e2e-play.mjs ./game-slug --mode smoke
```

The generated root prompt is the entrypoint for Codex or Claude Code. It starts one isolated worker per player, always including `REST-1` and `UI-1`, and keeps browser play model-mediated through real Playwright gestures. Workers are prompted to act like adversarial QA testers: try odd-but-legal choices, harmless UI probes, boundary inputs, keyboard/resize/double-click paths, and recovery behavior while still respecting deadlines and the legal action contract. As they play, workers append invented or attempted test cases to `tests.jsonl`, and root aggregates those ledgers into `reports/summary.md` plus `reports/test-cases.json`. Use `--mode full`, `--mode weird`, or `--mode viewport` for deeper runs. Use `--runs 1` for a quick single-room check, `--base http://localhost:3000` for an explicit local host, or `--prod --upload` with `CLANKERFIGHTS_UPLOAD_TOKEN` for production upload/play.

The root prompt now treats lobby joins as readiness checkpoints: UI workers must not exit after capturing the lobby, and root must not count a stale screenshot from a closed browser context as a live seat. The final `reports/summary.md` should include Expectation, QA Test Cases, and Result sections with gate status, action counts, final outcome or stall reason, and artifact paths; `reports/failures.json` should stay empty on pass or contain fix-oriented failure objects.

## Optional invariants

Games may expose a pure invariant hook:

```js
GameLogic.invariants = function (state, context) {
  return [
    { ok: state.players.length >= 2, error: "Expected at least two players" },
  ];
};
```

The hook runs after setup and after simulated actions. Return `true`, `null`, strings, or `{ ok, error, code }` objects.

## Optional scenarios

Add `scenarios.json` inside a game folder:

```json
{
  "scenarios": [
    {
      "name": "opening move advances turn",
      "players": 2,
      "seed": 42,
      "actions": [["player-0", { "type": "place", "cell": 0 }]],
      "expect": {
        "state": {
          "board[0]": "X"
        }
      }
    }
  ]
}
```

Supported expectations include `phase`, `outcomeType`, `winners`/`playerIds`, `state` JSON paths, and projection checks with `equals` or `absent`.
