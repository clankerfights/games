import type { GameDefinition, SetupContext } from "@playgent/core";

// === State ===

interface TicTacToeState {
  board: (string | null)[]; // 9 cells, null = empty, 'X' or 'O'
  players: string[]; // [playerId for X, playerId for O]
  currentTurn: number; // 0 or 1
  winner: string | null;
  winCells: number[] | null;
  draw: boolean;
}

// === Actions ===

interface PlaceAction {
  type: "place";
  cell: number; // 0-8
}

type GameAction = PlaceAction | { type: "timer_expired" };

// === Win detection ===

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // cols
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

function checkWinner(
  board: (string | null)[],
): { mark: string; cells: number[] } | null {
  for (const line of WIN_LINES) {
    const a = line[0];
    const b = line[1];
    const c = line[2];
    const cellA = board[a];
    if (cellA && cellA === board[b] && cellA === board[c]) {
      return { mark: cellA, cells: [a, b, c] };
    }
  }
  return null;
}

// === Game Definition ===

const game: GameDefinition<TicTacToeState, GameAction> = {
  manifest: {
    slug: "tic-tac-toe",
    name: "Tic Tac Toe",
    description: "Classic 3x3 grid game. Get three in a row to win!",
    minPlayers: 2,
    maxPlayers: 2,
    version: "1.0.0",
    tags: ["classic", "strategy", "quick"],
    rules:
      "Perfect-information 3x3 alignment game. X moves first, O second. A player wins by occupying any full row, column, or diagonal; a full board with no line is a draw.\n\nboard is 9 cells in row-major order, using null, X, or O. place(cell) marks one empty cell 0-8. Prefer immediate wins, then blocks, center, corners, and forks.",
  },

  setup(ctx: SetupContext): TicTacToeState {
    return {
      board: Array(9).fill(null),
      players: ctx.players.map((p) => p.id),
      currentTurn: 0,
      winner: null,
      winCells: null,
      draw: false,
    };
  },

  apply(
    state: TicTacToeState,
    _playerId: string,
    action: GameAction,
  ): TicTacToeState {
    if (action.type === "timer_expired") {
      const empty = state.board.indexOf(null);
      if (empty === -1) return state;
      return game.apply(state, state.players[state.currentTurn], {
        type: "place",
        cell: empty,
      });
    }
    if (action.type !== "place") return state;
    if (state.board[action.cell] !== null) return state;
    if (state.winner || state.draw) return state;

    const mark = state.currentTurn === 0 ? "X" : "O";
    const newBoard = [...state.board];
    newBoard[action.cell] = mark;

    const result = checkWinner(newBoard);
    const winner = result ? result.mark : null;
    const winCells = result ? result.cells : null;
    const draw = !winner && newBoard.every((c) => c !== null);

    return {
      ...state,
      board: newBoard,
      currentTurn: (state.currentTurn + 1) % 2,
      winner,
      winCells,
      draw,
    };
  },

  project(state: TicTacToeState, playerId: string | null) {
    const isMyTurn =
      playerId !== null && state.players[state.currentTurn] === playerId;
    const gameOver = state.winner !== null || state.draw;
    const emptyCell = state.board.indexOf(null);

    const winnerId = state.winner
      ? state.players[state.winner === "X" ? 0 : 1]
      : null;
    const result = winnerId
      ? { winners: [winnerId], summary: `${state.winner} wins!` }
      : state.draw
        ? { winners: [], summary: "It's a draw!" }
        : null;

    return {
      view: {
        board: state.board,
        turn: state.players[state.currentTurn],
        winner: state.winner
          ? state.players[state.winner === "X" ? 0 : 1]
          : null,
        draw: state.draw,
        marks: {
          [state.players[0]]: "X",
          [state.players[1]]: "O",
        },
        winCells: state.winCells,
        result,
        timeoutMs: 60000,
        defaultAction:
          isMyTurn && !gameOver && emptyCell !== -1
            ? { type: "place", cell: emptyCell }
            : null,
        currentPlayerId: !gameOver ? state.players[state.currentTurn] : null,
      },
      agentView:
        `Turn: ${state.players[state.currentTurn]} | Winner: ${state.winner || "none"} | Draw: ${state.draw}\n  0 1 2\n` +
        [0, 1, 2]
          .map(
            (r) =>
              `${r} ${[0, 1, 2].map((c) => state.board[r * 3 + c] || ".").join(" ")}`,
          )
          .join("\n"),
    };
  },

  opportunities(state: TicTacToeState, actorId: string) {
    const isMyTurn = state.players[state.currentTurn] === actorId;
    const gameOver = state.winner !== null || state.draw;
    if (!isMyTurn || gameOver) return [];
    const actions = state.board
      .map((cell, index) =>
        cell === null ? { type: "place" as const, cell: index } : null,
      )
      .filter((action): action is PlaceAction => action !== null);
    return [
      {
        id: "place",
        kind: "turn",
        prompt: "Place your mark",
        decision: { type: "choose" as const, options: actions },
        deadline: {
          id: "turn",
          timeoutMs: 60000,
          onExpire: { type: "timer_expired" as const },
        },
      },
    ];
  },

  outcome(state: TicTacToeState) {
    if (state.winner) {
      return {
        type: "winners" as const,
        playerIds: [state.players[state.winner === "X" ? 0 : 1]],
        summary: `${state.winner} wins!`,
      };
    }
    if (state.draw) {
      return { type: "draw" as const, playerIds: [], summary: "It's a draw!" };
    }
    return null;
  },
};

export default game;
