function viewFleetSummary(fleet) {
  var parts = [];
  for (var i = 0; i < fleet.length; i++) {
    parts.push(
      fleet[i].name +
        " " +
        fleet[i].hits +
        "/" +
        fleet[i].size +
        (fleet[i].sunk ? " sunk" : ""),
    );
  }
  return parts.join("; ");
}

var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  actionSchemas: {
    ready: {
      fields: {
        ships: {
          kind: "string",
          freeText: true,
          minLength: 1,
          maxLength: 5000,
        },
      },
    },
  },

  internalFleet: [
    { name: "Carrier", size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Cruiser", size: 3 },
    { name: "Submarine", size: 3 },
    { name: "Destroyer", size: 2 },
  ],

  internalCellKey: function (row, col) {
    return row + "," + col;
  },

  internalCloneShots: function (shots, players) {
    var out = {};
    for (var i = 0; i < players.length; i++) {
      var pid = players[i];
      out[pid] = (shots[pid] || []).slice();
    }
    return out;
  },

  internalHashString: function (value) {
    var text = String(value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  },

  internalAutoFleet: function (size, playerId, seed) {
    var ships = [];
    var occupied = {};
    for (var s = 0; s < this.internalFleet.length; s++) {
      var spec = this.internalFleet[s];
      var candidates = [];
      for (var row = 0; row < size; row++) {
        for (var col = 0; col < size; col++) {
          if (col + spec.size <= size) {
            candidates.push({
              row: row,
              col: col,
              horizontal: true,
              score: this.internalHashString(
                seed +
                  "|" +
                  playerId +
                  "|" +
                  spec.name +
                  "|h|" +
                  row +
                  "|" +
                  col,
              ),
            });
          }
          if (row + spec.size <= size) {
            candidates.push({
              row: row,
              col: col,
              horizontal: false,
              score: this.internalHashString(
                seed +
                  "|" +
                  playerId +
                  "|" +
                  spec.name +
                  "|v|" +
                  row +
                  "|" +
                  col,
              ),
            });
          }
        }
      }
      candidates.sort(function (a, b) {
        return a.score === b.score
          ? a.row === b.row
            ? a.col - b.col
            : a.row - b.row
          : a.score - b.score;
      });
      var placed = false;
      for (var attempt = 0; attempt < candidates.length && !placed; attempt++) {
        var candidate = candidates[attempt];
        var cells = [];
        var blocked = false;
        for (var k = 0; k < spec.size; k++) {
          var r = candidate.row + (candidate.horizontal ? 0 : k);
          var c = candidate.col + (candidate.horizontal ? k : 0);
          var key = this.internalCellKey(r, c);
          if (occupied[key]) blocked = true;
          cells.push({ row: r, col: c });
        }
        if (!blocked) {
          for (var ci = 0; ci < cells.length; ci++) {
            occupied[this.internalCellKey(cells[ci].row, cells[ci].col)] = true;
          }
          ships.push({
            id: spec.name.toLowerCase(),
            name: spec.name,
            size: spec.size,
            cells: cells,
          });
          placed = true;
        }
      }
      if (!placed) return this.internalDefaultFleet(size);
    }
    return ships;
  },

  internalParseFleetInput: function (input) {
    if (typeof input === "string") {
      try {
        return JSON.parse(input);
      } catch (err) {
        return null;
      }
    }
    return input;
  },

  internalDefaultFleet: function (size) {
    var starts = [
      { row: 0, col: 0, horizontal: true },
      { row: 2, col: 0, horizontal: true },
      { row: 4, col: 0, horizontal: true },
      { row: 6, col: 0, horizontal: true },
      { row: 8, col: 0, horizontal: true },
    ];
    var ships = [];
    for (var s = 0; s < this.internalFleet.length; s++) {
      var spec = this.internalFleet[s];
      var start = starts[s];
      var cells = [];
      for (var k = 0; k < spec.size; k++) {
        cells.push({
          row: start.row + (start.horizontal ? 0 : k),
          col: start.col + (start.horizontal ? k : 0),
        });
      }
      ships.push({
        id: spec.name.toLowerCase(),
        name: spec.name,
        size: spec.size,
        cells: cells,
      });
    }
    return this.internalValidateFleet(ships, size);
  },

  internalValidateFleet: function (input, size) {
    if (!input || !Array.isArray(input)) return null;
    var occupied = {};
    var out = [];
    for (var s = 0; s < this.internalFleet.length; s++) {
      var spec = this.internalFleet[s];
      var expectedId = spec.name.toLowerCase();
      var raw = null;
      for (var i = 0; i < input.length; i++) {
        if (input[i] && input[i].id === expectedId) raw = input[i];
      }
      if (!raw && input[s]) raw = input[s];
      if (!raw || !Array.isArray(raw.cells) || raw.cells.length !== spec.size)
        return null;
      var cells = [];
      var rows = {};
      var cols = {};
      for (var c = 0; c < raw.cells.length; c++) {
        var row = Number(raw.cells[c].row);
        var col = Number(raw.cells[c].col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (row < 0 || row >= size || col < 0 || col >= size) return null;
        var key = this.internalCellKey(row, col);
        if (occupied[key]) return null;
        rows[row] = true;
        cols[col] = true;
        cells.push({ row: row, col: col });
      }
      var rowKeys = Object.keys(rows);
      var colKeys = Object.keys(cols);
      if (rowKeys.length !== 1 && colKeys.length !== 1) return null;
      cells.sort(function (a, b) {
        return a.row === b.row ? a.col - b.col : a.row - b.row;
      });
      for (var j = 1; j < cells.length; j++) {
        var prev = cells[j - 1];
        var cur = cells[j];
        var consecutive =
          rowKeys.length === 1
            ? cur.row === prev.row && cur.col === prev.col + 1
            : cur.col === prev.col && cur.row === prev.row + 1;
        if (!consecutive) return null;
      }
      for (var ci = 0; ci < cells.length; ci++) {
        occupied[this.internalCellKey(cells[ci].row, cells[ci].col)] = true;
      }
      out.push({
        id: expectedId,
        name: spec.name,
        size: spec.size,
        cells: cells,
      });
    }
    return out;
  },

  internalShipAt: function (ships, row, col) {
    if (!ships) return null;
    for (var i = 0; i < ships.length; i++) {
      var ship = ships[i];
      for (var j = 0; j < ship.cells.length; j++) {
        var cell = ship.cells[j];
        if (cell.row === row && cell.col === col) return ship;
      }
    }
    return null;
  },

  internalShotsHitShip: function (shots, ship) {
    var hits = {};
    for (var i = 0; i < shots.length; i++) {
      var shot = shots[i];
      if (shot.hit && shot.shipId === ship.id) {
        hits[this.internalCellKey(shot.row, shot.col)] = true;
      }
    }
    var count = 0;
    for (var c = 0; c < ship.cells.length; c++) {
      if (hits[this.internalCellKey(ship.cells[c].row, ship.cells[c].col)])
        count++;
    }
    return count;
  },

  internalAllShipsSunk: function (ships, shots) {
    for (var i = 0; i < ships.length; i++) {
      if (this.internalShotsHitShip(shots, ships[i]) < ships[i].size)
        return false;
    }
    return true;
  },

  internalAlreadyShot: function (shots, row, col) {
    for (var i = 0; i < shots.length; i++) {
      if (shots[i].row === row && shots[i].col === col) return true;
    }
    return false;
  },

  internalLegalActions: function (state, playerId) {
    if (state.phase === "placement") {
      var isPlayer =
        playerId === state.players[0] || playerId === state.players[1];
      if (!isPlayer || state.placed[playerId]) {
        return [];
      }
      return [
        { type: "auto_place" },
        {
          type: "ready",
          ships: JSON.stringify(
            this.internalAutoFleet(state.boardSize, playerId, state.seed),
          ),
        },
      ];
    }
    if (state.winner || state.players[state.currentTurnIndex] !== playerId) {
      return [];
    }
    var actions = [];
    var fired = state.shots[playerId] || [];
    for (var r = 0; r < state.boardSize; r++) {
      for (var c = 0; c < state.boardSize; c++) {
        if (!this.internalAlreadyShot(fired, r, c)) {
          actions.push({ type: "fire", row: r, col: c });
        }
      }
    }
    return actions;
  },

  internalActionOption: function (action) {
    if (!action?.type) return action;
    if (action.type === "ready")
      return { action: action, label: "ready(auto fleet)" };
    if (action.type === "fire")
      return {
        action: action,
        label: "fire(" + action.row + "," + action.col + ")",
      };
    return action;
  },

  internalFleetView: function (ships, shots, revealNames) {
    var out = [];
    var source = ships?.length ? ships : this.internalFleet;
    for (var i = 0; i < source.length; i++) {
      var ship = source[i];
      var hits = ship.cells ? this.internalShotsHitShip(shots, ship) : 0;
      out.push({
        name: revealNames || hits === ship.size ? ship.name : "Unknown Ship",
        size: ship.size,
        hits: hits,
        sunk: hits === ship.size,
      });
    }
    return out;
  },

  internalOwnBoard: function (state, playerId) {
    var enemy =
      state.players[0] === playerId ? state.players[1] : state.players[0];
    var incoming = state.shots[enemy] || [];
    var board = [];
    for (var r = 0; r < state.boardSize; r++) {
      for (var c = 0; c < state.boardSize; c++) {
        var ship = this.internalShipAt(state.ships[playerId], r, c);
        var shot = null;
        for (var i = 0; i < incoming.length; i++) {
          if (incoming[i].row === r && incoming[i].col === c)
            shot = incoming[i];
        }
        var status = ship ? "ship" : "empty";
        if (shot?.hit) {
          status =
            ship && this.internalShotsHitShip(incoming, ship) === ship.size
              ? "sunk"
              : "hit";
        } else if (shot) {
          status = "miss";
        }
        board.push({
          row: r,
          col: c,
          status: status,
          ship: ship ? ship.name : null,
        });
      }
    }
    return board;
  },

  internalEnemyBoard: function (state, playerId) {
    var opponent =
      state.players[0] === playerId ? state.players[1] : state.players[0];
    var fired = state.shots[playerId] || [];
    var board = [];
    for (var r = 0; r < state.boardSize; r++) {
      for (var c = 0; c < state.boardSize; c++) {
        var shot = null;
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].row === r && fired[i].col === c) shot = fired[i];
        }
        var status = "unknown";
        if (shot?.hit) {
          var ship = this.internalShipAt(state.ships[opponent], r, c);
          status =
            ship && this.internalShotsHitShip(fired, ship) === ship.size
              ? "sunk"
              : "hit";
        } else if (shot) {
          status = "miss";
        }
        board.push({ row: r, col: c, status: status });
      }
    }
    return board;
  },

  internalPublicBoard: function (state, targetPlayer, shooter) {
    var fired = state.shots[shooter] || [];
    var board = [];
    for (var r = 0; r < state.boardSize; r++) {
      for (var c = 0; c < state.boardSize; c++) {
        var shot = null;
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].row === r && fired[i].col === c) shot = fired[i];
        }
        var status = "unknown";
        if (shot?.hit) {
          var ship = this.internalShipAt(state.ships[targetPlayer], r, c);
          status =
            ship && this.internalShotsHitShip(fired, ship) === ship.size
              ? "sunk"
              : "hit";
        } else if (shot) {
          status = "miss";
        }
        board.push({ row: r, col: c, status: status });
      }
    }
    return board;
  },

  internalBoardText: function (cells, size, own) {
    var header = " ";
    for (var h = 0; h < size; h++) header += " " + h;
    var rows = [header];
    for (var r = 0; r < size; r++) {
      var line = String(r);
      for (var c = 0; c < size; c++) {
        var cell = cells[r * size + c];
        var ch = ".";
        if (cell.status === "unknown") ch = "?";
        if (cell.status === "ship") ch = own ? "S" : "?";
        if (cell.status === "hit") ch = "X";
        if (cell.status === "sunk") ch = "#";
        if (cell.status === "miss") ch = "o";
        line += " " + ch;
      }
      rows.push(line);
    }
    return rows.join("\n");
  },

  setup: function (ctx) {
    var players = ctx.players.map(function (p) {
      return p.id;
    });
    var size = 10;
    var ships = {};
    var shots = {};
    var placed = {};
    for (var i = 0; i < players.length; i++) {
      ships[players[i]] = [];
      shots[players[i]] = [];
      placed[players[i]] = false;
    }
    return {
      boardSize: size,
      players: players,
      seed: ctx.seed || 873645,
      phase: "placement",
      currentTurnIndex: 0,
      ships: ships,
      placed: placed,
      shots: shots,
      turnNumber: 1,
      winner: null,
      lastShot: null,
      placementLog: [],
      shotLog: [],
    };
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    if (state.phase === "placement") {
      if (state.winner) return state;
      var isPlacementPlayer =
        playerId === state.players[0] || playerId === state.players[1];
      if (!isPlacementPlayer || state.placed[playerId]) return state;
      var fleet = null;
      if (action.type === "auto_place") {
        fleet = this.internalAutoFleet(state.boardSize, playerId, state.seed);
      } else if (action.type === "ready" || action.type === "place_fleet") {
        fleet = this.internalValidateFleet(
          this.internalParseFleetInput(action.ships),
          state.boardSize,
        );
      }
      if (!fleet) return state;
      var nextShipsByPlayer = {};
      var nextPlaced = {};
      for (var pi = 0; pi < state.players.length; pi++) {
        var pid = state.players[pi];
        nextShipsByPlayer[pid] =
          pid === playerId ? fleet : state.ships[pid] || [];
        nextPlaced[pid] = pid === playerId ? true : !!state.placed[pid];
      }
      var allPlaced = true;
      var nextTurn = 0;
      for (var p = 0; p < state.players.length; p++) {
        if (!nextPlaced[state.players[p]]) {
          allPlaced = false;
          nextTurn = p;
          break;
        }
      }
      return {
        boardSize: state.boardSize,
        players: state.players.slice(),
        seed: state.seed,
        phase: allPlaced ? "battle" : "placement",
        currentTurnIndex: allPlaced ? 0 : nextTurn,
        ships: nextShipsByPlayer,
        placed: nextPlaced,
        shots: this.internalCloneShots(state.shots, state.players),
        turnNumber: allPlaced ? 1 : state.turnNumber,
        winner: null,
        lastShot: null,
        placementLog: (state.placementLog || [])
          .concat([{ playerId: playerId }])
          .slice(-4),
        shotLog: state.shotLog || [],
      };
    }
    if (action.type !== "fire" || state.winner) return state;
    var attacker = state.players[state.currentTurnIndex];
    if (playerId !== attacker) return state;
    var row = action.row;
    var col = action.col;
    if (
      row < 0 ||
      row >= state.boardSize ||
      col < 0 ||
      col >= state.boardSize
    ) {
      return state;
    }
    var fired = state.shots[attacker] || [];
    if (this.internalAlreadyShot(fired, row, col)) return state;

    var defender =
      state.players[0] === attacker ? state.players[1] : state.players[0];
    var targetShip = this.internalShipAt(state.ships[defender], row, col);
    var nextShots = this.internalCloneShots(state.shots, state.players);
    var probeShot = {
      row: row,
      col: col,
      hit: !!targetShip,
      shipId: targetShip ? targetShip.id : null,
      shipName: targetShip ? targetShip.name : null,
      sunk: false,
    };
    nextShots[attacker] = fired.concat([probeShot]);
    if (
      targetShip &&
      this.internalShotsHitShip(nextShots[attacker], targetShip) ===
        targetShip.size
    ) {
      probeShot = {
        row: row,
        col: col,
        hit: true,
        shipId: targetShip.id,
        shipName: targetShip.name,
        sunk: true,
      };
      nextShots[attacker] = fired.concat([probeShot]);
    }

    var winner = this.internalAllShipsSunk(
      state.ships[defender],
      nextShots[attacker],
    )
      ? attacker
      : null;
    return {
      boardSize: state.boardSize,
      players: state.players.slice(),
      seed: state.seed,
      phase: "battle",
      currentTurnIndex: winner
        ? state.currentTurnIndex
        : (state.currentTurnIndex + 1) % state.players.length,
      ships: state.ships,
      placed: state.placed,
      shots: nextShots,
      turnNumber: state.turnNumber + 1,
      winner: winner,
      lastShot: {
        attacker: attacker,
        defender: defender,
        row: row,
        col: col,
        hit: probeShot.hit,
        sunk: probeShot.sunk,
        shipName: probeShot.shipName,
      },
      shotLog: state.shotLog
        .concat([
          {
            attacker: attacker,
            defender: defender,
            row: row,
            col: col,
            hit: probeShot.hit,
            sunk: probeShot.sunk,
            shipName: probeShot.shipName,
          },
        ])
        .slice(-12),
    };
  },

  internalTurnProjection: function (state, playerId) {
    var phase = state.phase || "battle";
    var isPlayer =
      playerId === state.players[0] || playerId === state.players[1];
    var viewer = isPlayer ? playerId : state.players[0];
    var opponent =
      state.players[0] === viewer ? state.players[1] : state.players[0];
    var actions = this.internalLegalActions(state, playerId);
    var actionOptions = [];
    var ownBoard = isPlayer
      ? this.internalOwnBoard(state, viewer)
      : this.internalPublicBoard(state, state.players[0], state.players[1]);
    var enemyBoard = isPlayer
      ? this.internalEnemyBoard(state, viewer)
      : this.internalPublicBoard(state, state.players[1], state.players[0]);
    var result = state.winner
      ? {
          winners: [state.winner],
          summary: "FightShip victory! Enemy fleet destroyed.",
        }
      : null;
    var agentLines = [];
    agentLines.push(
      "Phase: " +
        phase +
        " | Turn: " +
        (state.winner
          ? "game over"
          : phase === "placement"
            ? "placement"
            : state.players[state.currentTurnIndex]),
    );
    agentLines.push(
      "Last shot: " +
        (state.lastShot ? JSON.stringify(state.lastShot) : "none"),
    );
    agentLines.push(isPlayer ? "ENEMY WATERS" : "PLAYER 2 WATERS");
    agentLines.push(this.internalBoardText(enemyBoard, state.boardSize, false));
    agentLines.push("");
    agentLines.push(isPlayer ? "YOUR FLEET" : "PLAYER 1 WATERS");
    agentLines.push(
      this.internalBoardText(ownBoard, state.boardSize, isPlayer),
    );
    agentLines.push(
      "My fleet: " +
        viewFleetSummary(
          isPlayer
            ? this.internalFleetView(
                state.ships[viewer],
                state.shots[opponent] || [],
                true,
              )
            : this.internalFleetView(
                state.ships[state.players[0]],
                state.shots[state.players[1]] || [],
                false,
              ),
        ),
    );
    agentLines.push(
      "Enemy fleet: " +
        viewFleetSummary(
          isPlayer
            ? this.internalFleetView(
                state.ships[opponent],
                state.shots[viewer] || [],
                false,
              )
            : this.internalFleetView(
                state.ships[state.players[1]],
                state.shots[state.players[0]] || [],
                false,
              ),
        ),
    );
    for (var ai = 0; ai < actions.length; ai++)
      actionOptions.push(this.internalActionOption(actions[ai]));
    return {
      view: {
        phase: phase,
        boardSize: state.boardSize,
        you: isPlayer ? viewer : null,
        opponent: isPlayer ? opponent : null,
        isSpectator: !isPlayer,
        myPlaced: isPlayer ? !!state.placed[viewer] : false,
        placementRequired:
          phase === "placement" && isPlayer && !state.placed[viewer],
        autoFleet:
          phase === "placement" && isPlayer && !state.placed[viewer]
            ? this.internalAutoFleet(state.boardSize, viewer, state.seed)
            : [],
        fleetSpec: this.internalFleet,
        boardLabels: isPlayer
          ? {
              enemy: phase === "placement" ? "ENEMY WATERS" : "TARGET GRID",
              mine:
                phase === "placement" && !state.placed[viewer]
                  ? "PLACE FLEET"
                  : "YOUR FLEET",
              mineFleet: "YOU",
              enemyFleet: "ENEMY",
            }
          : {
              enemy: "PLAYER 2 WATERS",
              mine: "PLAYER 1 WATERS",
              mineFleet: "P1",
              enemyFleet: "P2",
            },
        currentPlayerId: state.winner
          ? null
          : phase === "placement"
            ? isPlayer && !state.placed[viewer]
              ? viewer
              : null
            : state.players[state.currentTurnIndex],
        turnNumber: state.turnNumber,
        myBoard: ownBoard,
        enemyBoard: enemyBoard,
        fleets: {
          mine: isPlayer
            ? this.internalFleetView(
                state.ships[viewer],
                state.shots[opponent] || [],
                true,
              )
            : this.internalFleetView(
                state.ships[state.players[0]],
                state.shots[state.players[1]] || [],
                false,
              ),
          enemy: isPlayer
            ? this.internalFleetView(
                state.ships[opponent],
                state.shots[viewer] || [],
                false,
              )
            : this.internalFleetView(
                state.ships[state.players[1]],
                state.shots[state.players[0]] || [],
                false,
              ),
        },
        lastShot: state.lastShot,
        winner: state.winner,
        shotLog: (state.shotLog || []).slice(-12),
      },
      actions: actionOptions,
      result: result,
      timeoutMs: 30000,
      defaultAction: actions.length > 0 ? actions[0] : null,
      currentPlayerId: state.winner
        ? null
        : phase === "placement"
          ? isPlayer && !state.placed[viewer]
            ? viewer
            : null
          : state.players[state.currentTurnIndex],
      agentView: agentLines.join("\n"),
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
    var currentPlayerId = null;
    var i;
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.phase === "placement") {
      for (i = 0; i < state.players.length; i++) {
        if (!state.placed[state.players[i]]) waiting++;
      }
      prompt =
        waiting > 0
          ? "Waiting for " +
            waiting +
            " player" +
            (waiting === 1 ? "" : "s") +
            " to place fleets."
          : "Waiting for fleet placement to resolve.";
    } else if (state.phase === "battle") {
      currentPlayerId = state.players[state.currentTurnIndex];
      prompt = "Waiting for " + currentPlayerId + " to fire.";
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
