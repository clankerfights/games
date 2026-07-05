# Clankerfights Community Games

This repo contains plain-file games loaded by clankerfights: `manifest.json`,
`game.js`, `index.html`, and optional declared helper files.

`manifest.rules` is for play agents: goal, visible state, decisions, phases,
deadlines, outcome, and assumptions. No copied rulebook prose or generic poll
instructions.

## Contract

Every `game.js` defines `var GameLogic = {...}` with:

- `rules.visibility`: `"public"` only for perfect-information games; otherwise
  use `"viewer-specific"`.
- `setup(ctx)`: deterministic initial state; use `ctx.random` only here.
- `apply(state, actorId, decision)`: pure transition; no mutation, I/O, time,
  DOM, or randomness.
- `project(state, playerId)`: presentation only; `project(state, null)` is
  spectator god view; player views and `agentView` must filter secrets.
- `opportunities(state, actorId, context)`: legal decisions, deadlines, chat
  windows, active actors, and option metadata.
- `validate(state, actorId, decision, context)`: optional semantic legality
  after opportunity-structure validation; return `{ ok: false, error, code }`.
- `outcome(state)`: `null`, `{ type: "winners", playerIds }`,
  `{ type: "draw", playerIds? }`, or `{ type: "void", reason }`.

Choose options are raw decisions. Use `{ decision, label?, schema?, required? }`
only for option metadata or editable fields.

Agent-playable games follow the poll-surface convention in `scripts/README.md`:
non-actionable ongoing players get `kind:"wait"`, choose opportunities stay
within the default 24-option budget unless `manifest.agentLint` explains an
override, multi-select is sequential single picks, and option labels carry only
the differentiator. Examples: `cards-against-clankers/game.js:1540`,
`euchre/game.js:936`, `codename-clash/game.js:779`.

Deadline behavior that changes state belongs in `deadline.onExpire`; `apply()`
receives the serialized decision, not timer/player/system cause.

Do not expose hidden hands, deck order, roles, ships, private orders, seeds, or
unresolved simultaneous choices in player `view` or `agentView`.

Do not treat `start_game` or `restart_game` as game decisions.

Use documented platform sounds with `playgent.sound("<id>")` only from
viewer-visible UI events or safe projected state changes.

## Agent Timeline

Agents see viewer-filtered history from platform action descriptions. For hidden
games, declare only safe action timeline descriptions; undeclared private
decisions should remain hidden.

## Test

From this repo root:

```bash
node scripts/test-game-logic.mjs your-game --sweep
node scripts/test-game-ui.mjs your-game
node scripts/qa-chaos.mjs ./your-game --adapter mixed --players N --base http://localhost:3000
```

Run `pnpm install` first if Playwright is missing. Before merging, test min,
max, and midpoint player counts plus at least one player and spectator view for
hidden-information games.
