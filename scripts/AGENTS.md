# scripts/

These scripts are author-facing and must run inside the standalone games repo.
Do not import from `../packages/*`, `apps/*`, or the main monorepo.
`test-game-logic.mjs` and `test-game-ui.mjs` share `lib/load-game-logic.mjs`; keep loader behavior aligned with upload/runtime semantics.
Tests should report errors an autonomous coding agent can fix without reading server logs.
UI checks must cover mobile and desktop viewports and catch console errors, overflow, offscreen controls, and obvious control overlap.
`e2e-play.mjs` prompts are the product: keep browser workers alive through gameplay, make REST workers deadline-aware, and require Expectation/QA Test Cases/Result report sections.
QA workers should write down the odd cases they invent while playing in `tests.jsonl`; root should aggregate them into `reports/test-cases.json` and `reports/summary.md`.
The root orchestrator prompt template lives in `e2e-play-root-prompt.md`; edit that file instead of burying prompt prose in JavaScript.
`qa-chaos.mjs` is runner-owned live QA: Node owns room setup, worker spawning, transport helpers, ledgers, budgets, and reports; model prompts own only gameplay/QA judgment.
Live qa-chaos REST prompts come from `qa-chaos-rest-prompt.md`; browser prompts come from `qa-chaos-browser-prompt.md`; `qa-chaos-worker-prompt.md` is legacy and not selected by `qa-chaos.mjs`.
Agent-lint wait scope is narrower than the convention: it only emits `WAIT_SIGNAL_MISSING` in ongoing simulated states where no player has an actionable decision.
