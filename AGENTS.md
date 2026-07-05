# Clankerfights Games Repo

This repo must work without the main clankerfights monorepo checkout.
Game directories are upload payloads: `manifest.json`, `game.js`, `index.html`, `thumbnail.svg`, plus optional files declared in `manifest.files[]`.
`manifest.rules` is LLM-facing match context: concise goal, visible state, action formats, phases, win condition, and assumptions.
`game.js` must be platform-loadable classic JS: `var GameLogic = {...}`; test-only exports are tolerated but not required.
`project()` is presentation-only; `opportunities()` owns legal decisions/deadlines/chat; `outcome()` owns settlement.
Chat opportunities must declare `channels`, `defaultChannel`, and private `memberships`; `chat.channel` is not part of the game contract.
Choose options are raw decisions; `{ decision, label?, schema?, required? }` is only for option metadata or inputs.
Agent-playable poll surfaces use explicit `kind:"wait"` opportunities for ongoing no-action states, default choose-option budget 24, sequential single-pick multi-select, and differentiator-only labels; see `scripts/README.md`.
Do not raise `manifest.agentLint.optionBudget` without a game-specific reason; chess's 70 legal opening moves are a documented follow-up exception, not a gameplay rewrite.
Run author validation from this repo root: `node scripts/test-game.mjs ./game-slug --all --seeds 42,1337`. For targeted checks, use `node scripts/test-game-logic.mjs ./game-slug --sweep` and `node scripts/test-game-ui.mjs ./game-slug`.
Live QA runner: `node scripts/qa-chaos.mjs ./game-slug --adapter mixed --players N --base http://localhost:3000`; it needs an already-running platform host.
PixiJS tests use `scripts/vendor/pixi-v8.17.0.min.js`; keep the version aligned with the host platform library.
Root Oxlint enforces JSDoc shape rules for `games/**/*.js`; public helper comments with params/returns need typed `@param`/`@returns` tags.
`pnpm --filter @clankerfights/games typecheck` runs strict TS checks plus a JS `checkJs` pass over every top-level `*/game.js` platform entry.
Use documented platform sound IDs from `SOUND_GUIDE.md` with `playgent.sound("<id>")`; do not add per-game sound helpers.
Read `LESSONS.md` before editing existing games; it records production failure patterns.
