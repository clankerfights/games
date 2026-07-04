// @ts-nocheck — vanilla JS for VM sandbox

// === MAP: 6x3 grid, 18 territories ===
var MAP = {
  ironhold: { adj: ["northwood", "westmarch"], sc: true, row: 0, col: 0 },
  northwood: {
    adj: ["ironhold", "stormwall", "highland"],
    sc: false,
    row: 0,
    col: 1,
  },
  stormwall: { adj: ["northwood", "frostpeak"], sc: true, row: 0, col: 2 },
  westmarch: {
    adj: ["ironhold", "highland", "moorland"],
    sc: false,
    row: 1,
    col: 0,
  },
  highland: {
    adj: ["northwood", "westmarch", "frostpeak", "crossroads"],
    sc: true,
    row: 1,
    col: 1,
  },
  frostpeak: {
    adj: ["stormwall", "highland", "eastmarch"],
    sc: false,
    row: 1,
    col: 2,
  },
  moorland: {
    adj: ["westmarch", "crossroads", "ashwick"],
    sc: false,
    row: 2,
    col: 0,
  },
  crossroads: {
    adj: ["highland", "moorland", "eastmarch", "deepvale"],
    sc: true,
    row: 2,
    col: 1,
  },
  eastmarch: {
    adj: ["frostpeak", "crossroads", "coastwatch"],
    sc: false,
    row: 2,
    col: 2,
  },
  ashwick: {
    adj: ["moorland", "deepvale", "southwood"],
    sc: false,
    row: 3,
    col: 0,
  },
  deepvale: {
    adj: ["crossroads", "ashwick", "coastwatch", "kingsbridge"],
    sc: true,
    row: 3,
    col: 1,
  },
  coastwatch: {
    adj: ["eastmarch", "deepvale", "thornfield"],
    sc: false,
    row: 3,
    col: 2,
  },
  southwood: {
    adj: ["ashwick", "kingsbridge", "duskwall"],
    sc: false,
    row: 4,
    col: 0,
  },
  kingsbridge: {
    adj: ["deepvale", "southwood", "thornfield", "goldplain"],
    sc: true,
    row: 4,
    col: 1,
  },
  thornfield: {
    adj: ["coastwatch", "kingsbridge", "sunhollow"],
    sc: false,
    row: 4,
    col: 2,
  },
  duskwall: { adj: ["southwood", "goldplain"], sc: true, row: 5, col: 0 },
  goldplain: {
    adj: ["duskwall", "kingsbridge", "sunhollow"],
    sc: false,
    row: 5,
    col: 1,
  },
  sunhollow: { adj: ["thornfield", "goldplain"], sc: true, row: 5, col: 2 },
};

var TERR_LIST = Object.keys(MAP);
var SC_LIST = TERR_LIST.filter(function (t) {
  return MAP[t].sc;
});
var HOME_SCS = ["ironhold", "stormwall", "sunhollow", "duskwall"];
var STARTS = [
  ["ironhold", "northwood", "westmarch"],
  ["stormwall", "frostpeak", "eastmarch"],
  ["sunhollow", "thornfield", "goldplain"],
  ["duskwall", "southwood", "ashwick"],
];
var FACTIONS = [
  { color: "#4a90d9" },
  { color: "#2ecc71" },
  { color: "#f39c12" },
  { color: "#9b59b6" },
];

// Grid layout for agentView (row-major order)
var GRID = [
  ["ironhold", "northwood", "stormwall"],
  ["westmarch", "highland", "frostpeak"],
  ["moorland", "crossroads", "eastmarch"],
  ["ashwick", "deepvale", "coastwatch"],
  ["southwood", "kingsbridge", "thornfield"],
  ["duskwall", "goldplain", "sunhollow"],
];

// === PRNG ===
function seededRandom(seed) {
  var s = (seed + 0x6d2b79f5) | 0;
  var t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function advanceSeed(seed) {
  return (seed + 0x6d2b79f5) | 0;
}

// === HELPERS ===
function playerArmies(armies, pid) {
  var result = [];
  for (var t in armies) {
    if (armies[t] === pid) result.push(t);
  }
  return result.toSorted();
}

function playerSCCount(scs, pid) {
  var count = 0;
  for (var s in scs) {
    if (scs[s] === pid) count++;
  }
  return count;
}

function copyObj(obj) {
  var result = {};
  for (var k in obj) result[k] = obj[k];
  return result;
}

function deepCopyOrders(orders) {
  var result = {};
  for (var pid in orders) {
    result[pid] = {};
    for (var t in orders[pid]) {
      result[pid][t] = copyObj(orders[pid][t]);
    }
  }
  return result;
}

function displayName(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function playerDisplayName(state, pid) {
  if (!pid) return "?";
  if (state.playerNames && state.playerNames[pid])
    return state.playerNames[pid];
  return pid;
}

function orderActionLabel(action) {
  if (!action?.type) return "action";
  if (action.type === "autoCompleteOrders") return "autoCompleteOrders";
  if (action.type !== "order") return action.type;
  if (action.order === "hold") return "hold " + displayName(action.territory);
  if (action.order === "move")
    return (
      "move " + displayName(action.territory) + "->" + displayName(action.to)
    );
  if (action.order === "support") {
    if (action.supportFrom === action.supportTo) {
      return (
        "support " +
        displayName(action.territory) +
        ": " +
        displayName(action.supportTo) +
        " hold"
      );
    }
    return (
      "support " +
      displayName(action.territory) +
      ": " +
      displayName(action.supportFrom) +
      "->" +
      displayName(action.supportTo)
    );
  }
  return action.order + " " + displayName(action.territory);
}

function orderActionOption(action) {
  return { action: action, label: orderActionLabel(action) };
}

function activePlayers(state) {
  return state.players.filter(function (pid) {
    return (
      playerArmies(state.armies, pid).length > 0 ||
      playerSCCount(state.supplyCenters, pid) > 0
    );
  });
}

// === ORDER RESOLUTION ===
function resolveAllOrders(state) {
  var armies = state.armies;
  var t, pid, i, j, k, m;

  // Build order map: territory → { type, to, supportFrom, supportTo, playerId }
  var allOrders = {};
  for (t in armies) {
    allOrders[t] = { type: "hold", playerId: armies[t] };
  }
  for (pid in state.pendingOrders) {
    var po = state.pendingOrders[pid];
    for (t in po) {
      if (armies[t] === pid) {
        var o = po[t];
        allOrders[t] = {
          type: o.order || "hold",
          playerId: pid,
          to: o.to || null,
          supportFrom: o.supportFrom || null,
          supportTo: o.supportTo || null,
        };
      }
    }
  }

  // Validate moves: target must be adjacent
  for (t in allOrders) {
    if (allOrders[t].type === "move") {
      if (!allOrders[t].to || MAP[t].adj.indexOf(allOrders[t].to) === -1) {
        allOrders[t] = { type: "hold", playerId: allOrders[t].playerId };
      }
    }
    // Validate supports: must be adjacent to supportTo
    if (allOrders[t].type === "support") {
      if (
        !allOrders[t].supportTo ||
        MAP[t].adj.indexOf(allOrders[t].supportTo) === -1
      ) {
        allOrders[t] = { type: "hold", playerId: allOrders[t].playerId };
      }
    }
  }

  // Determine which supports are cut (enemy move targets supporter's territory)
  var supportCut = {};
  for (t in allOrders) {
    if (allOrders[t].type === "support") {
      for (m in allOrders) {
        if (
          allOrders[m].type === "move" &&
          allOrders[m].to === t &&
          allOrders[m].playerId !== allOrders[t].playerId
        ) {
          supportCut[t] = true;
          break;
        }
      }
    }
  }

  // Calculate strength of an order
  function getStrength(territory) {
    var order = allOrders[territory];
    var str = 1;
    for (var s in allOrders) {
      if (s === territory || allOrders[s].type !== "support" || supportCut[s])
        continue;
      var sup = allOrders[s];
      if (
        order.type === "hold" &&
        sup.supportFrom === territory &&
        sup.supportTo === territory
      ) {
        str++;
      } else if (
        order.type === "move" &&
        sup.supportFrom === territory &&
        sup.supportTo === order.to
      ) {
        str++;
      }
    }
    return str;
  }

  // Build move targets: dest → [{from, strength, playerId}]
  var moveTargets = {};
  var dest;
  for (t in allOrders) {
    if (allOrders[t].type === "move") {
      dest = allOrders[t].to;
      if (!moveTargets[dest]) moveTargets[dest] = [];
      moveTargets[dest].push({
        from: t,
        strength: getStrength(t),
        playerId: allOrders[t].playerId,
      });
    }
  }

  // Iterative resolution
  var moveResult = {}; // territory → true (success) or false (fail)
  var changed = true;
  var iter = 0;

  while (changed && iter < 30) {
    changed = false;
    iter++;

    // Head-to-head conflicts first
    for (t in allOrders) {
      if (allOrders[t].type !== "move" || moveResult[t] !== undefined) continue;
      var h2hDest = allOrders[t].to;
      if (
        allOrders[h2hDest] &&
        allOrders[h2hDest].type === "move" &&
        allOrders[h2hDest].to === t &&
        moveResult[h2hDest] === undefined
      ) {
        var str1 = getStrength(t);
        var str2 = getStrength(h2hDest);
        if (str1 > str2) {
          moveResult[t] = true;
          moveResult[h2hDest] = false;
        } else if (str2 > str1) {
          moveResult[h2hDest] = true;
          moveResult[t] = false;
        } else {
          moveResult[t] = false;
          moveResult[h2hDest] = false;
        }
        changed = true;
      }
    }

    // Resolve by destination
    for (dest in moveTargets) {
      var attackers = moveTargets[dest];
      var pending = [];
      for (i = 0; i < attackers.length; i++) {
        if (moveResult[attackers[i].from] === undefined)
          pending.push(attackers[i]);
      }
      if (pending.length === 0) continue;

      // Determine defense
      var defStrength = 0;
      var canResolve = true;

      if (allOrders[dest]) {
        if (
          allOrders[dest].type === "hold" ||
          allOrders[dest].type === "support"
        ) {
          defStrength = getStrength(dest);
        } else if (allOrders[dest].type === "move") {
          if (moveResult[dest] === true) {
            defStrength = 0;
          } else if (moveResult[dest] === false) {
            defStrength = 1;
          } else {
            canResolve = false;
          }
        }
      }
      if (!canResolve) continue;

      // Check if someone already won this destination
      var alreadyWon = false;
      for (i = 0; i < attackers.length; i++) {
        if (moveResult[attackers[i].from] === true) {
          alreadyWon = true;
          break;
        }
      }
      if (alreadyWon) {
        for (i = 0; i < pending.length; i++)
          moveResult[pending[i].from] = false;
        changed = true;
        continue;
      }

      // Sort pending by strength desc
      pending.sort(function (a, b) {
        return b.strength - a.strength;
      });

      if (pending.length === 1) {
        moveResult[pending[0].from] = pending[0].strength > defStrength;
        changed = true;
      } else {
        if (
          pending[0].strength > pending[1].strength &&
          pending[0].strength > defStrength
        ) {
          moveResult[pending[0].from] = true;
          for (i = 1; i < pending.length; i++)
            moveResult[pending[i].from] = false;
        } else {
          for (i = 0; i < pending.length; i++)
            moveResult[pending[i].from] = false;
        }
        changed = true;
      }
    }
  }

  // Unresolved = fail
  for (t in allOrders) {
    if (allOrders[t].type === "move" && moveResult[t] === undefined)
      moveResult[t] = false;
  }

  // Build new armies map
  var newArmies = {};
  var dislodged = {}; // territory → playerId

  // Place non-movers and failed movers
  for (t in allOrders) {
    if (allOrders[t].type !== "move" || moveResult[t] === false) {
      newArmies[t] = allOrders[t].playerId;
    }
  }

  // Place successful movers (may dislodge defenders)
  for (t in allOrders) {
    if (allOrders[t].type === "move" && moveResult[t] === true) {
      var moveDest = allOrders[t].to;
      if (
        newArmies[moveDest] &&
        newArmies[moveDest] !== allOrders[t].playerId
      ) {
        dislodged[moveDest] = newArmies[moveDest];
      }
      delete newArmies[moveDest];
      newArmies[moveDest] = allOrders[t].playerId;
    }
  }

  // Handle dislodged armies: retreat to adjacent empty territory or disband
  var retreats = {};
  var disbanded = [];
  for (var dt in dislodged) {
    var dPid = dislodged[dt];
    var retreatOpts = MAP[dt].adj
      .filter(function (a) {
        return !newArmies[a];
      })
      .toSorted();
    if (retreatOpts.length > 0) {
      newArmies[retreatOpts[0]] = dPid;
      retreats[dt] = retreatOpts[0];
    } else {
      disbanded.push({ territory: dt, playerId: dPid });
    }
  }

  // Update supply centers
  var newSCs = copyObj(state.supplyCenters);
  for (i = 0; i < SC_LIST.length; i++) {
    var sc = SC_LIST[i];
    if (newArmies[sc]) {
      newSCs[sc] = newArmies[sc];
    }
  }

  // Build results for display
  var orderDisplay = {};
  for (t in allOrders) {
    orderDisplay[t] = {
      type: allOrders[t].type,
      playerId: allOrders[t].playerId,
      to: allOrders[t].to,
      supportFrom: allOrders[t].supportFrom,
      supportTo: allOrders[t].supportTo,
      strength: getStrength(t),
      succeeded: allOrders[t].type === "move" ? moveResult[t] : true,
    };
  }

  return {
    newArmies: newArmies,
    newSCs: newSCs,
    orderDisplay: orderDisplay,
    retreats: retreats,
    disbanded: disbanded,
  };
}

// === REINFORCEMENT ===
function doReinforcement(state) {
  var newArmies = copyObj(state.armies);
  var changes = {};
  var pid, i;

  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    var scCount = playerSCCount(state.supplyCenters, pid);
    var armyCount = playerArmies(newArmies, pid).length;
    var diff = scCount - armyCount;
    changes[pid] = {
      scCount: scCount,
      oldArmies: armyCount,
      diff: diff,
      built: [],
      disbanded: [],
    };

    if (diff > 0) {
      // Build: place on empty owned SCs (home first, then alphabetical)
      var ownedSCs = SC_LIST.filter(function (sc) {
        return state.supplyCenters[sc] === pid && !newArmies[sc];
      });
      // Sort: home SC first, then alphabetical
      var homeSC = HOME_SCS[state.players.indexOf(pid)];
      ownedSCs.sort(function (a, b) {
        if (a === homeSC) return -1;
        if (b === homeSC) return 1;
        return a < b ? -1 : 1;
      });
      for (var b = 0; b < diff && b < ownedSCs.length; b++) {
        newArmies[ownedSCs[b]] = pid;
        changes[pid].built.push(ownedSCs[b]);
      }
    } else if (diff < 0) {
      // Disband: remove armies furthest from home (alphabetical reverse as tiebreaker)
      var myArmies = playerArmies(newArmies, pid);
      myArmies.reverse(); // alphabetical reverse
      for (var d = 0; d < -diff && d < myArmies.length; d++) {
        changes[pid].disbanded.push(myArmies[d]);
        delete newArmies[myArmies[d]];
      }
    }
  }

  return { newArmies: newArmies, changes: changes };
}

// === PHASE TRANSITIONS ===
function startNextRound(state) {
  var newRound = state.round + 1;
  // Check win or max rounds
  var winner = checkWinner(state);
  if (winner || newRound > state.maxRounds) {
    return {
      phase: "gameOverDisplay",
      round: state.round,
      maxRounds: state.maxRounds,
      players: state.players,
      playerNames: state.playerNames,
      factionMap: state.factionMap,
      armies: state.armies,
      supplyCenters: state.supplyCenters,
      pendingOrders: {},
      submitted: {},
      ready: {},
      resolveResults: state.resolveResults,
      reinforceResults: state.reinforceResults,
      seed: state.seed,
      actionCount: state.actionCount + 1,
    };
  }
  return {
    phase: "negotiate",
    round: newRound,
    maxRounds: state.maxRounds,
    players: state.players,
    playerNames: state.playerNames,
    factionMap: state.factionMap,
    armies: state.armies,
    supplyCenters: state.supplyCenters,
    pendingOrders: {},
    submitted: {},
    ready: {},
    resolveResults: null,
    reinforceResults: null,
    seed: state.seed,
    actionCount: state.actionCount + 1,
  };
}

function checkWinner(state) {
  for (var i = 0; i < state.players.length; i++) {
    if (playerSCCount(state.supplyCenters, state.players[i]) >= 5) {
      return state.players[i];
    }
  }
  return null;
}

// === GAME LOGIC ===
var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  setup: function (ctx) {
    var playerIds = ctx.players.map(function (p) {
      return p.id;
    });
    var armies = {};
    var supplyCenters = {};
    var factionMap = {};
    var playerNames = {};
    var i, j;

    for (i = 0; i < playerIds.length; i++) {
      factionMap[playerIds[i]] = i;
      playerNames[playerIds[i]] =
        ctx.players[i].username || ctx.players[i].name || playerIds[i];
      supplyCenters[HOME_SCS[i]] = playerIds[i];
      for (j = 0; j < STARTS[i].length; j++) {
        armies[STARTS[i][j]] = playerIds[i];
      }
    }

    return {
      phase: "negotiate",
      round: 1,
      maxRounds: 10,
      players: playerIds,
      playerNames: playerNames,
      factionMap: factionMap,
      armies: armies,
      supplyCenters: supplyCenters,
      pendingOrders: {},
      submitted: {},
      ready: {},
      resolveResults: null,
      reinforceResults: null,
      seed: ctx.seed || Math.floor(ctx.random.next() * 2147483647),
      actionCount: 0,
    };
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    var i, pid, newState;

    // === SYSTEM ACTIONS (before player guard) ===

    if (action.type === "endNegotiation") {
      if (state.phase !== "negotiate") return state;
      return {
        phase: "orders",
        round: state.round,
        maxRounds: state.maxRounds,
        players: state.players,
        playerNames: state.playerNames,
        factionMap: state.factionMap,
        armies: state.armies,
        supplyCenters: state.supplyCenters,
        pendingOrders: {},
        submitted: {},
        ready: {},
        resolveResults: null,
        reinforceResults: null,
        seed: state.seed,
        actionCount: state.actionCount + 1,
      };
    }

    if (action.type === "autoSubmit") {
      if (state.phase !== "orders") return state;
      var newPending = deepCopyOrders(state.pendingOrders);
      var newSubmitted = copyObj(state.submitted);

      for (i = 0; i < state.players.length; i++) {
        pid = state.players[i];
        var pArmies = playerArmies(state.armies, pid);
        if (pArmies.length === 0 || newSubmitted[pid]) continue;
        if (!newPending[pid]) newPending[pid] = {};
        for (var a = 0; a < pArmies.length; a++) {
          if (!newPending[pid][pArmies[a]]) {
            newPending[pid][pArmies[a]] = { order: "hold" };
          }
        }
        newSubmitted[pid] = true;
      }

      var resolveResult = resolveAllOrders({
        armies: state.armies,
        supplyCenters: state.supplyCenters,
        pendingOrders: newPending,
        players: state.players,
      });

      return {
        phase: "resolve",
        round: state.round,
        maxRounds: state.maxRounds,
        players: state.players,
        playerNames: state.playerNames,
        factionMap: state.factionMap,
        armies: resolveResult.newArmies,
        supplyCenters: resolveResult.newSCs,
        preResolveArmies: state.armies,
        preResolveSCs: state.supplyCenters,
        pendingOrders: newPending,
        submitted: newSubmitted,
        ready: {},
        resolveResults: resolveResult,
        reinforceResults: null,
        seed: state.seed,
        actionCount: state.actionCount + 1,
      };
    }

    if (action.type === "advanceFromResolve") {
      if (state.phase !== "resolve") return state;

      // Check for winner
      var winner = checkWinner(state);
      if (winner || state.round >= state.maxRounds) {
        return {
          phase: "gameOverDisplay",
          round: state.round,
          maxRounds: state.maxRounds,
          players: state.players,
          playerNames: state.playerNames,
          factionMap: state.factionMap,
          armies: state.armies,
          supplyCenters: state.supplyCenters,
          pendingOrders: state.pendingOrders,
          submitted: state.submitted,
          ready: {},
          resolveResults: state.resolveResults,
          reinforceResults: null,
          seed: state.seed,
          actionCount: state.actionCount + 1,
        };
      }

      // Reinforcement on even rounds
      if (state.round % 2 === 0) {
        var reinforceResult = doReinforcement(state);
        return {
          phase: "reinforce",
          round: state.round,
          maxRounds: state.maxRounds,
          players: state.players,
          playerNames: state.playerNames,
          factionMap: state.factionMap,
          armies: reinforceResult.newArmies,
          preReinforceArmies: state.armies,
          supplyCenters: state.supplyCenters,
          pendingOrders: state.pendingOrders,
          submitted: state.submitted,
          ready: {},
          resolveResults: state.resolveResults,
          reinforceResults: reinforceResult.changes,
          seed: state.seed,
          actionCount: state.actionCount + 1,
        };
      }

      return startNextRound(state);
    }

    if (action.type === "advanceFromReinforce") {
      if (state.phase !== "reinforce") return state;
      return startNextRound(state);
    }

    if (action.type === "finalize") {
      if (state.phase !== "gameOverDisplay") return state;
      return {
        phase: "gameOver",
        round: state.round,
        maxRounds: state.maxRounds,
        players: state.players,
        playerNames: state.playerNames,
        factionMap: state.factionMap,
        armies: state.armies,
        supplyCenters: state.supplyCenters,
        pendingOrders: state.pendingOrders,
        submitted: state.submitted,
        ready: {},
        resolveResults: state.resolveResults,
        reinforceResults: state.reinforceResults,
        seed: state.seed,
        actionCount: state.actionCount + 1,
      };
    }

    // === PLAYER GUARD ===
    if (state.players.indexOf(playerId) === -1) return state;

    // === PLAYER ACTIONS ===

    if (action.type === "autoCompleteOrders" && state.phase === "orders") {
      if (state.submitted[playerId]) return state;
      var acArmies = playerArmies(state.armies, playerId);
      if (acArmies.length === 0) return state;
      var acPending = deepCopyOrders(state.pendingOrders);
      if (!acPending[playerId]) acPending[playerId] = {};
      for (i = 0; i < acArmies.length; i++) {
        if (!acPending[playerId][acArmies[i]]) {
          acPending[playerId][acArmies[i]] = { order: "hold" };
        }
      }
      var acSubmitted = copyObj(state.submitted);
      acSubmitted[playerId] = true;

      // Check if all players with armies are submitted
      var acAllDone = true;
      for (i = 0; i < state.players.length; i++) {
        pid = state.players[i];
        if (playerArmies(state.armies, pid).length > 0 && !acSubmitted[pid]) {
          acAllDone = false;
          break;
        }
      }

      if (acAllDone) {
        var acResolve = resolveAllOrders({
          armies: state.armies,
          supplyCenters: state.supplyCenters,
          pendingOrders: acPending,
          players: state.players,
        });
        return {
          phase: "resolve",
          round: state.round,
          maxRounds: state.maxRounds,
          players: state.players,
          playerNames: state.playerNames,
          factionMap: state.factionMap,
          armies: acResolve.newArmies,
          supplyCenters: acResolve.newSCs,
          preResolveArmies: state.armies,
          preResolveSCs: state.supplyCenters,
          pendingOrders: acPending,
          submitted: acSubmitted,
          ready: {},
          resolveResults: acResolve,
          reinforceResults: null,
          seed: state.seed,
          actionCount: state.actionCount + 1,
        };
      }

      return {
        phase: state.phase,
        round: state.round,
        maxRounds: state.maxRounds,
        players: state.players,
        playerNames: state.playerNames,
        factionMap: state.factionMap,
        armies: state.armies,
        supplyCenters: state.supplyCenters,
        pendingOrders: acPending,
        submitted: acSubmitted,
        ready: state.ready,
        resolveResults: state.resolveResults,
        reinforceResults: state.reinforceResults,
        seed: state.seed,
        actionCount: state.actionCount + 1,
      };
    }

    if (action.type === "order" && state.phase === "orders") {
      if (state.submitted[playerId]) return state;
      var territory = action.territory;
      if (!territory || state.armies[territory] !== playerId) return state;

      // Validate order
      var orderType = action.order;
      if (
        orderType !== "hold" &&
        orderType !== "move" &&
        orderType !== "support"
      )
        return state;
      if (
        orderType === "move" &&
        (!action.to || MAP[territory].adj.indexOf(action.to) === -1)
      )
        return state;
      if (
        orderType === "support" &&
        (!action.supportTo ||
          MAP[territory].adj.indexOf(action.supportTo) === -1)
      )
        return state;

      // Record order
      var updPending = deepCopyOrders(state.pendingOrders);
      if (!updPending[playerId]) updPending[playerId] = {};
      updPending[playerId][territory] = {
        order: orderType,
        to: action.to || null,
        supportFrom: action.supportFrom || null,
        supportTo: action.supportTo || null,
      };

      // Check if all armies ordered
      var pArmies2 = playerArmies(state.armies, playerId);
      var orderedCount = Object.keys(updPending[playerId]).length;
      var updSubmitted = copyObj(state.submitted);

      if (orderedCount >= pArmies2.length) {
        updSubmitted[playerId] = true;
      }

      // Check if all players with armies are submitted
      var allDone = true;
      for (i = 0; i < state.players.length; i++) {
        pid = state.players[i];
        if (playerArmies(state.armies, pid).length > 0 && !updSubmitted[pid]) {
          allDone = false;
          break;
        }
      }

      if (allDone) {
        var rr = resolveAllOrders({
          armies: state.armies,
          supplyCenters: state.supplyCenters,
          pendingOrders: updPending,
          players: state.players,
        });

        return {
          phase: "resolve",
          round: state.round,
          maxRounds: state.maxRounds,
          players: state.players,
          playerNames: state.playerNames,
          factionMap: state.factionMap,
          armies: rr.newArmies,
          supplyCenters: rr.newSCs,
          preResolveArmies: state.armies,
          preResolveSCs: state.supplyCenters,
          pendingOrders: updPending,
          submitted: updSubmitted,
          ready: {},
          resolveResults: rr,
          reinforceResults: null,
          seed: state.seed,
          actionCount: state.actionCount + 1,
        };
      }

      return {
        phase: state.phase,
        round: state.round,
        maxRounds: state.maxRounds,
        players: state.players,
        playerNames: state.playerNames,
        factionMap: state.factionMap,
        armies: state.armies,
        supplyCenters: state.supplyCenters,
        pendingOrders: updPending,
        submitted: updSubmitted,
        ready: state.ready,
        resolveResults: state.resolveResults,
        reinforceResults: state.reinforceResults,
        seed: state.seed,
        actionCount: state.actionCount + 1,
      };
    }

    return state;
  },

  internalTurnProjection: function (state, playerId) {
    var isPlayer = playerId !== null && state.players.indexOf(playerId) !== -1;
    var isSpectator = playerId === null || !isPlayer;
    var i, pid;

    // --- View ---
    var view = {
      phase: state.phase,
      round: state.round,
      maxRounds: state.maxRounds,
      armies: state.armies,
      supplyCenters: state.supplyCenters,
      playerNames: state.playerNames,
      factionMap: state.factionMap,
    };

    if (isSpectator) {
      view.submitted = state.submitted;
      if (
        state.phase === "resolve" ||
        state.phase === "reinforce" ||
        state.phase === "gameOverDisplay" ||
        state.phase === "gameOver"
      ) {
        view.resolveResults = state.resolveResults;
      }
      if (state.phase === "resolve") {
        view.preResolveArmies = state.preResolveArmies;
        view.preResolveSCs = state.preResolveSCs;
      }
      if (
        state.phase === "reinforce" ||
        state.phase === "gameOverDisplay" ||
        state.phase === "gameOver"
      ) {
        view.reinforceSummary = state.reinforceResults
          ? "Reinforcement changes resolved."
          : null;
      }
      if (state.phase === "reinforce") {
        view.preReinforceArmies = state.preReinforceArmies;
      }
      view.playerCount = state.players.length;
    } else {
      view.players = state.players;
      view.ready = state.ready;
      view.submitted = state.submitted;

      if (state.phase === "orders") {
        view.myOrders = state.pendingOrders[playerId]
          ? copyObj(state.pendingOrders[playerId])
          : {};
        var myArmies = playerArmies(state.armies, playerId);
        var ordered = state.pendingOrders[playerId] || {};
        var unordered = myArmies.filter(function (a) {
          return !ordered[a];
        });
        view.currentArmy = unordered.length > 0 ? unordered[0] : null;
        view.remainingArmies = unordered.length;
      }

      if (
        state.phase === "resolve" ||
        state.phase === "gameOverDisplay" ||
        state.phase === "gameOver"
      ) {
        view.resolveResults = state.resolveResults;
      }
      if (state.phase === "resolve") {
        view.preResolveArmies = state.preResolveArmies;
        view.preResolveSCs = state.preResolveSCs;
      }

      if (
        state.phase === "reinforce" ||
        state.phase === "gameOverDisplay" ||
        state.phase === "gameOver"
      ) {
        view.reinforceSummary = state.reinforceResults
          ? "Reinforcement changes resolved."
          : null;
      }
      if (state.phase === "reinforce") {
        view.preReinforceArmies = state.preReinforceArmies;
      }
    }

    // --- Actions ---
    var actions = [];
    if (isPlayer && state.phase === "orders") {
      var acArmies = playerArmies(state.armies, playerId);
      if (acArmies.length > 0 && !state.submitted[playerId]) {
        var acOrdered = state.pendingOrders[playerId] || {};
        var acUnordered = acArmies.filter(function (a) {
          return !acOrdered[a];
        });
        if (acUnordered.length > 0) {
          var t = acUnordered[0];
          var adj = MAP[t].adj;
          var j, k, dest, source, destAdj;

          // Hold
          actions.push({ type: "order", territory: t, order: "hold" });

          // Move
          for (i = 0; i < adj.length; i++) {
            actions.push({
              type: "order",
              territory: t,
              order: "move",
              to: adj[i],
            });
          }

          // Support: for each adjacent territory (potential support destination)
          for (i = 0; i < adj.length; i++) {
            dest = adj[i];

            // Support hold in dest (if army present)
            if (state.armies[dest]) {
              actions.push({
                type: "order",
                territory: t,
                order: "support",
                supportFrom: dest,
                supportTo: dest,
              });
            }

            // Support moves into dest from dest's other adjacents
            destAdj = MAP[dest].adj;
            for (j = 0; j < destAdj.length; j++) {
              source = destAdj[j];
              if (source === t) continue;
              if (state.armies[source]) {
                var dup = false;
                for (k = 0; k < actions.length; k++) {
                  if (
                    actions[k].order === "support" &&
                    actions[k].supportFrom === source &&
                    actions[k].supportTo === dest
                  ) {
                    dup = true;
                    break;
                  }
                }
                if (!dup) {
                  actions.push({
                    type: "order",
                    territory: t,
                    order: "support",
                    supportFrom: source,
                    supportTo: dest,
                  });
                }
              }
            }
          }

          actions.push({ type: "autoCompleteOrders" });
        }
      }
    }

    // --- Result ---
    var result = null;
    if (state.phase === "gameOver") {
      var bestCount = 0;
      var bestPlayers = [];
      for (i = 0; i < state.players.length; i++) {
        pid = state.players[i];
        var count = playerSCCount(state.supplyCenters, pid);
        if (count > bestCount) {
          bestCount = count;
          bestPlayers = [pid];
        } else if (count === bestCount) {
          bestPlayers.push(pid);
        }
      }

      if (bestPlayers.length > 1) {
        var bestArmyCount = 0;
        var tiedByArmies = [];
        for (var j2 = 0; j2 < bestPlayers.length; j2++) {
          var ac = playerArmies(state.armies, bestPlayers[j2]).length;
          if (ac > bestArmyCount) {
            bestArmyCount = ac;
            tiedByArmies = [bestPlayers[j2]];
          } else if (ac === bestArmyCount) {
            tiedByArmies.push(bestPlayers[j2]);
          }
        }
        bestPlayers = tiedByArmies;
      }

      var summary =
        bestPlayers.length === 1
          ? playerDisplayName(state, bestPlayers[0]) +
            " wins with " +
            bestCount +
            " supply centers!"
          : "Tie at " + bestCount + " supply centers!";

      result = { winners: bestPlayers, summary: summary };
    }

    // --- Turn config ---
    var timeoutMs = null;
    var defaultAction = null;
    var currentPlayerId = null;
    var chatChannel = null;

    if (state.phase === "negotiate") {
      if (playerId === null) {
        timeoutMs = 90000;
        defaultAction = { type: "endNegotiation" };
      } else {
        timeoutMs = 90000;
      }
    } else if (state.phase === "orders") {
      if (playerId === null) {
        timeoutMs = 60000;
        defaultAction = { type: "autoSubmit" };
      } else if (isPlayer && !state.submitted[playerId]) {
        var tcArmies = playerArmies(state.armies, playerId);
        if (tcArmies.length > 0) {
          var tcOrdered = state.pendingOrders[playerId] || {};
          var tcUnordered = tcArmies.filter(function (a) {
            return !tcOrdered[a];
          });
          if (tcUnordered.length > 0) {
            timeoutMs = 20000 * tcUnordered.length;
            defaultAction = { type: "autoCompleteOrders" };
          }
        }
      }
    } else if (state.phase === "resolve") {
      if (playerId === null) {
        timeoutMs = 8000;
        defaultAction = { type: "advanceFromResolve" };
      } else {
        timeoutMs = 8000;
      }
    } else if (state.phase === "reinforce") {
      if (playerId === null) {
        timeoutMs = 5000;
        defaultAction = { type: "advanceFromReinforce" };
      } else {
        timeoutMs = 5000;
      }
    } else if (state.phase === "gameOverDisplay") {
      if (playerId === null) {
        timeoutMs = 5000;
        defaultAction = { type: "finalize" };
      } else {
        timeoutMs = 5000;
      }
    }

    // --- Agent View ---
    var agentView = null;
    var lines = [];
    var r, c, tbT, tbCell, tbOwner, tbSc;

    lines.push(
      "Round " +
        state.round +
        "/" +
        state.maxRounds +
        " | Phase: " +
        state.phase,
    );

    var scLine = "Supply Centers:";
    for (i = 0; i < state.players.length; i++) {
      pid = state.players[i];
      scLine +=
        " " +
        playerDisplayName(state, pid) +
        "=" +
        playerSCCount(state.supplyCenters, pid);
    }
    scLine += " (need 5)";
    lines.push(scLine);
    lines.push("");

    for (r = 0; r < 6; r++) {
      var row = "";
      for (c = 0; c < 3; c++) {
        tbT = GRID[r][c];
        tbCell = displayName(tbT);
        tbOwner = state.armies[tbT];
        tbSc = MAP[tbT].sc;

        var tag = "";
        if (tbOwner) {
          var pi = state.players.indexOf(tbOwner);
          tag = "P" + (pi + 1);
        }
        if (tbSc) tag += "*";
        if (tag) tbCell += "[" + tag + "]";

        while (tbCell.length < 18) tbCell += " ";

        if (c < 2) tbCell += "--- ";
        row += tbCell;
      }
      lines.push(row);

      if (r < 5) {
        var connector = "";
        for (c = 0; c < 3; c++) {
          connector += "     |";
          if (c < 2) connector += "                ";
        }
        lines.push(connector);
      }
    }

    lines.push("");
    lines.push("[PX]=army  *=supply center");

    if (playerId && state.players.indexOf(playerId) !== -1) {
      var myA = playerArmies(state.armies, playerId);
      lines.push("Your armies: " + myA.map(displayName).join(", "));
      if (state.phase === "orders") {
        var mineOrdered = state.pendingOrders[playerId] || {};
        var mineUnordered = myA.filter(function (a) {
          return !mineOrdered[a];
        });
        lines.push(
          "Your pending orders: " +
            (Object.keys(mineOrdered).length
              ? JSON.stringify(mineOrdered)
              : "none"),
        );
        lines.push(
          "Your next unordered army: " +
            (mineUnordered.length ? displayName(mineUnordered[0]) : "none"),
        );
      }
    } else if (playerId === null && state.phase === "orders") {
      lines.push(
        "Submitted: " +
          state.players
            .map(function (p) {
              return p + "=" + !!state.submitted[p];
            })
            .join(" "),
      );
    }

    agentView = lines.join("\n");

    var actionOptions = actions.map(orderActionOption);

    return {
      view: view,
      actions: actionOptions,
      result: result,
      timeoutMs: timeoutMs,
      defaultAction: defaultAction,
      currentPlayerId: currentPlayerId,
      chatChannel: chatChannel,
      agentView: agentView,
      agent: this.agentIntent(state),
    };
  },

  agentIntent: function (state) {
    return undefined;
  },
  internalDecisionOf: function (option) {
    if (option && typeof option === "object" && option.decision !== undefined)
      return option.decision;
    if (option && typeof option === "object" && option.action !== undefined)
      return option.action;
    return option;
  },

  internalNormalizeOption: function (option) {
    if (option && typeof option === "object" && option.action !== undefined) {
      var wrapped = { decision: option.action };
      if (option.label !== undefined) wrapped.label = option.label;
      if (option.schema !== undefined) wrapped.schema = option.schema;
      if (option.required !== undefined) wrapped.required = option.required;
      if (option.tone !== undefined) wrapped.tone = option.tone;
      return wrapped;
    }
    if (option && typeof option === "object" && option.decision !== undefined)
      return option;
    return {
      decision: option,
      label:
        option && option.type ? "Choose " + option.type : "Choose this action",
    };
  },

  internalSameDecision: function (a, b) {
    return (
      JSON.stringify(this.internalDecisionOf(a)) ===
      JSON.stringify(this.internalDecisionOf(b))
    );
  },

  internalOutcomeFromResult: function (result) {
    var winners;
    if (!result) return null;
    if (
      result.type === "winners" ||
      result.type === "draw" ||
      result.type === "void"
    )
      return result;
    winners = result.playerIds || result.winners || [];
    return {
      type: winners.length > 0 ? "winners" : "draw",
      playerIds: winners,
      summary: result.summary,
    };
  },

  internalChatChannelsFor: function (state, actorId, projection) {
    if (
      actorId === "__system__" ||
      !state.players ||
      state.players.indexOf(actorId) === -1
    )
      return [];
    if (projection && projection.result) return [];
    if (
      state.eliminated &&
      state.eliminated.indexOf &&
      state.eliminated.indexOf(actorId) !== -1
    )
      return ["eliminated"];
    return ["room", "whisper", "spectator"];
  },

  internalChatOpportunity: function (channel) {
    return {
      id: "chat:" + channel,
      kind: "chat",
      prompt:
        channel === "eliminated"
          ? "Chat with eliminated players."
          : "Chat in " + channel + ".",
      decision: { type: "none" },
      chat: {
        channels: [channel],
        defaultChannel: channel,
        canSend: true,
        memberships: channel === "eliminated" ? ["eliminated"] : [],
      },
      submitPolicy: "multiple",
    };
  },

  internalChatOpportunities: function (channels) {
    var out = [];
    var i;
    for (i = 0; i < channels.length; i++)
      out.push(this.internalChatOpportunity(channels[i]));
    return out;
  },

  internalWaitOpportunity: function (state, actorId, projection) {
    var playerId = actorId === "__system__" ? null : actorId;
    var prompt = null;
    var waiting = 0;
    var armies;
    var i;
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.phase === "negotiate") {
      prompt = "Negotiation timer is running before orders open.";
    } else if (state.phase === "orders") {
      for (i = 0; i < state.players.length; i++) {
        armies = playerArmies(state.armies, state.players[i]);
        if (armies.length > 0 && !state.submitted[state.players[i]]) waiting++;
      }
      prompt =
        waiting > 0
          ? "Waiting for " +
            waiting +
            " player" +
            (waiting === 1 ? "" : "s") +
            " to submit orders."
          : "Waiting for submitted orders to resolve.";
    } else if (state.phase === "resolve") {
      prompt = "Orders resolved - next phase starts automatically.";
    } else if (state.phase === "reinforce") {
      prompt = "Reinforcements resolved - next round starts automatically.";
    } else if (state.phase === "gameOverDisplay") {
      prompt = "Game over display - final results post automatically.";
    }
    if (!prompt) return null;
    return {
      kind: "wait",
      id: "wait",
      prompt: prompt,
      decision: { type: "none" },
    };
  },

  internalOpportunitiesFromTurn: function (state, actorId) {
    var playerId = actorId === "__system__" ? null : actorId;
    /** @type {Object} */
    var projection = this.internalTurnProjection(state, playerId) || {
      view: {},
    };
    var actions = (projection.actions || []).map(
      this.internalNormalizeOption.bind(this),
    );
    var defaultAction = this.internalDecisionOf(
      projection.defaultAction || null,
    );
    /** @type {Object} */
    var opportunity;
    /** @type {Object} */
    var deadline;
    var waitOpportunity;
    var chatChannels = projection.chatChannel
      ? [projection.chatChannel]
      : this.internalChatChannelsFor(state, actorId, projection);

    if (actorId === "__system__") {
      if (!defaultAction) return [];
      actions = [this.internalNormalizeOption(defaultAction)];
    }

    if (actions.length === 0 && defaultAction)
      actions = [this.internalNormalizeOption(defaultAction)];
    if (actions.length === 0) {
      waitOpportunity = this.internalWaitOpportunity(
        state,
        actorId,
        projection,
      );
      return (waitOpportunity ? [waitOpportunity] : []).concat(
        this.internalChatOpportunities(chatChannels),
      );
    }
    if (
      defaultAction &&
      !actions.some(function (option) {
        return this.internalSameDecision(option, defaultAction);
      }, this)
    ) {
      actions.push(this.internalNormalizeOption(defaultAction));
    }

    /** @type {Object} */

    opportunity = {
      id: actorId === "__system__" ? "system" : "turn",
      kind: actorId === "__system__" ? "system" : "turn",
      prompt: "Choose a legal game action.",
      decision: { type: "choose", options: actions },
    };
    if (
      (projection.timeoutMs !== null && projection.timeoutMs !== undefined) ||
      defaultAction
    ) {
      deadline = {
        id: opportunity.id + ":" + (state.phase || "turn") + ":" + actorId,
      };
      if (projection.timeoutMs !== null && projection.timeoutMs !== undefined)
        deadline.timeoutMs = projection.timeoutMs;
      else if (defaultAction) deadline.timeoutMs = 0;
      if (defaultAction) deadline.onExpire = defaultAction;
      opportunity.deadline = deadline;
    }
    if (chatChannels.length > 0)
      opportunity.chat = {
        channels: chatChannels,
        defaultChannel: chatChannels[0] || null,
        canSend: true,
        memberships: chatChannels[0] === "eliminated" ? ["eliminated"] : [],
      };
    return /** @type {Object[]} */ ([opportunity]).concat(
      this.internalChatOpportunities(chatChannels.slice(1)),
    );
  },
  project: function (state, playerId) {
    /** @type {Object} */
    var projection = this.internalTurnProjection(state, playerId) || {
      view: {},
    };
    /** @type {Object} */
    var out = { view: projection.view || {} };
    if (projection.agentView !== undefined)
      out.agentView = projection.agentView;
    if (projection.agent !== undefined) out.agent = projection.agent;
    return out;
  },

  opportunities: function (state, actorId) {
    return this.internalOpportunitiesFromTurn(state, actorId);
  },

  outcome: function (state) {
    /** @type {Object} */
    var projection = this.internalTurnProjection(state, null) || { view: {} };
    return this.internalOutcomeFromResult(projection.result);
  },

  validate: function () {
    return { ok: true };
  },
};
export default GameLogic;
