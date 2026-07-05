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

`qa-chaos.mjs` is the runner-owned live QA orchestrator. It expects an already-running host, creates and starts rooms, joins isolated seats, spawns one CLI worker per seat, optionally replaces one REST seat with a browser worker, polls room progress, enforces action/wall-clock/stall budgets, waits briefly for QA ledgers at game over, and writes `reports/summary.md`, `reports/test-cases.json`, and `reports/failures.json`.

The qa-chaos worker helpers keep mechanical formats out of model judgment. `qa-chaos-poll-loop.mjs` owns long-poll transport and `poll.jsonl`; `qa-chaos-act.mjs` owns action/chat/test writes and `writes.jsonl`/`tests.jsonl`; `lib/qa-chaos-*.mjs` modules own topology, REST calls, worker process setup, action budget counting, ledger grace, and report generation.

`qa-chaos-rest-prompt.md` is the live REST worker template and `qa-chaos-browser-prompt.md` is the live browser worker template. `qa-chaos-worker-prompt.md` is a legacy dead template; grep `qa-chaos.mjs` before editing prompt cadence or ledger requirements.

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
- `WAIT_SIGNAL_MISSING`: while `outcome()` is still `null`, the sampled state has no player with an actionable opportunity and a player also lacks `kind:"wait"`. The broader per-non-actor wait convention is documented, but this linter check is intentionally narrower until the catalog is re-baselined.
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

Run runner-owned live QA from this repo root:

```bash
node scripts/qa-chaos.mjs ./game-slug --adapter mixed --players 2 --base http://localhost:3000
```

Use `--help` for the full option list. Important knobs are `--all`, `--runs N`, `--browser`, `--mode smoke|full|weird`, `--max-actions N`, `--max-minutes N`, `--stall-ms N`, `--worker-boot-ms N`, `--ledger-grace-ms N`, `--worker-trust scoped|full`, and `--dry-run`. `--dry-run` prints topology, commands, budgets, and rendered worker artifacts without spawning workers.

qa-chaos artifacts live under `e2e-runs/<timestamp>-qa-chaos-<game>/`. REST submissions land in `writes.jsonl`; QA cases land in `tests.jsonl`; `actions.jsonl` is currently a pre-created/dead artifact for REST workers. Claude adapter runs may leave zero-byte `stdout.log`, `stderr.log`, and `transcript.md`; until output capture is fixed, audit those seats through `tests.jsonl`, `writes.jsonl`, and runner reports.

Autoplay detection is poll-sampled from the current room poll. It catches observed `autoPlayCount > 0`, but it is not cumulative proof because manual actions can reset the field between roughly five-second polling windows.

Action budget evidence combines parsed action entries from `writes.jsonl` with turn-number delta. Malformed `writes.jsonl` rows are tracked as parse failures but can undercount the worker-submitted side of the budget.

The ledger grace window enforces non-empty worker ledgers after game over. If a worker's own move ends a short game, one immediate game-over ledger entry satisfies the cadence; the runner may exit the grace window as soon as every worker ledger is non-empty.

Some model-written evidence cites `ACTION_ID` values printed only by the action helper. Those IDs are hard to trace for Claude workers while stdout/stderr capture is empty; prefer `writes.jsonl` line references and report paths in summaries.

Sweep run directory naming has cosmetic rough edges in catalog runs; use report paths printed by the runner as the stable artifact pointers.

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
