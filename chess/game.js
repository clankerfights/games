var GameLogic = {
  rules: {
    visibility: "public",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  // --- Constants ---
  internalINITIAL_BOARD: [
    [
      { type: "R", color: "b" },
      { type: "N", color: "b" },
      { type: "B", color: "b" },
      { type: "Q", color: "b" },
      { type: "K", color: "b" },
      { type: "B", color: "b" },
      { type: "N", color: "b" },
      { type: "R", color: "b" },
    ],
    [
      { type: "P", color: "b" },
      { type: "P", color: "b" },
      { type: "P", color: "b" },
      { type: "P", color: "b" },
      { type: "P", color: "b" },
      { type: "P", color: "b" },
      { type: "P", color: "b" },
      { type: "P", color: "b" },
    ],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [
      { type: "P", color: "w" },
      { type: "P", color: "w" },
      { type: "P", color: "w" },
      { type: "P", color: "w" },
      { type: "P", color: "w" },
      { type: "P", color: "w" },
      { type: "P", color: "w" },
      { type: "P", color: "w" },
    ],
    [
      { type: "R", color: "w" },
      { type: "N", color: "w" },
      { type: "B", color: "w" },
      { type: "Q", color: "w" },
      { type: "K", color: "w" },
      { type: "B", color: "w" },
      { type: "N", color: "w" },
      { type: "R", color: "w" },
    ],
  ],

  internalInBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  },

  internalCloneBoard(board) {
    return board.map(function (row) {
      return row.map(function (cell) {
        return cell ? { type: cell.type, color: cell.color } : null;
      });
    });
  },

  internalFindKing(board, color) {
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (p && p.type === "K" && p.color === color) return { r: r, c: c };
      }
    }
    return null;
  },

  // Generate raw moves for a piece (ignoring check constraints)
  internalRawMoves(board, r, c, enPassantTarget, castling) {
    var piece = board[r][c];
    if (!piece) return [];
    var moves = [];
    var color = piece.color;
    var enemy = color === "w" ? "b" : "w";

    var self = this;
    function addIfValid(tr, tc) {
      if (!self.internalInBounds(tr, tc)) return false;
      var target = board[tr][tc];
      if (target && target.color === color) return false;
      moves.push({ from: { r: r, c: c }, to: { r: tr, c: tc } });
      return !target; // continue sliding if empty
    }

    function slide(dirs) {
      for (var d = 0; d < dirs.length; d++) {
        var dr = dirs[d][0],
          dc = dirs[d][1];
        var tr = r + dr,
          tc = c + dc;
        while (self.internalInBounds(tr, tc)) {
          var t = board[tr][tc];
          if (t) {
            if (t.color === enemy)
              moves.push({ from: { r: r, c: c }, to: { r: tr, c: tc } });
            break;
          }
          moves.push({ from: { r: r, c: c }, to: { r: tr, c: tc } });
          tr += dr;
          tc += dc;
        }
      }
    }

    switch (piece.type) {
      case "P": {
        var dir = color === "w" ? -1 : 1;
        var startRow = color === "w" ? 6 : 1;
        // Forward one
        if (self.internalInBounds(r + dir, c) && !board[r + dir][c]) {
          moves.push({ from: { r: r, c: c }, to: { r: r + dir, c: c } });
          // Forward two from start
          if (r === startRow && !board[r + 2 * dir][c]) {
            moves.push({ from: { r: r, c: c }, to: { r: r + 2 * dir, c: c } });
          }
        }
        // Captures (diagonal)
        for (var dc = -1; dc <= 1; dc += 2) {
          var tr2 = r + dir,
            tc2 = c + dc;
          if (self.internalInBounds(tr2, tc2)) {
            var tgt = board[tr2][tc2];
            if (tgt && tgt.color === enemy) {
              moves.push({ from: { r: r, c: c }, to: { r: tr2, c: tc2 } });
            }
            // En passant
            if (
              enPassantTarget &&
              enPassantTarget.r === tr2 &&
              enPassantTarget.c === tc2
            ) {
              moves.push({
                from: { r: r, c: c },
                to: { r: tr2, c: tc2 },
                enPassant: true,
              });
            }
          }
        }
        // Expand promotions
        var promoRow = color === "w" ? 0 : 7;
        var expanded = [];
        for (var m = 0; m < moves.length; m++) {
          if (moves[m].to.r === promoRow) {
            var promos = ["Q", "R", "B", "N"];
            for (var pi = 0; pi < promos.length; pi++) {
              expanded.push({
                from: moves[m].from,
                to: moves[m].to,
                promotion: promos[pi],
              });
            }
          } else {
            expanded.push(moves[m]);
          }
        }
        return expanded;
      }
      case "N": {
        var knightMoves = [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1],
        ];
        for (var k = 0; k < knightMoves.length; k++) {
          addIfValid(r + knightMoves[k][0], c + knightMoves[k][1]);
        }
        break;
      }
      case "B":
        slide([
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]);
        break;
      case "R":
        slide([
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]);
        break;
      case "Q":
        slide([
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]);
        break;
      case "K": {
        var kingDirs = [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ];
        for (var ki = 0; ki < kingDirs.length; ki++) {
          addIfValid(r + kingDirs[ki][0], c + kingDirs[ki][1]);
        }
        // Castling
        if (castling) {
          var row = color === "w" ? 7 : 0;
          if (r === row && c === 4) {
            // Kingside
            if (
              castling[color + "K"] &&
              board[row][5] === null &&
              board[row][6] === null &&
              board[row][7] &&
              board[row][7].type === "R" &&
              board[row][7].color === color
            ) {
              if (
                !this.internalIsSquareAttacked(board, row, 4, enemy) &&
                !this.internalIsSquareAttacked(board, row, 5, enemy) &&
                !this.internalIsSquareAttacked(board, row, 6, enemy)
              ) {
                moves.push({
                  from: { r: row, c: 4 },
                  to: { r: row, c: 6 },
                  castle: "K",
                });
              }
            }
            // Queenside
            if (
              castling[color + "Q"] &&
              board[row][3] === null &&
              board[row][2] === null &&
              board[row][1] === null &&
              board[row][0] &&
              board[row][0].type === "R" &&
              board[row][0].color === color
            ) {
              if (
                !this.internalIsSquareAttacked(board, row, 4, enemy) &&
                !this.internalIsSquareAttacked(board, row, 3, enemy) &&
                !this.internalIsSquareAttacked(board, row, 2, enemy)
              ) {
                moves.push({
                  from: { r: row, c: 4 },
                  to: { r: row, c: 2 },
                  castle: "Q",
                });
              }
            }
          }
        }
        break;
      }
    }
    return moves;
  },

  // Check if a square is attacked by 'attackerColor'
  internalIsSquareAttacked(board, r, c, attackerColor) {
    // Check knight attacks
    var knightMoves = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (var k = 0; k < knightMoves.length; k++) {
      var nr = r + knightMoves[k][0],
        nc = c + knightMoves[k][1];
      if (this.internalInBounds(nr, nc)) {
        var p = board[nr][nc];
        if (p && p.color === attackerColor && p.type === "N") return true;
      }
    }
    // Check pawn attacks
    var pawnDir = attackerColor === "w" ? 1 : -1; // pawns attack from opposite direction
    for (var dc = -1; dc <= 1; dc += 2) {
      var pr = r + pawnDir,
        pc = c + dc;
      if (this.internalInBounds(pr, pc)) {
        var pp = board[pr][pc];
        if (pp && pp.color === attackerColor && pp.type === "P") return true;
      }
    }
    // Check king attacks
    var kingDirs = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    for (var ki = 0; ki < kingDirs.length; ki++) {
      var kr = r + kingDirs[ki][0],
        kc = c + kingDirs[ki][1];
      if (this.internalInBounds(kr, kc)) {
        var kp = board[kr][kc];
        if (kp && kp.color === attackerColor && kp.type === "K") return true;
      }
    }
    // Check sliding pieces (bishop/queen diagonals, rook/queen straights)
    var diagDirs = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
    for (var d = 0; d < diagDirs.length; d++) {
      var sr = r + diagDirs[d][0],
        sc = c + diagDirs[d][1];
      while (this.internalInBounds(sr, sc)) {
        var sp = board[sr][sc];
        if (sp) {
          if (
            sp.color === attackerColor &&
            (sp.type === "B" || sp.type === "Q")
          )
            return true;
          break;
        }
        sr += diagDirs[d][0];
        sc += diagDirs[d][1];
      }
    }
    var straightDirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (var s = 0; s < straightDirs.length; s++) {
      var sr2 = r + straightDirs[s][0],
        sc2 = c + straightDirs[s][1];
      while (this.internalInBounds(sr2, sc2)) {
        var sp2 = board[sr2][sc2];
        if (sp2) {
          if (
            sp2.color === attackerColor &&
            (sp2.type === "R" || sp2.type === "Q")
          )
            return true;
          break;
        }
        sr2 += straightDirs[s][0];
        sc2 += straightDirs[s][1];
      }
    }
    return false;
  },

  internalIsInCheck(board, color) {
    var king = this.internalFindKing(board, color);
    if (!king) return false;
    var enemy = color === "w" ? "b" : "w";
    return this.internalIsSquareAttacked(board, king.r, king.c, enemy);
  },

  // Apply a move on cloned board (for legality checking)
  internalApplyMove(board, move) {
    var nb = this.internalCloneBoard(board);
    var piece = nb[move.from.r][move.from.c];
    nb[move.to.r][move.to.c] = piece;
    nb[move.from.r][move.from.c] = null;
    // En passant capture
    if (move.enPassant) {
      nb[move.from.r][move.to.c] = null;
    }
    // Castling rook movement
    if (move.castle) {
      var row = move.from.r;
      if (move.castle === "K") {
        nb[row][5] = nb[row][7];
        nb[row][7] = null;
      } else {
        nb[row][3] = nb[row][0];
        nb[row][0] = null;
      }
    }
    // Promotion
    if (move.promotion) {
      nb[move.to.r][move.to.c] = { type: move.promotion, color: piece.color };
    }
    return nb;
  },

  // Get all legal moves for a color (filters out moves that leave king in check)
  internalLegalMoves(board, color, enPassantTarget, castling) {
    var moves = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (p && p.color === color) {
          var raw = this.internalRawMoves(
            board,
            r,
            c,
            enPassantTarget,
            castling,
          );
          for (var i = 0; i < raw.length; i++) {
            var nb = this.internalApplyMove(board, raw[i]);
            if (!this.internalIsInCheck(nb, color)) {
              moves.push(raw[i]);
            }
          }
        }
      }
    }
    return moves;
  },

  // Check for insufficient material
  internalInsufficientMaterial(board) {
    var pieces = { w: [], b: [] };
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (p) pieces[p.color].push({ type: p.type, r: r, c: c });
      }
    }
    var wc = pieces.w.length,
      bc = pieces.b.length;
    // King vs King
    if (wc === 1 && bc === 1) return true;
    // King+Bishop vs King or King+Knight vs King
    if (wc === 1 && bc === 2) {
      var other = pieces.b.find(function (piece) {
        return piece.type !== "K";
      });
      if (other && (other.type === "B" || other.type === "N")) return true;
    }
    if (bc === 1 && wc === 2) {
      var other2 = pieces.w.find(function (piece) {
        return piece.type !== "K";
      });
      if (other2 && (other2.type === "B" || other2.type === "N")) return true;
    }
    // King+Bishop vs King+Bishop (same color bishops)
    if (wc === 2 && bc === 2) {
      var wb = pieces.w.find(function (piece) {
        return piece.type === "B";
      });
      var bb = pieces.b.find(function (piece) {
        return piece.type === "B";
      });
      if (wb && bb) {
        var wbColor = (wb.r + wb.c) % 2;
        var bbColor = (bb.r + bb.c) % 2;
        if (wbColor === bbColor) return true;
      }
    }
    return false;
  },

  internalMoveToDecision: function (move) {
    var decision = {
      type: "move",
      from: this.internalSquareName(move.from),
      to: this.internalSquareName(move.to),
    };
    if (move.promotion) decision.promotion = move.promotion;
    return decision;
  },

  internalPieceName: function (pieceType) {
    var names = {
      K: "King",
      Q: "Queen",
      R: "Rook",
      B: "Bishop",
      N: "Knight",
      P: "Pawn",
    };
    return names[pieceType] || "Piece";
  },

  internalIsMoveCapture: function (state, move) {
    return move.enPassant || state.board[move.to.r][move.to.c] !== null;
  },

  internalMoveLabel: function (state, move) {
    var piece = state.board[move.from.r][move.from.c];
    var opponent, boardAfter, label;
    if (!piece) {
      return (
        this.internalSquareName(move.from) +
        "->" +
        this.internalSquareName(move.to)
      );
    }

    if (move.castle === "K" || move.castle === "Q") {
      label = move.castle === "K" ? "O-O" : "O-O-O";
    } else {
      label =
        this.internalPieceName(piece.type) +
        " " +
        this.internalSquareName(move.from) +
        (this.internalIsMoveCapture(state, move) ? "x" : "->") +
        this.internalSquareName(move.to);
      if (move.promotion) label += "=" + move.promotion;
      if (move.enPassant) label += " e.p.";
    }

    opponent = piece.color === "w" ? "b" : "w";
    boardAfter = this.internalApplyMove(state.board, move);
    if (this.internalIsInCheck(boardAfter, opponent)) label += "+";
    return label;
  },

  internalSquareName: function (square) {
    return "abcdefgh".charAt(square.c) + (8 - square.r);
  },

  internalParseSquareName: function (square) {
    if (!square) return null;
    if (
      typeof square === "object" &&
      typeof square.r === "number" &&
      typeof square.c === "number"
    ) {
      if (square.r >= 0 && square.r < 8 && square.c >= 0 && square.c < 8)
        return { r: square.r, c: square.c };
      return null;
    }
    if (typeof square !== "string" || square.length !== 2) return null;
    var file = square.charAt(0).toLowerCase();
    var rank = square.charAt(1);
    var c = "abcdefgh".indexOf(file);
    var r = 8 - parseInt(rank, 10);
    if (c < 0 || isNaN(r) || r < 0 || r >= 8) return null;
    return { r: r, c: c };
  },

  internalNormalizeDecision: function (decision) {
    if (!decision || decision.type !== "move" || !decision.from || !decision.to)
      return null;
    var from = this.internalParseSquareName(decision.from);
    var to = this.internalParseSquareName(decision.to);
    if (!from || !to) return null;
    /** @type {Object} */
    var out = { type: "move", from: from, to: to };
    if (decision.promotion) out.promotion = decision.promotion;
    return out;
  },

  internalLegalDecisions: function (state, color) {
    var legal = this.internalLegalMoves(
      state.board,
      color,
      state.enPassantTarget,
      state.castling,
    );
    var decisions = [];
    for (var i = 0; i < legal.length; i++) {
      decisions.push(this.internalMoveToDecision(legal[i]));
    }
    return decisions;
  },

  internalFindMatchingMove: function (state, color, decision) {
    var normalized = this.internalNormalizeDecision(decision);
    if (!normalized) return null;
    var legal = this.internalLegalMoves(
      state.board,
      color,
      state.enPassantTarget,
      state.castling,
    );
    for (var i = 0; i < legal.length; i++) {
      /** @type {Object} */
      var m = legal[i];
      if (
        m.from.r === normalized.from.r &&
        m.from.c === normalized.from.c &&
        m.to.r === normalized.to.r &&
        m.to.c === normalized.to.c
      ) {
        if (normalized.promotion) {
          if (m.promotion === normalized.promotion) return m;
        } else if (!m.promotion) {
          return m;
        }
      }
    }
    return null;
  },

  internalCheckedColor: function (state) {
    if (this.internalIsInCheck(state.board, "w")) return "w";
    if (this.internalIsInCheck(state.board, "b")) return "b";
    return null;
  },

  internalAgentView: function (state, playerId) {
    var checkedColor = this.internalCheckedColor(state) || "none";
    var playerIdx = playerId ? state.players.indexOf(playerId) : -1;
    var myColor =
      playerIdx === 0 ? "White" : playerIdx === 1 ? "Black" : "Spectator";
    var toMove = state.currentTurn === 0 ? "White" : "Black";
    var names = state.playerNames || {};
    var files = "  a b c d e f g h";
    var lines = [
      "You are: " + myColor,
      "White: " + (names[state.players[0]] || state.players[0]),
      "Black: " + (names[state.players[1]] || state.players[1]),
      "To move: " + toMove,
      "Check: " + checkedColor,
      "Last move: " +
        (state.lastMove ? JSON.stringify(state.lastMove) : "none"),
      files,
    ];
    for (var r = 0; r < 8; r++) {
      var rank = 8 - r;
      var row = rank + " ";
      for (var c = 0; c < 8; c++) {
        var piece = state.board[r][c];
        if (!piece) {
          row += ".";
        } else {
          var ch = piece.type;
          row += piece.color === "w" ? ch.toUpperCase() : ch.toLowerCase();
        }
        if (c < 7) row += " ";
      }
      lines.push(row);
    }
    return lines.join("\n");
  },

  // --- Opportunity contract: setup, apply, project, opportunities, outcome ---

  setup: function (ctx) {
    var players = ctx.players.map(function (p) {
      return p.id;
    });
    var playerNames = {};
    for (var i = 0; i < ctx.players.length; i++) {
      playerNames[ctx.players[i].id] = ctx.players[i].name || ctx.players[i].id;
    }
    return {
      board: this.internalCloneBoard(this.internalINITIAL_BOARD),
      players: players,
      playerNames: playerNames,
      currentTurn: 0, // 0 = white, 1 = black
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassantTarget: null, // {r, c} square that can be captured en passant
      capturedPieces: { w: [], b: [] },
      lastMove: null,
      moveCount: 0,
      halfmoveClock: 0, // for 50-move rule
      status: "playing", // 'playing', 'checkmate', 'stalemate', 'draw'
      winner: null,
    };
  },

  apply: function (state, playerId, action) {
    // Handle __system__ actions first
    if (playerId === "__system__") {
      if (action.type === "move") {
        // System timeout — apply the default action
        return this.apply(state, state.players[state.currentTurn], action);
      }
      return state;
    }

    if (state.status !== "playing") return state;
    if (action.type !== "move") return state;

    var playerIdx = state.players.indexOf(playerId);
    if (playerIdx === -1 || playerIdx !== state.currentTurn) return state;

    var color = playerIdx === 0 ? "w" : "b";
    /** @type {Object} */
    var matchedMove = this.internalFindMatchingMove(state, color, action);
    if (!matchedMove) return state;

    // Apply the move
    var newBoard = this.internalApplyMove(state.board, matchedMove);
    var piece = state.board[matchedMove.from.r][matchedMove.from.c];

    // Track captures
    var newCaptured = {
      w: state.capturedPieces.w.slice(),
      b: state.capturedPieces.b.slice(),
    };
    var captured = state.board[matchedMove.to.r][matchedMove.to.c];
    if (captured) {
      newCaptured[color].push(captured.type);
    }
    // En passant capture
    if (matchedMove.enPassant) {
      var epPiece = state.board[matchedMove.from.r][matchedMove.to.c];
      if (epPiece) newCaptured[color].push(epPiece.type);
    }

    // Update castling rights
    var newCastling = {
      wK: state.castling.wK,
      wQ: state.castling.wQ,
      bK: state.castling.bK,
      bQ: state.castling.bQ,
    };
    // King moved
    if (piece.type === "K") {
      newCastling[color + "K"] = false;
      newCastling[color + "Q"] = false;
    }
    // Rook moved or captured
    if (piece.type === "R") {
      if (matchedMove.from.r === 7 && matchedMove.from.c === 7)
        newCastling.wK = false;
      if (matchedMove.from.r === 7 && matchedMove.from.c === 0)
        newCastling.wQ = false;
      if (matchedMove.from.r === 0 && matchedMove.from.c === 7)
        newCastling.bK = false;
      if (matchedMove.from.r === 0 && matchedMove.from.c === 0)
        newCastling.bQ = false;
    }
    // Rook captured on starting square
    if (matchedMove.to.r === 7 && matchedMove.to.c === 7)
      newCastling.wK = false;
    if (matchedMove.to.r === 7 && matchedMove.to.c === 0)
      newCastling.wQ = false;
    if (matchedMove.to.r === 0 && matchedMove.to.c === 7)
      newCastling.bK = false;
    if (matchedMove.to.r === 0 && matchedMove.to.c === 0)
      newCastling.bQ = false;

    // En passant target
    var newEnPassant = null;
    if (
      piece.type === "P" &&
      Math.abs(matchedMove.to.r - matchedMove.from.r) === 2
    ) {
      newEnPassant = {
        r: (matchedMove.from.r + matchedMove.to.r) / 2,
        c: matchedMove.from.c,
      };
    }

    // Halfmove clock (reset on pawn move or capture)
    var newHalfmoveClock = state.halfmoveClock + 1;
    if (piece.type === "P" || captured || matchedMove.enPassant) {
      newHalfmoveClock = 0;
    }

    var nextTurn = (state.currentTurn + 1) % 2;
    var nextColor = nextTurn === 0 ? "w" : "b";

    // Check game-ending conditions
    var nextLegal = this.internalLegalMoves(
      newBoard,
      nextColor,
      newEnPassant,
      newCastling,
    );
    var nextInCheck = this.internalIsInCheck(newBoard, nextColor);
    var newStatus = "playing";
    var newWinner = null;

    if (nextLegal.length === 0) {
      if (nextInCheck) {
        newStatus = "checkmate";
        newWinner = playerIdx;
      } else {
        newStatus = "stalemate";
      }
    } else if (this.internalInsufficientMaterial(newBoard)) {
      newStatus = "draw";
    } else if (newHalfmoveClock >= 100) {
      // 50-move rule (100 half-moves)
      newStatus = "draw";
    }

    return {
      board: newBoard,
      players: state.players,
      playerNames: state.playerNames || {},
      currentTurn: nextTurn,
      castling: newCastling,
      enPassantTarget: newEnPassant,
      capturedPieces: newCaptured,
      lastMove: this.internalMoveToDecision(matchedMove),
      moveCount: state.moveCount + 1,
      halfmoveClock: newHalfmoveClock,
      status: newStatus,
      winner: newWinner,
    };
  },

  project: function (state, playerId) {
    var playerIdx = playerId ? state.players.indexOf(playerId) : -1;
    var myColor = playerIdx === 0 ? "w" : playerIdx === 1 ? "b" : null;
    var view = {
      board: state.board,
      myColor: myColor,
      checkedColor: this.internalCheckedColor(state),
      capturedPieces: state.capturedPieces,
      lastMove: state.lastMove,
      moveCount: state.moveCount,
      players: {
        white: state.players[0],
        black: state.players[1],
      },
      playerNames: state.playerNames || {},
    };

    return {
      view: view,
      agentView: this.internalAgentView(state, playerId),
    };
  },

  internalChatChannelsFor: function (state, actorId) {
    if (
      actorId === "__system__" ||
      !state.players ||
      state.players.indexOf(actorId) === -1
    )
      return [];
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

  opportunities: function (state, actorId, context) {
    var chatChannels, opportunity;
    if (this.outcome(state) !== null) return [];
    chatChannels = this.internalChatChannelsFor(state, actorId);
    if (chatChannels.length === 0) return [];
    var activeActor = state.players[state.currentTurn];
    if (actorId !== activeActor)
      return this.internalChatOpportunities(chatChannels);

    var color = state.currentTurn === 0 ? "w" : "b";
    var legal = this.internalLegalMoves(
      state.board,
      color,
      state.enPassantTarget,
      state.castling,
    );
    var decisions = [];
    var options = [];
    var i;
    if (legal.length === 0)
      return this.internalChatOpportunities(chatChannels);
    for (i = 0; i < legal.length; i++) {
      decisions.push(this.internalMoveToDecision(legal[i]));
      options.push({
        decision: decisions[i],
        label: this.internalMoveLabel(state, legal[i]),
      });
    }

    /** @type {Object} */

    opportunity = {
      id: "turn",
      kind: "turn",
      prompt:
        "Choose a legal chess move for " +
        (color === "w" ? "White" : "Black") +
        ".",
      decision: {
        type: "choose",
        options: options,
      },
      deadline: {
        id: "turn",
        timeoutMs: 60000,
        onExpire: decisions[0],
      },
      chat: {
        channels: chatChannels,
        defaultChannel: chatChannels[0] || null,
        canSend: true,
        memberships: chatChannels[0] === "eliminated" ? ["eliminated"] : [],
      },
    };
    return /** @type {Object[]} */ ([opportunity]).concat(
      this.internalChatOpportunities(chatChannels.slice(1)),
    );
  },

  validate: function (state, actorId, decision, context) {
    if (this.outcome(state) !== null)
      return { ok: false, error: "Game is already over.", code: "GAME_OVER" };
    var playerIdx = state.players.indexOf(actorId);
    if (playerIdx === -1 || playerIdx !== state.currentTurn) {
      return { ok: false, error: "It is not your turn.", code: "NOT_ACTOR" };
    }
    var color = playerIdx === 0 ? "w" : "b";
    if (this.internalFindMatchingMove(state, color, decision))
      return { ok: true };
    return {
      ok: false,
      error: "That is not a legal chess move.",
      code: "ILLEGAL_MOVE",
    };
  },

  outcome: function (state) {
    if (state.status === "checkmate") {
      return {
        type: "winners",
        playerIds: [state.players[state.winner]],
        summary:
          (state.winner === 0 ? "White" : "Black") + " wins by checkmate!",
      };
    }
    if (state.status === "stalemate") {
      return { type: "draw", playerIds: [], summary: "Stalemate - draw!" };
    }
    if (state.status === "draw") {
      return { type: "draw", playerIds: [], summary: "Draw!" };
    }
    return null;
  },
};

// Export for tests — the platform loader strips this
export default GameLogic;
