(function() {
  var stateBundle = { view: null, legalActions: [] };
  var renderer = null;
  var lastSyncKey = "";
  var LOCAL_SUBMIT_LOCK_MS = 550;

  function decisionOf(option) {
    return option && option.decision ? option.decision : option;
  }

  function collectDecisions(actions, out) {
    var i, d;
    out = out || [];
    if (!actions) return out;
    for (i = 0; i < actions.length; i++) {
      d = decisionOf(actions[i]);
      if (!d) continue;
      if (d.type === "choose" && d.options) collectDecisions(d.options, out);
      else out.push(d);
    }
    return out;
  }

  function fireActions(actions) {
    var out = [];
    var flat = collectDecisions(actions, []);
    var i, d;
    for (i = 0; i < flat.length; i++) {
      d = flat[i];
      if (d && d.type === "fire") out.push(d);
    }
    return out;
  }

  function draftActions(actions) {
    var out = [];
    var flat = collectDecisions(actions, []);
    var i, d;
    for (i = 0; i < flat.length; i++) {
      d = flat[i];
      if (d && (d.type === "draft_pick" || d.type === "draft_random_all")) out.push(d);
    }
    return out;
  }

  function weaponName(view, id) {
    return view && view.weapons && view.weapons[id] ? view.weapons[id].name : id;
  }

  function currentKey(view) {
    return view && view.yourKey ? view.yourKey : view ? view.currentKey : "p1";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function worldWidth(view) {
    return (view && view.world && view.world.width) || (view && view.terrainGrid && view.terrainGrid.width) || 1600;
  }

  function tankHeight(view) {
    return (view && view.world && view.world.tankHeight) || 26;
  }

  function inputNumber(id, fallback) {
    var input = document.getElementById(id);
    var value = input ? Number(input.value) : NaN;
    return isFinite(value) ? value : fallback;
  }

  function inputMinMax(input, fallbackMin, fallbackMax) {
    var min = input && input.min !== "" ? Number(input.min) : fallbackMin;
    var max = input && input.max !== "" ? Number(input.max) : fallbackMax;
    if (!isFinite(min)) min = fallbackMin;
    if (!isFinite(max)) max = fallbackMax;
    return { min: min, max: max };
  }

  function copyTank(tank) {
    var out = {};
    var key;
    for (key in tank) out[key] = tank[key];
    return out;
  }

  function copyAim(aim) {
    return { angle: aim && aim.angle !== undefined ? aim.angle : 45, power: aim && aim.power !== undefined ? aim.power : 82 };
  }

  function topYAtGrid(grid, x) {
    var cell = grid && grid.cellSize ? grid.cellSize : 8;
    var columns = grid && grid.columns ? grid.columns : [];
    var col = clamp(Math.floor(x / cell), 0, Math.max(0, columns.length - 1));
    var rows = Math.ceil(((grid && grid.height) || 900) / cell);
    var column = columns[col] || [];
    var best = rows - 1;
    var i;
    for (i = 0; i < column.length; i++) {
      if (column[i].h > 0 && column[i].y < best) best = column[i].y;
    }
    return best * cell;
  }

  function previewViewFromControls(view) {
    var key = currentKey(view);
    var moveInput = document.getElementById("move-input");
    var angleInput = document.getElementById("angle-input");
    var powerInput = document.getElementById("power-input");
    var moveBounds = inputMinMax(moveInput, -64, 64);
    var angleBounds = inputMinMax(angleInput, 5, 85);
    var powerBounds = inputMinMax(powerInput, 20, 100);
    var move, angle, power, preview, worldW, tank;
    if (!view || view.phase !== "battle" || view.currentKey !== key || !view.tanks || !view.tanks[key]) return view;
    move = clamp(inputNumber("move-input", 0), moveBounds.min, moveBounds.max);
    angle = clamp(inputNumber("angle-input", view.aim && view.aim[key] ? view.aim[key].angle : 45), angleBounds.min, angleBounds.max);
    power = clamp(inputNumber("power-input", view.aim && view.aim[key] ? view.aim[key].power : 82), powerBounds.min, powerBounds.max);
    preview = {};
    for (key in view) preview[key] = view[key];
    key = currentKey(view);
    preview.tanks = { p1: copyTank(view.tanks.p1), p2: copyTank(view.tanks.p2) };
    preview.aim = { p1: copyAim(view.aim && view.aim.p1), p2: copyAim(view.aim && view.aim.p2) };
    preview.aim[key].angle = angle;
    preview.aim[key].power = power;
    tank = preview.tanks[key];
    worldW = worldWidth(view);
    tank.x = round1(clamp(tank.x + move, 80, worldW - 80));
    if (view.terrainGrid) tank.y = round1(topYAtGrid(view.terrainGrid, tank.x) - tankHeight(view) / 2);
    preview.preview = { key: key, move: move, angle: angle, power: power };
    return preview;
  }

  function refreshPreview() {
    updateLabels();
    if (renderer && stateBundle.view) renderer.render(previewViewFromControls(stateBundle.view));
  }

  function setTelemetry(view, status) {
    var t = document.getElementById("telemetry");
    if (!t) return;
    t.dataset.phase = view && view.phase ? view.phase : "loading";
    t.dataset.status = status || (view && view.phase) || "loading";
    t.dataset.player = view && view.yourKey ? view.yourKey : "spectator";
  }

  function canDraftSlot(actions, slot) {
    var i;
    for (i = 0; i < actions.length; i++) if (actions[i].type === "draft_pick" && actions[i].slot === slot) return actions[i];
    return null;
  }

  function submitDraftAction(decision) {
    if (!decision || !window.playgent || !window.playgent.submitAction) return;
    if (decision.type === "draft_random_all") {
      window.playgent.submitAction({ type: "draft_random_all" });
    } else {
      window.playgent.submitAction({ type: "draft_pick", slot: decision.slot, weapon: decision.weapon });
    }
    setTelemetry(stateBundle.view, "draft-submitted");
  }

  function randomDraftAction(actions) {
    var i;
    for (i = 0; i < actions.length; i++) if (actions[i].type === "draft_random_all") return actions[i];
    return actions.length ? actions[0] : null;
  }

  function submitRandomDraftAction() {
    submitDraftAction(randomDraftAction(draftActions(stateBundle.legalActions)));
  }

  function renderLoadoutList(node, view, key) {
    var ids = view && view.loadouts && view.loadouts[key] ? view.loadouts[key] : [];
    var i, line, icon, name;
    node.innerHTML = "";
    for (i = 0; i < ids.length; i++) {
      line = document.createElement("div");
      line.className = "loadout-line";
      icon = document.createElement("span");
      icon.className = "weapon-dot";
      name = document.createElement("span");
      name.textContent = weaponName(view, ids[i]);
      line.appendChild(icon);
      line.appendChild(name);
      node.appendChild(line);
    }
    if (!ids.length) {
      line = document.createElement("div");
      line.className = "loadout-empty";
      line.textContent = "Awaiting picks";
      node.appendChild(line);
    }
  }

  function renderSelect(view, legalActions) {
    var panel = document.getElementById("select-panel");
    var grid = document.getElementById("select-grid");
    var status = document.getElementById("select-status");
    var title = document.getElementById("select-title");
    var random = document.getElementById("select-random");
    var actions = draftActions(legalActions);
    var i, item, card, strong, span, meta, w, p1, p2, icon, action, activeKey, loadoutSize, picksMade, picksTotal, randomChoice;
    if (!view || view.phase !== "draft") {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    picksMade = view.draft ? view.draft.picksMade : 0;
    picksTotal = view.draft ? view.draft.picksTotal : 20;
    loadoutSize = view.draft ? view.draft.loadoutSize : 10;
    activeKey = view.draft && view.draft.nextPickKey ? view.draft.nextPickKey : view.currentKey;
    title.textContent = "Weapon Shop";
    status.textContent = activeKey ? activeKey.toUpperCase() + " pick " + (picksMade + 1) + "/" + picksTotal : "Draft complete";
    grid.innerHTML = "";
    for (i = 0; view.draftPool && i < view.draftPool.length; i++) {
      item = view.draftPool[i];
      w = view.weapons[item.weapon] || {};
      action = canDraftSlot(actions, item.slot);
      card = document.createElement("button");
      card.type = "button";
      card.className = "weapon-card " + (item.owner ? item.owner : "open") + (action ? " pickable" : "");
      card.disabled = !action;
      if (action) {
        card.addEventListener("click", (function(decision) {
          return function() { submitDraftAction(decision); };
        })(action));
      }
      icon = document.createElement("span");
      icon.className = "weapon-icon";
      strong = document.createElement("strong");
      strong.textContent = w.name || item.weapon;
      span = document.createElement("span");
      span.textContent = w.archetype || "weapon";
      meta = document.createElement("em");
      meta.textContent = item.owner ? item.owner.toUpperCase() + " #" + item.loadoutSlot : action ? "Pick" : "Waiting";
      card.appendChild(icon);
      card.appendChild(strong);
      card.appendChild(span);
      card.appendChild(meta);
      grid.appendChild(card);
    }
    p1 = document.getElementById("loadout-p1");
    p2 = document.getElementById("loadout-p2");
    document.getElementById("loadout-p1-title").textContent = "P1 (" + ((view.loadouts.p1 || []).length) + "/" + loadoutSize + ")";
    document.getElementById("loadout-p2-title").textContent = "P2 (" + ((view.loadouts.p2 || []).length) + "/" + loadoutSize + ")";
    renderLoadoutList(p1, view, "p1");
    renderLoadoutList(p2, view, "p2");
    if (random) {
      randomChoice = randomDraftAction(actions);
      random.textContent = randomChoice && randomChoice.type === "draft_random_all" ? "Random All" : "Random";
      random.disabled = !randomChoice;
    }
  }

  function renderActions(view, legalActions) {
    var panel = document.getElementById("action-panel");
    var select = document.getElementById("weapon-select");
    var actions = fireActions(legalActions);
    var key = currentKey(view);
    var inventory = view && view.inventory && view.inventory[key] ? view.inventory[key] : [];
    var current = select.value;
    var canFire = !!actions.length && view && view.phase === "battle" && view.currentKey === key;
    var i, option, id, syncKey;
    if (!view || view.phase !== "battle") {
      panel.hidden = true;
      lastSyncKey = "";
      return;
    }
    panel.hidden = false;
    select.innerHTML = "";
    for (i = 0; i < inventory.length; i++) {
      id = inventory[i];
      option = document.createElement("option");
      option.value = id;
      option.textContent = weaponName(view, id);
      select.appendChild(option);
    }
    if (current && inventory.indexOf(current) >= 0) select.value = current;
    else if (inventory.length) select.value = inventory[0];
    syncKey = [
      key,
      view.currentKey,
      view.turnNumber,
      view.lastShot ? view.lastShot.shotId : "opening",
      view.aim && view.aim[key] ? view.aim[key].angle : "45",
      view.aim && view.aim[key] ? view.aim[key].power : "82",
      inventory.join(","),
    ].join("|");
    if (syncKey !== lastSyncKey) {
      syncControlsFromView(view);
      lastSyncKey = syncKey;
    } else updateLabels();
    updateWeaponReadout();
    updateShotRecap(view);
    setControlMode(view, canFire, actions);
  }

  function syncControlsFromView(view) {
    var key = currentKey(view);
    var aim = view && view.aim && view.aim[key] ? view.aim[key] : { angle: 45, power: 82 };
    var fuel = view && view.moveFuel && view.moveFuel[key] !== undefined ? view.moveFuel[key] : 0;
    var move = document.getElementById("move-input");
    var angle = document.getElementById("angle-input");
    var power = document.getElementById("power-input");
    var maxMove = Math.min(64, fuel);
    move.min = -maxMove;
    move.max = maxMove;
    move.value = 0;
    angle.value = aim.angle;
    power.value = aim.power;
    document.getElementById("weapon-count").textContent = "(" + ((view.inventory && view.inventory[key] && view.inventory[key].length) || 0) + ")";
    updateLabels();
  }

  function updateLabels() {
    var move = document.getElementById("move-input");
    var angle = document.getElementById("angle-input");
    var power = document.getElementById("power-input");
    var view = stateBundle.view;
    var key = currentKey(view);
    var fuel = view && view.moveFuel && view.moveFuel[key] !== undefined ? view.moveFuel[key] : 0;
    document.getElementById("move-value").textContent = move.value;
    document.getElementById("angle-value").textContent = angle.value;
    document.getElementById("power-value").textContent = power.value;
    document.getElementById("move-fuel").textContent = "fuel " + fuel;
  }

  function updateWeaponReadout() {
    var view = stateBundle.view;
    var select = document.getElementById("weapon-select");
    var readout = document.getElementById("weapon-readout");
    var w = view && view.weapons ? view.weapons[select.value] : null;
    var items, i, span;
    readout.innerHTML = "";
    if (!w) return;
    items = [w.archetype || "weapon", w.scoreLabel || ("hit " + (w.impactPoints || w.points || 0)), "diameter " + Math.round((w.radius || 0) * 2), w.material || "terrain"];
    for (i = 0; i < items.length; i++) {
      span = document.createElement("span");
      span.textContent = items[i];
      readout.appendChild(span);
    }
  }

  function updateShotRecap(view) {
    var recap = document.getElementById("shot-recap");
    var shot = view && view.lastShot;
    var delta, actor, sign, value;
    if (!recap) return;
    if (!shot || !shot.weaponName || view.phase !== "battle") {
      recap.hidden = true;
      recap.textContent = "";
      return;
    }
    actor = shot.actor || "";
    delta = shot.scoreDelta || shot.delta || {};
    value = delta && delta[actor] ? delta[actor] : 0;
    sign = value > 0 ? "+" : "";
    recap.hidden = false;
    recap.textContent = "Last: " + shot.weaponName + " " + sign + value + " pts";
  }

  function setControlMode(view, canFire, actions) {
    var waiting = view && view.phase === "battle" && !canFire;
    var fire = document.getElementById("fire-button");
    var panel = document.getElementById("action-panel");
    var controls = [
      "weapon-select",
      "move-input",
      "move-left",
      "move-right",
      "angle-input",
      "angle-down",
      "angle-up",
      "power-input",
      "power-down",
      "power-up",
    ];
    var i;
    for (i = 0; i < controls.length; i++) {
      document.getElementById(controls[i]).disabled = waiting;
    }
    fire.disabled = !canFire || !actions.length;
    fire.textContent = waiting && view && view.currentKey ? view.currentKey.toUpperCase() + " TURN" : "FIRE";
    panel.dataset.mode = waiting ? "waiting" : "ready";
  }

  function step(id, delta) {
    var input = document.getElementById(id);
    var next = Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) + delta));
    input.value = String(next);
    refreshPreview();
  }

  function refreshAfterLocalDebounce() {
    window.setTimeout(function() {
      renderActions(stateBundle.view, stateBundle.legalActions);
      setTelemetry(stateBundle.view, document.getElementById("action-panel").dataset.mode || "ready");
    }, LOCAL_SUBMIT_LOCK_MS + 40);
  }

  function submitFire() {
    var view = stateBundle.view;
    var actions = fireActions(stateBundle.legalActions);
    var weapon = document.getElementById("weapon-select").value;
    var legal = false;
    var i;
    for (i = 0; i < actions.length; i++) if (actions[i].weapon === weapon) legal = true;
    if (!legal || !window.playgent || !window.playgent.submitAction) return;
    window.playgent.submitAction({
      type: "fire",
      weapon: weapon,
      move: Number(document.getElementById("move-input").value),
      angle: Number(document.getElementById("angle-input").value),
      power: Number(document.getElementById("power-input").value),
      note: "Manual shot.",
    });
    document.getElementById("fire-button").disabled = true;
    document.getElementById("fire-button").textContent = "...";
    refreshAfterLocalDebounce();
    setTelemetry(view, "submitted");
  }

  function render(view, legalActions, context) {
    stateBundle.view = view;
    stateBundle.legalActions = legalActions || [];
    if (context && context.myId && view && !view.yourKey && view.tanks) {
      if (context.myId === view.tanks.p1.id) view.yourKey = "p1";
      else if (context.myId === view.tanks.p2.id) view.yourKey = "p2";
    }
    renderSelect(view, legalActions);
    renderActions(view, legalActions);
    if (renderer) renderer.render(previewViewFromControls(view));
    setTelemetry(view, view && view.phase === "battle" ? document.getElementById("action-panel").dataset.mode || "ready" : "selecting");
  }

  function init() {
    renderer = new window.ArcTanksRenderer(document.getElementById("game-container"));
    renderer.init();
    document.getElementById("weapon-select").addEventListener("change", updateWeaponReadout);
    document.getElementById("move-input").addEventListener("input", refreshPreview);
    document.getElementById("angle-input").addEventListener("input", refreshPreview);
    document.getElementById("power-input").addEventListener("input", refreshPreview);
    document.getElementById("move-left").addEventListener("click", function() { step("move-input", -8); });
    document.getElementById("move-right").addEventListener("click", function() { step("move-input", 8); });
    document.getElementById("angle-down").addEventListener("click", function() { step("angle-input", -1); });
    document.getElementById("angle-up").addEventListener("click", function() { step("angle-input", 1); });
    document.getElementById("power-down").addEventListener("click", function() { step("power-input", -2); });
    document.getElementById("power-up").addEventListener("click", function() { step("power-input", 2); });
    document.getElementById("fire-button").addEventListener("click", submitFire);
    document.getElementById("select-random").addEventListener("click", submitRandomDraftAction);
    if (window.playgent && window.playgent.onStateChange) {
      window.playgent.onStateChange(function(view, legalActions, context) {
        render(view, legalActions, context);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
