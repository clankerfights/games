# Game Development Lessons

Non-obvious bugs and patterns discovered while building PixiJS games on the Playgent platform. These apply to ALL games, not just the one where they were discovered. Format: Problem / Fix / Rule.

---

### `var` scoping silently breaks the entire render pipeline

**Problem:** A rendering function used a variable without declaring it with `var`. The variable existed in a different function's scope. In strict mode (VM sandbox), this threw `ReferenceError` which killed the entire `onStateChange` handler before it could store state. Result: the game appeared empty (board rendered, but no player nodes, no animations, no effects). Extremely hard to debug because the error was swallowed by the pending-state initialization pattern.

**Fix:** One line: `var x = node._x;` at the top of the function.

**Rule:** Game files must use `var` (VM sandbox strict mode, no `let`/`const`). Every function that references a variable must declare it locally. When visual elements silently don't render, check the browser console inside the iframe for ReferenceErrors. The pending-state pattern (`_ready` flag + deferred delivery) masks errors that happen during the first `onStateChange` call.

---

### Animation ownership: immediate state updates race with tweened animations

**Problem:** When game state arrives with multiple new visual elements at once (e.g., all board pieces revealed simultaneously), the animation code sets elements to invisible (`alpha: 0`) and starts tweening them in. But the immediate state update function runs right after and shows them instantly, overriding the animation. Result: elements appear as blank/white because the tween hasn't started but the face is already shown.

**Fix:** Use an exclusion set. Animation code marks element indices as "locked" in a shared set. The immediate update function checks the set and skips locked elements. Animation deletes the index from the set when the tween completes.

**Rule:** When one code path creates animations (tweens, setTimeout chains) and another does immediate visual updates on the same objects, the animation path must "lock" what it owns. Pattern: `_animatingSet[id] = true` on setup, `delete _animatingSet[id]` on complete, skip in update if `_animatingSet[id]` exists. Also use this set to freeze other UI that would leak information (chip counts, scores) until the animation finishes.

---

### Deferring game-over so cinematic endings can play out

**Problem:** The shell's GameOverOverlay appears the instant `view.gameWinner` is set. Any end-of-game animation (card reveals, celebrations, score tallies) gets covered by the overlay within 1 second, even if the animation needs 15-30 seconds.

**Fix:** Don't set `gameWinner` immediately when the game resolves. Store it in a private field (`_pendingWinner`). The `view()` function returns `gameWinner: null` so the shell doesn't trigger the overlay. When the `continue` timer fires (via `turnConfig` timeout), promote `_pendingWinner` to `gameWinner`. Same pattern works for `eliminated` players: store in `_pendingEliminations` so they stay "alive" in the UI during the animation phase and don't get switched to spectator mode.

**Rule:** Any game state that triggers shell behavior (overlay, phase transition, player removal) should be deferred if the game has a cinematic end sequence. Use `_pending*` fields + a `continue` action handler to apply deferred state changes after the animation window. `turnConfig` controls the timing.

---

### Responsive game boards: use roundRect, not ellipse

**Problem:** A game board drawn as an ellipse stretched into an ugly oval on wide screens and a tall egg on portrait mobile. The proportions looked wrong at every aspect ratio.

**Fix:** Use `roundRect` where `cornerRadius = Math.min(width, height) / 2`. This creates a stadium/pill shape: flat edges on the long sides, perfect semicircles on the short sides. On square-ish screens it's nearly circular. On wide screens it's a proper racetrack.

**Rule:** For boards, arenas, or play areas that need to look good at any aspect ratio, prefer `roundRect` with `radius = min(w,h)/2` over `ellipse`. The stadium shape adapts naturally to portrait and landscape without looking stretched.

---

### Quadrant-aware layout for elements positioned around a board

**Problem:** UI elements (names, scores, cards, chip stacks) were stacked in a fixed vertical direction below each player avatar. Players at the top had info overlapping the board edge. Side players had info extending off-screen. With few players, elements overlapped each other.

**Fix:** Compute a quadrant (`top`, `bottom`, `left`, `right`) for each element based on its angle from the board center using `Math.atan2`. Flow child elements away from the center: top players put info below, left players put info to the right, etc. Position different element types (info pill, cards, chip stack) on opposite sides to prevent overlap.

**Rule:** Any UI element positioned around a circular or elliptical layout needs quadrant-aware child positioning. The rendering order matters too: create nodes first, position them (setting quadrants), THEN update their visual content (using the quadrants). Getting the order wrong means all elements use a default quadrant.

---

### Decorative visual elements become noise at small sizes

**Problem:** A faint decorative element (alpha 0.08) looked good at full size but rendered as an unidentifiable grey blob when the parent element was small (~20-30px). It made the game pieces look dirty instead of polished.

**Fix:** Removed the decorative element entirely. Clean, minimal design with just the essential information.

**Rule:** Test all game piece designs at their smallest rendered size before adding decorative details. If a visual element isn't recognizable at the minimum size, cut it. Mobile games have tokens, cards, and icons at 15-30px — decorative subtlety disappears at that scale.

---

### Celebration effects must target the winner, not broadcast

**Problem:** A victory particle effect spread across the full screen width. In a multiplayer game where all players are near the center, the celebration appeared to congratulate everyone equally. Also, the effect was visible to losing players, which felt wrong.

**Fix:** (1) Anchor the effect to the winner's screen position with a tight spread, not full-width. (2) Gate the effect on the viewer's role: only the winner and spectators see it, not losers. Check `context.myId` against the winners list and whether the viewer is in the player list at all.

**Rule:** Victory effects need two gates: spatial (centered on the winner's position, not broadcast) and viewer-based (only show to the winner + spectators, not losers). The viewer gate uses `myId` from context to decide.

---

### PixiJS memory leaks: destroy children before rebuilding containers

**Problem:** When a PixiJS container is rebuilt (e.g., on resize), clearing children with `removeChildAt(0)` orphans the old Text, Graphics, and Container objects without destroying them. Each resize creates new objects while the old ones leak GPU textures and JS references. Over many resizes or game rounds, memory grows unbounded.

**Fix:** Call `child.destroy({ children: true })` on each removed child before creating new ones. Same applies to any pooled visual element that gets recreated (overlays, temporary sprites).

**Rule:** In PixiJS, `removeChild` does NOT free GPU resources. Always call `.destroy({ children: true })` on removed display objects. Audit any code that does `while (container.children.length > 0) container.removeChildAt(0)` — it's a leak pattern. The `{ children: true }` flag recursively destroys nested containers.

---

### Math.random() throws in sandboxed game iframes

**Problem:** The platform overrides `Math.random()` to throw in game iframes (prevents non-deterministic game logic). Any client-side code that uses `Math.random()` — Monte Carlo simulations, shuffle algorithms, random particle effects — will crash.

**Fix:** For simulations, use deterministic sampling (enumerate evenly-spaced combinations instead of random). For visual randomness (particle effects), use `performance.now()` or index-based pseudo-randomness (`Math.sin(i * 1.3) * 0.8`). Never call `Math.random()` in game iframe code.

**Rule:** Game iframe code cannot use `Math.random()`. Use the `random` function provided by `setup()` for game logic. For client-side visual effects, use deterministic alternatives. If you need shuffling, accept a seed or random function as a parameter instead of calling `Math.random()` directly.

---

### Freeze information-leaking UI during animations

**Problem:** During an animated game resolution (e.g., card reveals), score/chip/point displays updated immediately to their final values, revealing who won before the animation finished. Players could read the outcome from the numbers without watching the cards.

**Fix:** Check the animation exclusion set (`_animatingSet`). While any elements are still animating, skip updating score/chip displays. They hold their pre-resolution values until the last animation completes. This applies to both opponent displays and the local player's own display.

**Rule:** Any numeric display that changes as a result of game resolution (scores, chips, health, points) must be frozen while resolution animations play. Use the same animation lock set that prevents state update races. The UI should reveal outcomes through the animation, not through the numbers.

---

### Seat positioning must use the same geometry as the board

**Problem:** Player seats were positioned using hardcoded ratios (`w * 0.42`, `h * 0.30`) while the actual board used different responsive calculations. On portrait mobile, seats appeared inside or far outside the board edge depending on aspect ratio.

**Fix:** Use the same functions that compute the board shape (`feltCX()`, `feltRX()`, etc.) with a slight multiplier (1.05-1.15x) to orbit just outside the board edge.

**Rule:** Player seat positions must derive from the actual board geometry, not independent constants. If the board shape changes (resize, orientation), seats must change in lockstep. One source of truth for the board dimensions, referenced by both the board renderer and the seat calculator.

---

### Create → Position → Update: the rendering order for dynamic nodes

**Problem:** Player nodes were created, then visually updated (setting card positions, info pill layout based on quadrant), then positioned on the board (which sets the quadrant). The visual update used the wrong quadrant because it ran before positioning. Cards appeared at the default position instead of their quadrant-aware position.

**Fix:** Reorder to: (1) Create all nodes, (2) Position them on the board (sets x/y and quadrant), (3) Update visual content (uses the correct quadrant for layout).

**Rule:** For any display object whose children depend on its position context (quadrant, side, angle), always position the parent first, then update children. The visual update step must run AFTER the geometry step, not before.

---

### Renderers dramatize state; they do not decide rules

**Problem:** It is tempting to let animation code adjust legality, hit timing, distance, or outcome because it has the freshest visual information. That creates duplicate rule systems: `game.js` says one thing, the PixiJS renderer implies another, and agents/tests cannot reason about the game reliably.

**Fix:** Keep combat or puzzle truth in `game.js`. The renderer may overlap actions, exaggerate contact, add anticipation/recovery, or delay presentation, but it should only dramatize resolved events from `project()`.

**Rule:** PixiJS renderers should translate projected state into visuals, not re-resolve game decisions. Any legal choices, deadlines, winners, damage, score, range, or settlement belong in game logic. Presentation timing belongs in renderer helpers such as action timelines and phase curves.

---

### Anchor feedback to stable state, not animated parts

**Problem:** HUD labels, floating text, and markers anchored to animated sprites or body joints jitter, drift, or move off target during exaggerated poses. The more expressive the animation, the less stable these anchors become.

**Fix:** Choose stable anchors from state or layout: board coordinates, seat positions, nameplates, resolved tile centers, front-foot numbers, or other non-deforming reference points. Animated sprites can move around those anchors, but feedback should remain readable.

**Rule:** UI feedback should be anchored to stable presentation geometry, not transient animation geometry. Text should hold long enough to read, drift only a little, and remain near the relevant player/object even while the animated body or token moves.

---

### Helper geometry must not affect bounds, grounding, or layout

**Problem:** A renderer used helper vectors and pose metadata as if they were rendered body points. Floor clamps and bounds checks included these invisible helpers, which lifted or shifted the whole rig even though the visible feet were supposed to stay planted.

**Fix:** Separate rendered joints/objects from solver helpers. Only visible display objects or explicit layout anchors should participate in bounds, floor clamps, camera framing, hit areas, or layout measurements.

**Rule:** Metadata such as pole targets, follow vectors, target offsets, easing handles, and solver hints are not body parts or board pieces. Keep a whitelist of rendered points for clamps and bounds checks when a pose uses hidden helper geometry.

---

### Preserve model proportions; solve contact with movement and constrained IK

**Problem:** When an animation needs to reach a target, it is easy to lengthen a limb, stretch a body segment, scale a sprite, or pull the torso past its model limits. The strike, grab, token motion, or character action may hit the right pixel, but it reads as rubbery and untrustworthy.

**Fix:** Keep modeled proportions fixed. Solve reach by moving the root, using legal path travel, rotating the body, blending targets only inside the real reach envelope, and then running constrained IK or pose constraints.

**Rule:** Do not stretch limbs, bodies, tokens, or fixed-format game pieces just to make contact. If a target is out of reach, show the action falling short or move the actor through a legal animation path. Contact polish should respect the model's invariant dimensions.

---

### Build complex animations from explicit phases

**Problem:** A single blended progress value makes complex actions mushy. Setup, launch, contact, and recovery all begin at the same time, so the action drifts instead of snapping, and later tuning becomes guesswork.

**Fix:** Start from a shared neutral/setup pose and define named phase curves: load, chamber/setup, drive, contact, recovery, settle, etc. Use helpers for repeated math and constraints, but keep the pose block direct enough that the action mechanics are readable.

**Rule:** Multi-part PixiJS animations should use explicit phase curves, not one global progress blend. Snap into the important moment, then recover visibly back to the shared neutral pose. Abstract invariants like clamping, easing, and IK math; do not hide the action's intent inside an opaque helper.

---

### Keep display-object layer ownership stable during animations

**Problem:** Swapping limbs, cards, pieces, or effects between front/back containers during an animation caused visual popping. Even when the final z-order was technically correct, the sudden reparenting made objects appear to teleport through each other.

**Fix:** Keep each object in its normal container/layer throughout the action. If emphasis needs to change, adjust parent-level ordering, alpha, scale, or a small effect layer instead of moving the object itself between depth layers mid-action.

**Rule:** Display-object ownership should remain stable during a single animation. Avoid sudden z-index or container swaps for core objects. Use predictable layer groups and only change ordering at natural scene boundaries.

---

### Visual QA should force deterministic moments, not just live play

**Problem:** Animation bugs hid during live playback because the interesting frame lasted only a few milliseconds or depended on a rare exchange. Judging from normal play missed body stretching, target overshoot, grounding errors, layer pops, and recovery glitches.

**Fix:** Build deterministic visual samples for specific states and scrub animation progress around setup, contact, miss, hit, recovery, and layout extremes. Capture mobile and desktop screenshots for those forced moments.

**Rule:** For risky PixiJS animation changes, verify with forced scenarios and progress scrubbing in addition to full game tests. Screenshots at exact phase points catch visual bugs that randomized UI snapshots and live play often miss.

---

### Live QA finds bugs catalog sweeps miss

**Problem:** Catalog sweeps can prove determinism and legality without exploring the odd live paths that cheap agent workers choose. The Cards Against Clankers duplicate-card refill bug was found by a live chaos bot during play, not by the offline sweep.

**Fix:** Keep live qa-chaos runs in the release evidence for agent-facing game changes, especially after prompt, deadline, ledger, or multi-step decision work.

**Rule:** Treat the offline sweep and live chaos run as different evidence. Sweeps guard contract invariants; live QA catches transport, timing, and surprising-but-legal behavior.

---

### Runner owns format, model owns judgment

**Problem:** Rehearsal failures repeated whenever prompts asked models to maintain mechanical JSONL formats, action quoting, cursor files, or transport details by discipline alone.

**Fix:** Move mechanical formats into runner-owned helpers such as `poll-loop.mjs`, `act.mjs`, and ledger test helpers; leave the model to choose legal actions and invent QA cases.

**Rule:** If a format mistake can be checked by code, make code own it. Prompts should describe judgment boundaries, not rely on model memory for transport or ledger syntax.

---

### Prompt edits must target the live template

**Problem:** A ledger-cadence edit landed in `scripts/qa-chaos-worker-prompt.md`, but `qa-chaos.mjs` selects `qa-chaos-rest-prompt.md` for REST workers and `qa-chaos-browser-prompt.md` for browser workers.

**Fix:** Grep template resolution in the runner before changing prompt text, then edit the selected template.

**Rule:** Prompt files are code paths. Verify the template selector before editing, and document legacy prompt files until they are deleted.

---

### Short games need ledger cadence and post-game grace

**Problem:** An 80-second tic-tac-toe qa-chaos run reached game over with zero QA ledger entries because workers could finish before writing tests.

**Fix:** Require a first-action ledger entry, allow a game-over entry to satisfy that cadence when the first action ends the game, and let the runner wait briefly for non-empty ledgers after game over.

**Rule:** Short live games need both in-game ledger cadence and post-game grace. Otherwise a successful fast match can produce no QA evidence.

---

### Agent turns need human-scale deadlines

**Problem:** A 30-second tic-tac-toe deadline caused genuine low-cost Codex autoplay in live QA, even when the game itself was trivial.

**Fix:** Raise agent-playable turn deadlines to at least 60 seconds unless the game is explicitly not intended for agent play.

**Rule:** Agent-playable games give models time to poll, reason, submit, and recover from one stale response. Use 60 seconds as the practical floor for normal turns.
