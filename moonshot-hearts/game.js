var internalMhSeededRandom = function (seed) {
  var s = (seed + 0x6d2b79f5) | 0;
  var t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

var internalMhAdvanceSeed = function (seed) {
  return (seed + 0x6d2b79f5) | 0;
};

var internalMhShuffle = function (arr, seed) {
  var result = arr.slice();
  var s = seed | 0;
  for (var i = result.length - 1; i > 0; i--) {
    s = (s + 0x6d2b79f5) | 0;
    var r = internalMhSeededRandom(s);
    var j = Math.floor(r * (i + 1));
    var tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
};

var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  internalRANKS: [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "T",
    "J",
    "Q",
    "K",
    "A",
  ],
  internalSUITS: ["C", "D", "S", "H"],
  internalQUEEN_SPADES: 36,

  internalCardText: function (card) {
    return (
      this.internalRANKS[card % 13] + this.internalSUITS[Math.floor(card / 13)]
    );
  },

  _cardLong: function (card) {
    var rankNames = [
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Jack",
      "Queen",
      "King",
      "Ace",
    ];
    var suitNames = ["Clubs", "Diamonds", "Spades", "Hearts"];
    return rankNames[card % 13] + " of " + suitNames[Math.floor(card / 13)];
  },

  internalCardSuit: function (card) {
    return Math.floor(card / 13);
  },

  internalCardRank: function (card) {
    return card % 13;
  },

  internalPoints: function (card) {
    if (this.internalCardSuit(card) === 3) return 1;
    if (card === this.internalQUEEN_SPADES) return 13;
    return 0;
  },

  internalSortCards: function (cards) {
    return cards.slice().toSorted(function (a, b) {
      var sa = Math.floor(a / 13);
      var sb = Math.floor(b / 13);
      if (sa !== sb) return sa - sb;
      return (a % 13) - (b % 13);
    });
  },

  internalClone: function (state) {
    return JSON.parse(JSON.stringify(state));
  },

  internalEmptyNumberMap: function (players, value) {
    var out = {};
    for (var i = 0; i < players.length; i++) out[players[i]] = value;
    return out;
  },

  internalEmptyCardMap: function (players) {
    var out = {};
    for (var i = 0; i < players.length; i++) out[players[i]] = [];
    return out;
  },

  internalPassDirection: function (handNumber) {
    var dirs = ["left", "right", "across", "hold"];
    return dirs[(handNumber - 1) % 4];
  },

  internalPassTarget: function (state, playerId) {
    var idx = state.players.indexOf(playerId);
    var n = state.players.length;
    if (state.passDirection === "left") return state.players[(idx + 1) % n];
    if (state.passDirection === "right")
      return state.players[(idx + n - 1) % n];
    if (state.passDirection === "across") return state.players[(idx + 2) % n];
    return playerId;
  },

  _nextPasser: function (state, fromId) {
    var start = fromId ? state.players.indexOf(fromId) + 1 : 0;
    for (var i = 0; i < state.players.length; i++) {
      var id = state.players[(start + i) % state.players.length];
      if ((state.passed[id] || []).length < 3) return id;
    }
    return null;
  },

  internalHolderOf: function (hands, card) {
    for (var id in hands) {
      if (hands[id].indexOf(card) !== -1) return id;
    }
    return null;
  },

  internalDealNewHand: function (state) {
    var players = state.players.slice();
    var handNumber = state.handNumber + 1;
    var deck = [];
    for (var i = 0; i < 52; i++) deck.push(i);
    deck = internalMhShuffle(deck, state.nextSeed);
    var hands = this.internalEmptyCardMap(players);
    for (var d = 0; d < deck.length; d++) {
      hands[players[d % players.length]].push(deck[d]);
    }
    for (var h in hands) hands[h] = this.internalSortCards(hands[h]);

    var next = {
      players: players,
      scores: state.scores,
      targetScore: state.targetScore,
      handNumber: handNumber,
      trickNumber: 0,
      nextSeed: internalMhAdvanceSeed(state.nextSeed),
      phase: "passing",
      passDirection: this.internalPassDirection(handNumber),
      passed: this.internalEmptyCardMap(players),
      hands: hands,
      roundPoints: this.internalEmptyNumberMap(players, 0),
      takenTricks: this.internalEmptyNumberMap(players, 0),
      heartsBroken: false,
      firstTrick: true,
      leader: null,
      currentPlayer: null,
      trick: [],
      lastTrick: null,
      lastAction: null,
      roundSummary: null,
      gameWinner: null,
      gameWinners: [],
      result: null,
    };

    if (next.passDirection === "hold") {
      next.phase = "playing";
      next.currentPlayer = this.internalHolderOf(next.hands, 0);
      next.leader = next.currentPlayer;
      next.lastAction = { type: "hold", text: "No passing this round" };
    } else {
      next.currentPlayer = null;
      next.lastAction = { type: "deal", text: "Pass " + next.passDirection };
    }
    return next;
  },

  setup: function (ctx) {
    var players = ctx.players.map(function (p) {
      return p.id;
    });
    var scores = {};
    for (var i = 0; i < players.length; i++) scores[players[i]] = 0;
    var targetScore = 50;
    if (ctx.config?.targetScore) {
      var parsed = parseInt(ctx.config.targetScore, 10);
      if (parsed >= 25 && parsed <= 200) targetScore = parsed;
    }
    var seedRoll = 0.6328125;
    if (typeof ctx.random === "function") seedRoll = ctx.random();
    else if (ctx.random && typeof ctx.random.next === "function")
      seedRoll = ctx.random.next();
    else if (typeof ctx.seed === "number")
      seedRoll = internalMhSeededRandom(ctx.seed);
    var seedValue = Math.floor(seedRoll * 2147483647);
    var base = {
      players: players,
      scores: scores,
      targetScore: targetScore,
      handNumber: 0,
      nextSeed: seedValue | 0,
    };
    return this.internalDealNewHand(base);
  },

  internalFinishPassing: function (state) {
    var next = this.internalClone(state);
    var additions = this.internalEmptyCardMap(next.players);
    for (var i = 0; i < next.players.length; i++) {
      var giver = next.players[i];
      var target = this.internalPassTarget(next, giver);
      additions[target] = additions[target].concat(next.passed[giver]);
    }
    for (var j = 0; j < next.players.length; j++) {
      var id = next.players[j];
      next.hands[id] = this.internalSortCards(
        next.hands[id].concat(additions[id]),
      );
    }
    next.passed = this.internalEmptyCardMap(next.players);
    next.phase = "playing";
    next.currentPlayer = this.internalHolderOf(next.hands, 0);
    next.leader = next.currentPlayer;
    next.lastAction = {
      type: "pass_complete",
      text: "Cards passed " + next.passDirection,
    };
    return next;
  },

  internalLegalPlays: function (state, playerId) {
    var hand = (state.hands[playerId] || []).slice();
    if (hand.length === 0) return [];

    if (state.trick.length === 0) {
      if (state.firstTrick) {
        return hand.indexOf(0) !== -1 ? [0] : [];
      }
      var nonHearts = [];
      for (var i = 0; i < hand.length; i++) {
        if (this.internalCardSuit(hand[i]) !== 3) nonHearts.push(hand[i]);
      }
      if (!state.heartsBroken && nonHearts.length > 0) return nonHearts;
      return hand;
    }

    var leadSuit = this.internalCardSuit(state.trick[0].card);
    var follow = [];
    for (var f = 0; f < hand.length; f++) {
      if (this.internalCardSuit(hand[f]) === leadSuit) follow.push(hand[f]);
    }
    if (follow.length > 0) return follow;

    if (state.firstTrick) {
      var safe = [];
      for (var s = 0; s < hand.length; s++) {
        if (this.internalPoints(hand[s]) === 0) safe.push(hand[s]);
      }
      if (safe.length > 0) return safe;
    }
    return hand;
  },

  internalNextPlayerAfter: function (state, playerId) {
    var idx = state.players.indexOf(playerId);
    return state.players[(idx + 1) % state.players.length];
  },

  internalWinnerOfTrick: function (trick) {
    var leadSuit = this.internalCardSuit(trick[0].card);
    var best = trick[0];
    for (var i = 1; i < trick.length; i++) {
      var play = trick[i];
      if (
        this.internalCardSuit(play.card) === leadSuit &&
        this.internalCardRank(play.card) > this.internalCardRank(best.card)
      ) {
        best = play;
      }
    }
    return best.playerId;
  },

  internalFinishRound: function (state) {
    var next = this.internalClone(state);
    var moonShooter = null;
    for (var i = 0; i < next.players.length; i++) {
      var id = next.players[i];
      if (next.roundPoints[id] === 26) moonShooter = id;
    }

    var deltas = {};
    for (var j = 0; j < next.players.length; j++) {
      var pid = next.players[j];
      deltas[pid] = moonShooter
        ? pid === moonShooter
          ? 0
          : 26
        : next.roundPoints[pid];
    }

    var newScores = {};
    for (var k = 0; k < next.players.length; k++) {
      var sid = next.players[k];
      newScores[sid] = next.scores[sid] + deltas[sid];
    }
    next.scores = newScores;

    var summary = {
      handNumber: next.handNumber,
      deltas: deltas,
      roundPoints: next.roundPoints,
      moonShooter: moonShooter,
      scores: newScores,
    };
    next.roundSummary = summary;

    var reached = false;
    for (var r = 0; r < next.players.length; r++) {
      if (newScores[next.players[r]] >= next.targetScore) reached = true;
    }

    if (reached) {
      var bestScore = null;
      var winners = [];
      for (var w = 0; w < next.players.length; w++) {
        var wid = next.players[w];
        if (bestScore === null || newScores[wid] < bestScore) {
          bestScore = newScores[wid];
          winners = [wid];
        } else if (newScores[wid] === bestScore) {
          winners.push(wid);
        }
      }
      next.phase = "gameover";
      next.currentPlayer = null;
      next.gameWinner = winners[0];
      next.gameWinners = winners;
      next.result = {
        winner: winners[0],
        winners: winners,
        scores: newScores,
        targetScore: next.targetScore,
      };
      next.lastAction = { type: "gameover", text: "Game over" };
    } else {
      next.phase = "roundEnd";
      next.currentPlayer = null;
      next.lastAction = { type: "round_end", text: "Round scored" };
    }
    return next;
  },

  internalCompleteTrick: function (state) {
    var next = this.internalClone(state);
    var winner = this.internalWinnerOfTrick(next.trick);
    var points = 0;
    var cardTexts = [];
    for (var i = 0; i < next.trick.length; i++) {
      points += this.internalPoints(next.trick[i].card);
      cardTexts.push({
        playerId: next.trick[i].playerId,
        card: next.trick[i].card,
        cardText: this.internalCardText(next.trick[i].card),
      });
    }
    next.roundPoints[winner] += points;
    next.takenTricks[winner] += 1;
    next.trickNumber += 1;
    next.lastTrick = {
      trickNumber: next.trickNumber,
      winner: winner,
      points: points,
      cards: cardTexts,
    };
    next.trick = [];
    next.firstTrick = false;

    var empty = true;
    for (var p = 0; p < next.players.length; p++) {
      if (next.hands[next.players[p]].length > 0) empty = false;
    }
    if (empty) {
      var finished = this.internalFinishRound(next);
      if (finished.phase === "roundEnd")
        return this.internalDealNewHand(finished);
      return finished;
    }

    next.currentPlayer = winner;
    next.leader = winner;
    next.lastAction = { type: "trick", winner: winner, points: points };
    return next;
  },

  internalContinue: function (state) {
    if (state.phase !== "roundEnd") return state;
    return this.internalDealNewHand(state);
  },

  internalActionsFor: function (state, playerId) {
    var actions = [];
    if (state.phase === "passing") {
      var hand = state.hands[playerId] || [];
      if ((state.passed[playerId] || []).length >= 3) return actions;
      for (var i = 0; i < hand.length - 2; i++) {
        for (var j = i + 1; j < hand.length - 1; j++) {
          for (var k = j + 1; k < hand.length; k++) {
            var cards = [hand[i], hand[j], hand[k]];
            actions.push({
              type: "pass",
              cards: cards,
            });
          }
        }
      }
      return actions;
    }
    if (state.phase === "playing") {
      if (playerId !== state.currentPlayer) return actions;
      var legal = this.internalLegalPlays(state, playerId);
      for (var playIndex = 0; playIndex < legal.length; playIndex++) {
        actions.push({
          type: "play",
          card: legal[playIndex],
        });
      }
      return actions;
    }
    return actions;
  },

  internalActionOption: function (action) {
    if (!action?.type) return action;
    if (action.type === "pass")
      return {
        action: action,
        label:
          "pass(" +
          this.internalCardsToText(action.cards || []).join(" ") +
          ")",
      };
    if (action.type === "play")
      return {
        action: action,
        label: "play(" + this.internalCardText(action.card) + ")",
      };
    return action;
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    if (!action?.type) return state;

    if (action.type === "continue") return this.internalContinue(state);
    if (state.phase !== "passing" && state.phase !== "playing") return state;
    if (state.players.indexOf(playerId) === -1) return state;

    if (state.phase === "passing" && action.type === "pass") {
      var cards =
        action.cards &&
        Object.prototype.toString.call(action.cards) === "[object Array]"
          ? action.cards
          : [];
      if (cards.length !== 3) return state;
      var selected = [];
      var seen = {};
      for (var c = 0; c < cards.length; c++) {
        var parsedCard = parseInt(cards[c], 10);
        if (!Number.isFinite(parsedCard) || parsedCard < 0 || parsedCard > 51)
          return state;
        if (seen[String(parsedCard)]) return state;
        seen[String(parsedCard)] = true;
        selected.push(parsedCard);
      }
      var hand = state.hands[playerId] || [];
      if ((state.passed[playerId] || []).length >= 3) return state;
      for (var s = 0; s < selected.length; s++) {
        if (hand.indexOf(selected[s]) === -1) return state;
      }
      var next = this.internalClone(state);
      for (var r = 0; r < selected.length; r++) {
        var idx = next.hands[playerId].indexOf(selected[r]);
        next.hands[playerId].splice(idx, 1);
      }
      next.passed[playerId] = this.internalSortCards(selected);
      next.currentPlayer = null;
      next.lastAction = {
        type: "pass",
        playerId: playerId,
        count: 3,
        cardsText: this.internalCardsToText(next.passed[playerId]),
      };
      var done = true;
      for (var i = 0; i < next.players.length; i++) {
        if (next.passed[next.players[i]].length < 3) done = false;
      }
      if (done) return this.internalFinishPassing(next);
      return next;
    }

    if (state.phase === "playing" && action.type === "play") {
      if (playerId !== state.currentPlayer) return state;
      var playCard = parseInt(action.card, 10);
      var legal = this.internalLegalPlays(state, playerId);
      if (legal.indexOf(playCard) === -1) return state;
      var played = this.internalClone(state);
      var hidx = played.hands[playerId].indexOf(playCard);
      if (hidx === -1) return state;
      played.hands[playerId].splice(hidx, 1);
      played.trick.push({
        playerId: playerId,
        card: playCard,
        cardText: this.internalCardText(playCard),
      });
      if (this.internalCardSuit(playCard) === 3) played.heartsBroken = true;
      played.lastAction = {
        type: "play",
        playerId: playerId,
        card: playCard,
        cardText: this.internalCardText(playCard),
        points: this.internalPoints(playCard),
      };
      if (played.trick.length === played.players.length)
        return this.internalCompleteTrick(played);
      played.currentPlayer = this.internalNextPlayerAfter(played, playerId);
      return played;
    }

    return state;
  },

  internalPublicPlayers: function (state) {
    var out = [];
    for (var i = 0; i < state.players.length; i++) {
      var id = state.players[i];
      out.push({
        id: id,
        index: i,
        score: state.scores[id],
        roundPoints: state.roundPoints ? state.roundPoints[id] : 0,
        handCount: state.hands?.[id] ? state.hands[id].length : 0,
        passedCount: state.passed?.[id] ? state.passed[id].length : 0,
        takenTricks: state.takenTricks ? state.takenTricks[id] : 0,
        isCurrent: state.currentPlayer === id,
        isLeader: state.leader === id,
      });
    }
    return out;
  },

  internalCardsToText: function (cards) {
    var out = [];
    for (var i = 0; i < cards.length; i++)
      out.push(this.internalCardText(cards[i]));
    return out;
  },

  internalProjectTrick: function (trick) {
    var out = [];
    for (var i = 0; i < trick.length; i++) {
      out.push({
        playerId: trick[i].playerId,
        card: trick[i].card,
        cardText: this.internalCardText(trick[i].card),
      });
    }
    return out;
  },

  internalProjectLastTrick: function (lastTrick) {
    if (!lastTrick) return null;
    return {
      trickNumber: lastTrick.trickNumber,
      winner: lastTrick.winner,
      points: lastTrick.points,
      cards: lastTrick.cards,
    };
  },

  internalAgentView: function (state, playerId, actions) {
    var lines = [];
    lines.push("MOONSHOT HEARTS");
    lines.push(
      "Phase: " +
        state.phase +
        " | Hand: " +
        state.handNumber +
        " | Target: " +
        state.targetScore,
    );
    lines.push(
      "Pass: " +
        state.passDirection +
        " | Hearts broken: " +
        (state.heartsBroken ? "yes" : "no"),
    );
    lines.push("");
    lines.push("Scores:");
    for (var i = 0; i < state.players.length; i++) {
      var id = state.players[i];
      lines.push(
        "- " +
          id +
          ": " +
          state.scores[id] +
          " total, " +
          (state.roundPoints ? state.roundPoints[id] : 0) +
          " this round, " +
          (state.hands[id] ? state.hands[id].length : 0) +
          " cards",
      );
    }
    if (state.trick && state.trick.length > 0) {
      lines.push("");
      lines.push("Current trick:");
      for (var t = 0; t < state.trick.length; t++) {
        lines.push(
          "- " +
            state.trick[t].playerId +
            " played " +
            this.internalCardText(state.trick[t].card),
        );
      }
    }
    if (state.lastTrick) {
      lines.push("");
      lines.push(
        "Last trick: " +
          state.lastTrick.winner +
          " took " +
          state.lastTrick.points +
          " points",
      );
    }
    if (playerId && state.players.indexOf(playerId) !== -1) {
      lines.push("");
      lines.push(
        "Your hand: " +
          this.internalCardsToText(state.hands[playerId] || []).join(" "),
      );
      if (state.passed?.[playerId] && state.passed[playerId].length > 0) {
        lines.push(
          "Your selected passes: " +
            this.internalCardsToText(state.passed[playerId]).join(" "),
        );
      }
      if (state.phase === "passing" && actions.length > 0) {
        lines.push(
          "Pass context: choose 3 cards " +
            state.passDirection +
            "; selected " +
            (state.passed?.[playerId] ? state.passed[playerId].length : 0) +
            "/3",
        );
      } else if (state.phase === "playing") {
        lines.push(
          "Turn context: current player " +
            (state.currentPlayer || "-") +
            "; led suit " +
            (state.trick?.length ? state.trick[0].card.suit : "none"),
        );
        if (actions.length > 0) {
          var playable = [];
          for (var a = 0; a < actions.length; a++) {
            if (actions[a].card)
              playable.push(this.internalCardText(actions[a].card));
          }
          if (playable.length > 0)
            lines.push("Playable cards: " + playable.join(" "));
        }
      }
    } else {
      lines.push("");
      lines.push("Spectator hands:");
      for (var h = 0; h < state.players.length; h++) {
        var pid = state.players[h];
        lines.push(
          "- " +
            pid +
            ": " +
            this.internalCardsToText(state.hands[pid] || []).join(" "),
        );
      }
    }
    return lines.join("\n");
  },

  internalTurnProjection: function (state, playerId) {
    var isPlayer = playerId !== null && state.players.indexOf(playerId) !== -1;
    var isSpectator = !isPlayer;
    var actions = isPlayer ? this.internalActionsFor(state, playerId) : [];
    var actionOptions = [];
    var view = {
      phase: state.phase,
      players: this.internalPublicPlayers(state),
      currentPlayer: state.currentPlayer,
      leader: state.leader,
      handNumber: state.handNumber,
      trickNumber: state.trickNumber,
      targetScore: state.targetScore,
      passDirection: state.passDirection,
      heartsBroken: state.heartsBroken,
      firstTrick: state.firstTrick,
      trick: this.internalProjectTrick(state.trick || []),
      lastTrick: this.internalProjectLastTrick(state.lastTrick),
      roundSummary: state.roundSummary,
      lastAction: state.lastAction,
      gameWinner: state.gameWinner,
      gameWinners: state.gameWinners || [],
      isSpectator: isSpectator,
    };

    if (isPlayer) {
      view.myId = playerId;
      view.myHand = (state.hands[playerId] || []).slice();
      view.myHandText = this.internalCardsToText(view.myHand);
      view.myPassed = state.passed?.[playerId]
        ? state.passed[playerId].slice()
        : [];
      view.myPassedText = this.internalCardsToText(view.myPassed);
    } else {
      view.hands = {};
      view.handsText = {};
      for (var i = 0; i < state.players.length; i++) {
        var id = state.players[i];
        view.hands[id] = (state.hands[id] || []).slice();
        view.handsText[id] = this.internalCardsToText(view.hands[id]);
      }
    }

    var timeoutMs =
      state.phase === "roundEnd"
        ? 8000
        : state.phase === "passing"
          ? 30000
          : 45000;
    var defaultAction = actions.length > 0 ? actions[0] : null;
    if (state.phase === "roundEnd") defaultAction = { type: "continue" };
    for (var ao = 0; ao < actions.length; ao++)
      actionOptions.push(this.internalActionOption(actions[ao]));

    return {
      view: view,
      actions: actionOptions,
      result: state.result,
      timeoutMs: timeoutMs,
      defaultAction: defaultAction,
      currentPlayerId: state.phase === "passing" ? null : state.currentPlayer,
      chatChannel: null,
      agentView: this.internalAgentView(state, playerId, actions),
      agent: this.internalAgentIntent(state),
    };
  },

  internalAgentIntent: function (state) {
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
    var waiting = 0;
    var i;
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.phase === "passing") {
      for (i = 0; i < state.players.length; i++) {
        if ((state.passed[state.players[i]] || []).length < 3) waiting++;
      }
      prompt =
        waiting > 0
          ? "Waiting for " +
            waiting +
            " player" +
            (waiting === 1 ? "" : "s") +
            " to pass cards."
          : "Waiting for passed cards to resolve.";
    } else if (state.phase === "playing" && state.currentPlayer) {
      prompt = "Waiting for " + state.currentPlayer + " to play a card.";
    } else if (state.phase === "roundEnd") {
      prompt = "Round ended - next hand starts automatically.";
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
