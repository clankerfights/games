var WORD_BANK = [
  "ANCHOR",
  "APRON",
  "ARCADE",
  "ATLAS",
  "BALCONY",
  "BEACON",
  "BISCUIT",
  "BLOSSOM",
  "BRIDGE",
  "CABIN",
  "CANYON",
  "CARNIVAL",
  "CASSETTE",
  "CASTLE",
  "CIRCUIT",
  "COBALT",
  "COMET",
  "COMPASS",
  "COPPER",
  "CORAL",
  "CROWN",
  "CYPRESS",
  "DAGGER",
  "DELTA",
  "DESERT",
  "DIAMOND",
  "DRAGON",
  "ECHO",
  "EMBER",
  "ENGINE",
  "FABLE",
  "FALCON",
  "FERRY",
  "FJORD",
  "FOREST",
  "FOSSIL",
  "GARDEN",
  "GLACIER",
  "GOBLET",
  "HARBOR",
  "HELMET",
  "HONEY",
  "HORIZON",
  "IVORY",
  "JASMINE",
  "JUPITER",
  "KETTLE",
  "KINGDOM",
  "LADDER",
  "LANTERN",
  "LASER",
  "LIBRARY",
  "LIGHTHOUSE",
  "LOTUS",
  "MAGNET",
  "MARKET",
  "MARBLE",
  "MEADOW",
  "METEOR",
  "MIRROR",
  "MOSAIC",
  "NEBULA",
  "NEEDLE",
  "NICKEL",
  "OASIS",
  "ORBIT",
  "ORCHARD",
  "PALACE",
  "PAPER",
  "PARADE",
  "PEBBLE",
  "PHOENIX",
  "PIANO",
  "PILOT",
  "PIRATE",
  "PLANET",
  "POCKET",
  "PYRAMID",
  "QUARTZ",
  "RADAR",
  "RAVEN",
  "RELIC",
  "RIVER",
  "ROCKET",
  "SADDLE",
  "SAFFRON",
  "SATELLITE",
  "SCARLET",
  "SCEPTER",
  "SHADOW",
  "SIGNAL",
  "SILVER",
  "SKYLINE",
  "SPARROW",
  "SPHINX",
  "SPIRAL",
  "STADIUM",
  "STATION",
  "STORM",
  "SUMMIT",
  "TEMPLE",
  "THREAD",
  "THUNDER",
  "TIGER",
  "TORCH",
  "TOWER",
  "TRIDENT",
  "TULIP",
  "TUNNEL",
  "UMBRELLA",
  "VELVET",
  "VOYAGE",
  "WALNUT",
  "WILLOW",
  "WINDOW",
  "WIZARD",
  "YONDER",
  "ZEPHYR",
];

var CLUE_BANK = [
  "orbit",
  "harbor",
  "crown",
  "signal",
  "garden",
  "shadow",
  "spark",
  "summit",
  "mirror",
  "temple",
  "silver",
  "voyage",
  "beacon",
  "ember",
  "compass",
  "circuit",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function otherTeam(team) {
  return team === "red" ? "blue" : "red";
}

function sanitizeClue(value) {
  var raw = String(value || "")
    .trim()
    .slice(0, 24);
  raw = raw.replace(/[^A-Za-z0-9 -]/g, "");
  raw = raw.replace(/\s+/g, " ");
  if (!raw) return "signal";
  return raw;
}

function clampCount(value, max) {
  var n = Math.floor(Number(value) || 1);
  if (n < 1) n = 1;
  if (n > 5) n = 5;
  if (n > max) n = max;
  if (n < 1) n = 1;
  return n;
}

function makeAssignments(players) {
  var teams = { red: [], blue: [] };
  var teamByPlayer = {};
  var roles = {};
  var spymasters = { red: null, blue: null };
  var i, pid, team;
  for (i = 0; i < players.length; i++) {
    pid = players[i];
    team = i % 2 === 0 ? "red" : "blue";
    teams[team].push(pid);
    teamByPlayer[pid] = team;
  }
  spymasters.red = teams.red[0];
  spymasters.blue = teams.blue[0];
  for (i = 0; i < players.length; i++) {
    pid = players[i];
    roles[pid] =
      pid === spymasters.red || pid === spymasters.blue
        ? "spymaster"
        : "operative";
  }
  return {
    teams: teams,
    teamByPlayer: teamByPlayer,
    roles: roles,
    spymasters: spymasters,
  };
}

function buildCards(random) {
  var words = random.shuffle(WORD_BANK.slice()).slice(0, 25);
  var kinds = [];
  var i;
  for (i = 0; i < 9; i++) kinds.push("red");
  for (i = 0; i < 8; i++) kinds.push("blue");
  for (i = 0; i < 7; i++) kinds.push("neutral");
  kinds.push("assassin");
  kinds = random.shuffle(kinds);

  var cards = [];
  for (i = 0; i < 25; i++) {
    cards.push({
      index: i,
      word: words[i],
      kind: kinds[i],
      revealed: false,
      revealedBy: null,
    });
  }
  return cards;
}

function operativesFor(state, team) {
  var source = state.teams[team] || [];
  var out = [];
  var i, pid;
  for (i = 0; i < source.length; i++) {
    pid = source[i];
    if (state.roles[pid] === "operative") out.push(pid);
  }
  return out.length > 0 ? out : source.slice();
}

function activeGuesser(state) {
  var ops = operativesFor(state, state.currentTeam);
  if (ops.length === 0) return null;
  return ops[(state.operativeCursors[state.currentTeam] || 0) % ops.length];
}

function visibleCards(state, revealAll) {
  var out = [];
  var i, c, team;
  for (i = 0; i < state.cards.length; i++) {
    c = state.cards[i];
    team = revealAll || c.revealed ? c.kind : "unknown";
    out.push({
      index: c.index,
      word: c.word,
      revealed: c.revealed,
      team: team,
      revealedBy: c.revealedBy,
    });
  }
  return out;
}

function playerInfo(state) {
  var out = [];
  var i, pid;
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    out.push({
      id: pid,
      team: state.teamByPlayer[pid],
      role: state.roles[pid],
    });
  }
  return out;
}

function agentViewFor(state, revealAll) {
  var rows = [];
  var r, c, card, label;
  rows.push(
    "Current team: " +
      state.currentTeam.toUpperCase() +
      " Phase: " +
      state.phase,
  );
  rows.push(
    "Remaining: red=" + state.remaining.red + " blue=" + state.remaining.blue,
  );
  rows.push(
    "Spymasters: red=" +
      state.spymasters.red +
      " blue=" +
      state.spymasters.blue,
  );
  rows.push("Active guesser: " + (activeGuesser(state) || "-"));
  for (r = 0; r < 5; r++) {
    var parts = [];
    for (c = 0; c < 5; c++) {
      card = state.cards[r * 5 + c];
      label = "?";
      if (revealAll || card.revealed) {
        if (card.kind === "red") label = "R";
        else if (card.kind === "blue") label = "B";
        else if (card.kind === "neutral") label = "N";
        else label = "X";
      }
      parts.push(r * 5 + c + ":" + card.word + "[" + label + "]");
    }
    rows.push(parts.join(" | "));
  }
  if (state.clue) {
    rows.push(
      "Clue: " +
        state.clue.word +
        " " +
        state.clue.count +
        " (" +
        state.guessesMade +
        " guessed)",
    );
  }
  return rows.join("\n");
}

function makeLogEntry(state, text) {
  return (state.log || []).concat([text]).slice(-10);
}

function conclude(state, winnerTeam, reason, reveal) {
  state.phase = "gameOverDisplay";
  state.winnerTeam = winnerTeam;
  state.winnerReason = reason;
  state.lastReveal = reveal || state.lastReveal;
  state.log = makeLogEntry(
    state,
    winnerTeam.toUpperCase() + " wins: " + reason,
  );
  return state;
}

function advanceTurn(state) {
  var cursors = clone(state.operativeCursors);
  cursors[state.currentTeam] = (cursors[state.currentTeam] || 0) + 1;
  return {
    phase: "clue",
    players: state.players.slice(),
    teams: clone(state.teams),
    teamByPlayer: clone(state.teamByPlayer),
    roles: clone(state.roles),
    spymasters: clone(state.spymasters),
    operativeCursors: cursors,
    currentTeam: otherTeam(state.currentTeam),
    turnNumber: state.turnNumber + 1,
    cards: clone(state.cards),
    remaining: clone(state.remaining),
    clue: null,
    guessesMade: 0,
    maxGuesses: 0,
    lastReveal: state.lastReveal,
    revealSeq: state.revealSeq,
    log: state.log.slice(),
    winnerTeam: null,
    winnerReason: null,
  };
}

function unrevealedIndexes(state) {
  var out = [];
  var i;
  for (i = 0; i < state.cards.length; i++) {
    if (!state.cards[i].revealed) out.push(i);
  }
  return out;
}

function clueSuggestion(state) {
  return CLUE_BANK[
    (state.turnNumber + state.remaining.red + state.remaining.blue) %
      CLUE_BANK.length
  ];
}

function legalActions(state, playerId) {
  var actions = [];
  var max, clue, indexes, i;
  if (state.phase === "clue") {
    if (playerId !== state.spymasters[state.currentTeam]) return actions;
    max = Math.max(1, Math.min(5, state.remaining[state.currentTeam]));
    clue = clueSuggestion(state);
    actions.push({ type: "clue", word: clue, count: 1 });
    if (max >= 2) actions.push({ type: "clue", word: clue, count: 2 });
    if (max >= 3) actions.push({ type: "clue", word: clue, count: 3 });
    return actions;
  }
  if (state.phase === "guess") {
    if (playerId !== activeGuesser(state)) return actions;
    indexes = unrevealedIndexes(state);
    for (i = 0; i < indexes.length; i++) {
      actions.push({ type: "guess", index: indexes[i] });
    }
    if (state.guessesMade > 0) actions.push({ type: "pass" });
  }
  return actions;
}

function defaultActionFor(state, playerId) {
  var actions = legalActions(state, playerId);
  return actions.length > 0 ? actions[0] : null;
}

function actionOptionFor(state, action) {
  var card;
  if (!action?.type) return action;
  if (action.type === "clue") {
    return {
      action: action,
      label: "clue(word=<word>, count=<count>)",
      schema: GameLogic.actionSchemas.clue,
      required: true,
    };
  }
  if (action.type === "guess") {
    card = state.cards[action.index];
    return {
      action: action,
      label: "guess(" + action.index + ":" + (card ? card.word : "?") + ")",
    };
  }
  return action;
}

function actionOptionsFor(state, actions) {
  var out = [];
  var i;
  if (state.phase === "clue" && actions.length > 0)
    return [actionOptionFor(state, actions[0])];
  for (i = 0; i < actions.length; i++)
    out.push(actionOptionFor(state, actions[i]));
  return out;
}

function agentIntentFor(state) {
  return undefined;
}

var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  actionSchemas: {
    clue: {
      fields: {
        word: { kind: "string", freeText: true, minLength: 1, maxLength: 24 },
        count: { kind: "number", integer: true, min: 1, max: 5 },
      },
    },
  },

  setup: function (ctx) {
    var players = ctx.players.map(function (p) {
      return p.id;
    });
    var assignments = makeAssignments(players);
    return {
      phase: "clue",
      players: players,
      teams: assignments.teams,
      teamByPlayer: assignments.teamByPlayer,
      roles: assignments.roles,
      spymasters: assignments.spymasters,
      operativeCursors: { red: 0, blue: 0 },
      currentTeam: "red",
      turnNumber: 1,
      cards: buildCards(ctx.random),
      remaining: { red: 9, blue: 8 },
      clue: null,
      guessesMade: 0,
      maxGuesses: 0,
      lastReveal: null,
      revealSeq: 0,
      log: ["Red team opens the case file."],
      winnerTeam: null,
      winnerReason: null,
    };
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    var s,
      word,
      count,
      cardIndex,
      card,
      nextCards,
      nextRemaining,
      reveal,
      outcome,
      winner;
    if (!action?.type) return state;

    if (action.type === "finalize" && state.phase === "gameOverDisplay") {
      s = clone(state);
      s.phase = "gameOver";
      return s;
    }

    if (state.phase === "gameOver" || state.phase === "gameOverDisplay")
      return state;
    if (state.players.indexOf(playerId) === -1) return state;

    if (action.type === "clue") {
      if (state.phase !== "clue") return state;
      if (playerId !== state.spymasters[state.currentTeam]) return state;
      word = sanitizeClue(action.word);
      count = clampCount(action.count, state.remaining[state.currentTeam]);
      s = clone(state);
      s.phase = "guess";
      s.clue = {
        word: word,
        count: count,
        team: state.currentTeam,
        giver: playerId,
      };
      s.guessesMade = 0;
      s.maxGuesses = count;
      s.log = makeLogEntry(
        s,
        state.currentTeam.toUpperCase() + " clue: " + word + " " + count,
      );
      return s;
    }

    if (action.type === "pass") {
      if (state.phase !== "guess") return state;
      if (playerId !== activeGuesser(state)) return state;
      if (state.guessesMade < 1) return state;
      s = advanceTurn(state);
      s.log = makeLogEntry(s, state.currentTeam.toUpperCase() + " passed.");
      return s;
    }

    if (action.type === "guess") {
      if (state.phase !== "guess") return state;
      if (playerId !== activeGuesser(state)) return state;
      cardIndex = Math.floor(Number(action.index));
      if (cardIndex < 0 || cardIndex >= state.cards.length) return state;
      card = state.cards[cardIndex];
      if (!card || card.revealed) return state;

      s = clone(state);
      nextCards = s.cards;
      nextRemaining = s.remaining;
      nextCards[cardIndex].revealed = true;
      nextCards[cardIndex].revealedBy = playerId;
      s.guessesMade = s.guessesMade + 1;
      s.revealSeq = s.revealSeq + 1;

      outcome =
        card.kind === state.currentTeam
          ? "good"
          : card.kind === "assassin"
            ? "fatal"
            : "bad";
      reveal = {
        seq: s.revealSeq,
        index: cardIndex,
        word: card.word,
        kind: card.kind,
        guessingTeam: state.currentTeam,
        playerId: playerId,
        outcome: outcome,
      };
      s.lastReveal = reveal;

      if (card.kind === "red" || card.kind === "blue") {
        nextRemaining[card.kind] = Math.max(0, nextRemaining[card.kind] - 1);
      }

      if (card.kind === "assassin") {
        return conclude(
          s,
          otherTeam(state.currentTeam),
          "the assassin was revealed",
          reveal,
        );
      }

      if (
        (card.kind === "red" || card.kind === "blue") &&
        nextRemaining[card.kind] <= 0
      ) {
        return conclude(
          s,
          card.kind,
          "all " + card.kind + " agents were found",
          reveal,
        );
      }

      s.log = makeLogEntry(
        s,
        state.currentTeam.toUpperCase() +
          " revealed " +
          card.word +
          " as " +
          card.kind +
          ".",
      );

      if (card.kind === state.currentTeam && s.guessesMade < s.maxGuesses) {
        return s;
      }

      winner = s.winnerTeam;
      if (winner) return s;
      return advanceTurn(s);
    }

    return state;
  },

  internalTurnProjection: function (state, playerId) {
    var isSpectator = !playerId || state.players.indexOf(playerId) === -1;
    var revealAll =
      isSpectator ||
      state.roles[playerId] === "spymaster" ||
      state.phase === "gameOverDisplay" ||
      state.phase === "gameOver";
    var rawActions = isSpectator ? [] : legalActions(state, playerId);
    var actions = actionOptionsFor(state, rawActions);
    var result = null;
    var timeoutMs = null;
    var defaultAction = null;
    var currentPlayerId = null;

    if (state.phase === "gameOver") {
      result = {
        winners: (state.teams[state.winnerTeam] || []).slice(),
        summary:
          state.winnerTeam.toUpperCase() + " wins: " + state.winnerReason + ".",
      };
    }

    if (state.phase === "gameOverDisplay") {
      timeoutMs = 6000;
      if (playerId === null) defaultAction = { type: "finalize" };
    } else if (state.phase === "clue") {
      timeoutMs = 60000;
      currentPlayerId = state.spymasters[state.currentTeam];
      defaultAction = defaultActionFor(state, playerId);
    } else if (state.phase === "guess") {
      timeoutMs = 45000;
      currentPlayerId = activeGuesser(state);
      defaultAction = defaultActionFor(state, playerId);
    }

    return {
      view: {
        phase: state.phase,
        players: state.players.slice(),
        teams: clone(state.teams),
        playerInfo: playerInfo(state),
        spymasters: clone(state.spymasters),
        myTeam: isSpectator ? null : state.teamByPlayer[playerId],
        myRole: isSpectator ? "spectator" : state.roles[playerId],
        keyVisible: revealAll,
        currentTeam: state.currentTeam,
        currentPlayerId: currentPlayerId,
        activeGuesser: activeGuesser(state),
        turnNumber: state.turnNumber,
        cards: visibleCards(state, revealAll),
        remaining: clone(state.remaining),
        clue: state.clue ? clone(state.clue) : null,
        guessesMade: state.guessesMade,
        maxGuesses: state.maxGuesses,
        lastReveal: state.lastReveal ? clone(state.lastReveal) : null,
        log: state.log.slice(),
        winnerTeam: state.winnerTeam,
        winnerReason: state.winnerReason,
      },
      actions: actions,
      result: result,
      timeoutMs: timeoutMs,
      defaultAction: defaultAction,
      currentPlayerId: currentPlayerId,
      agentView: agentViewFor(state, revealAll),
      agent: agentIntentFor(state),
    };
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
    return ["room", "spectator"];
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
    var currentPlayerId = null;
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.phase === "clue") {
      currentPlayerId = state.spymasters[state.currentTeam];
      prompt =
        "Waiting for " +
        currentPlayerId +
        " to give a " +
        state.currentTeam +
        " clue.";
    } else if (state.phase === "guess") {
      currentPlayerId = activeGuesser(state);
      prompt = "Waiting for " + currentPlayerId + " to make a guess.";
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
