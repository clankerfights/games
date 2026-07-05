var GameLogic = {
  rules: {
    visibility: "public",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  internalWIN_LINES: [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ],

  internalCheckWinner: function (board) {
    var i, line, a, b, c;
    for (i = 0; i < this.internalWIN_LINES.length; i++) {
      line = this.internalWIN_LINES[i];
      a = line[0];
      b = line[1];
      c = line[2];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { mark: board[a], cells: [a, b, c] };
      }
    }
    return null;
  },

  internalCellName: function (cell) {
    var cells = [
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "center",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ];
    return cells[cell] || "cell " + cell;
  },

  internalPlayerName: function (state, playerId) {
    return (state.playerNames && state.playerNames[playerId]) || playerId;
  },

  internalDecisionOf: function (option) {
    if (option && typeof option === "object" && option.decision !== undefined)
      return option.decision;
    return option;
  },

  internalPlaceOption: function (state, cell) {
    var playerId = state.players[state.currentTurn];
    var mark = state.currentTurn === 0 ? "X" : "O";
    return {
      decision: { type: "place", cell: cell },
      label:
        "Place " +
        mark +
        " for " +
        this.internalPlayerName(state, playerId) +
        " in the " +
        this.internalCellName(cell) +
        " square",
    };
  },

  internalLegalOptions: function (state) {
    var options = [];
    var i;
    if (state.winner || state.draw) return options;
    for (i = 0; i < state.board.length; i++) {
      if (state.board[i] === null)
        options.push(this.internalPlaceOption(state, i));
    }
    return options;
  },

  setup: function (ctx) {
    var players = [];
    var playerNames = {};
    var i;
    for (i = 0; i < ctx.players.length; i++) {
      players.push(ctx.players[i].id);
      playerNames[ctx.players[i].id] = ctx.players[i].name || ctx.players[i].id;
    }
    return {
      board: [null, null, null, null, null, null, null, null, null],
      players: players,
      playerNames: playerNames,
      currentTurn: 0,
      winner: null,
      winCells: null,
      draw: false,
    };
  },

  apply: function (state, playerId, action) {
    var mark, newBoard, result, winner, winCells, draw;
    action = this.internalDecisionOf(action);
    if (!action || action.type !== "place") return state;
    if (playerId !== state.players[state.currentTurn]) return state;
    if (action.cell < 0 || action.cell >= state.board.length) return state;
    if (state.board[action.cell] !== null) return state;
    if (state.winner || state.draw) return state;

    mark = state.currentTurn === 0 ? "X" : "O";
    newBoard = state.board.slice();
    newBoard[action.cell] = mark;

    result = this.internalCheckWinner(newBoard);
    winner = result ? result.mark : null;
    winCells = result ? result.cells : null;
    draw =
      !winner &&
      newBoard.every(function (c) {
        return c !== null;
      });

    return {
      board: newBoard,
      players: state.players,
      playerNames: state.playerNames,
      currentTurn: (state.currentTurn + 1) % 2,
      winner: winner,
      winCells: winCells,
      draw: draw,
    };
  },

  project: function (state) {
    var currentId = state.players[state.currentTurn];
    var winnerId = state.winner
      ? state.players[state.winner === "X" ? 0 : 1]
      : null;
    return {
      view: {
        board: state.board,
        turn: currentId,
        turnName: this.internalPlayerName(state, currentId),
        winner: winnerId,
        winnerName: winnerId ? this.internalPlayerName(state, winnerId) : null,
        draw: state.draw,
        marks: {
          [state.players[0]]: "X",
          [state.players[1]]: "O",
        },
        winCells: state.winCells,
      },
      agentView:
        "Turn: " +
        this.internalPlayerName(state, currentId) +
        " (" +
        currentId +
        ") | Winner: " +
        (winnerId ? this.internalPlayerName(state, winnerId) : "none") +
        " | Draw: " +
        state.draw +
        "\n  0 1 2\n" +
        [0, 1, 2]
          .map(function (r) {
            return (
              r +
              " " +
              [0, 1, 2]
                .map(function (c) {
                  return state.board[r * 3 + c] || ".";
                })
                .join(" ")
            );
          })
          .join("\n"),
    };
  },

  opportunities: function (state, actorId) {
    var options, chatChannels, opportunity;
    if (this.outcome(state) !== null) return [];
    if (state.players.indexOf(actorId) === -1) return [];
    chatChannels =
      state.eliminated &&
      state.eliminated.indexOf &&
      state.eliminated.indexOf(actorId) !== -1
        ? ["eliminated"]
        : ["room", "whisper", "spectator"];
    if (actorId !== state.players[state.currentTurn]) {
      return chatChannels.map(function (channel) {
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
      });
    }
    options = this.internalLegalOptions(state);
    if (options.length === 0) {
      return chatChannels.map(function (channel) {
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
      });
    }
    /** @type {Object} */
    opportunity = {
      id: "turn",
      kind: "turn",
      prompt:
        this.internalPlayerName(state, actorId) +
        ", choose where to place your mark.",
      decision: { type: "choose", options: options },
      deadline: {
        id: "turn",
        timeoutMs: 60000,
        onExpire: options[0].decision,
      },
      chat: {
        channels: chatChannels,
        defaultChannel: chatChannels[0] || null,
        canSend: true,
        memberships: chatChannels[0] === "eliminated" ? ["eliminated"] : [],
      },
    };
    return /** @type {Object[]} */ ([opportunity]).concat(
      chatChannels.slice(1).map(function (channel) {
        return {
          id: "chat:" + channel,
          kind: "chat",
          prompt: "Chat in " + channel + ".",
          decision: { type: "none" },
          chat: {
            channels: [channel],
            defaultChannel: channel,
            canSend: true,
            memberships: channel === "eliminated" ? ["eliminated"] : [],
          },
          submitPolicy: "multiple",
        };
      }),
    );
  },

  validate: function () {
    return { ok: true };
  },

  outcome: function (state) {
    var winnerId;
    if (state.winner) {
      winnerId = state.players[state.winner === "X" ? 0 : 1];
      return {
        type: "winners",
        playerIds: [winnerId],
        summary:
          this.internalPlayerName(state, winnerId) +
          " wins with " +
          state.winner +
          "!",
      };
    }
    if (state.draw)
      return { type: "draw", playerIds: [], summary: "It's a draw!" };
    return null;
  },

  predictions: function (state) {
    var moveCount = state.board.filter(function (c) {
      return c !== null;
    }).length;
    if (
      moveCount >= 1 &&
      state.board[4] === null &&
      !state.winner &&
      !state.draw
    ) {
      return [{ id: "x_takes_center", question: "Will X take the center?" }];
    }
    return null;
  },

  resolve: function (currentState, predictionId) {
    if (predictionId === "x_takes_center") {
      if (currentState.board[4] === "X") return true;
      if (currentState.board[4] === "O") return false;
      return null;
    }
    return null;
  },
};

export default GameLogic;
