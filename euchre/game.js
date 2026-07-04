var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  actionSchemas: {},

  internalRANKS: ["9", "T", "J", "Q", "K", "A"],
  internalSUITS: ["s", "h", "d", "c"],
  internalSUIT_NAMES: { s: "Spades", h: "Hearts", d: "Diamonds", c: "Clubs" },
  internalTARGET_SCORE: 10,

  setup: function (ctx) {
    var playerIds = [];
    for (var i = 0; i < ctx.players.length && i < 4; i++) {
      playerIds.push(ctx.players[i].id);
    }

    var teams = {};
    for (var p = 0; p < playerIds.length; p++) {
      teams[playerIds[p]] = p % 2;
    }

    var base = {
      players: playerIds,
      teams: teams,
      dealerIndex: 0,
      scores: [0, 0],
      targetScore: this.internalTARGET_SCORE,
      handNumber: 0,
      rng: ctx.random.integer(1, 2147483646),
    };

    return this.internalStartHand(base, 0, 1);
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    if (!action?.type) return state;

    if (state.phase === "gameOver") return state;

    if (state.phase === "handEnd") {
      if (playerId !== "__system__" || action.type !== "continue") return state;
      var nextDealer = (state.dealerIndex + 1) % state.players.length;
      var base = this.internalClone(state);
      return this.internalStartHand(base, nextDealer, state.handNumber + 1);
    }

    if (state.currentPlayer !== playerId) return state;

    if (state.phase === "orderUp") {
      return this.internalPerformOrderUp(state, playerId, action);
    }
    if (state.phase === "discard") {
      return this.internalPerformDiscard(state, playerId, action);
    }
    if (state.phase === "callTrump") {
      return this.internalPerformCallTrump(state, playerId, action);
    }
    if (state.phase === "play") {
      return this.internalPerformPlay(state, playerId, action);
    }

    return state;
  },

  internalTurnProjection: function (state, playerId) {
    var actions = this.internalActionsFor(state, playerId);
    var view = this.internalBuildView(state, playerId);
    var result = null;
    if (state.phase === "gameOver") {
      result = {
        winners: this.internalTeamPlayers(state, state.winnerTeam),
        summary:
          this.internalTeamName(state.winnerTeam) +
          " wins Euchre, " +
          state.scores[state.winnerTeam] +
          "-" +
          state.scores[1 - state.winnerTeam] +
          "!",
      };
    }

    var defaultAction = null;
    if (state.phase === "handEnd" && playerId === null) {
      defaultAction = { type: "continue" };
    } else if (actions.length > 0) {
      defaultAction = this.internalUnwrap(actions[0]);
    }

    return {
      view: view,
      actions: actions,
      result: result,
      timeoutMs: state.phase === "handEnd" ? 2500 : 120000,
      defaultAction: defaultAction,
      currentPlayerId:
        state.phase === "gameOver" || state.phase === "handEnd"
          ? null
          : state.currentPlayer,
      agentView: this.internalAgentView(state, playerId),
      agent: this.internalAgentIntent(state),
    };
  },

  internalAgentIntent: function (state) {
    return undefined;
  },

  internalPerformOrderUp: function (state, playerId, action) {
    var s = this.internalClone(state);
    if (action.type === "pass") {
      if (s.orderOffset >= 4) {
        s.phase = "callTrump";
        s.orderRound = 2;
        s.orderOffset = 1;
        s.turnedDownSuit = this.internalCardSuit(s.upcard);
        s.currentPlayer = s.players[(s.dealerIndex + 1) % s.players.length];
        s.lastEvent = {
          id: "turn-down-" + s.handNumber,
          type: "turn_down",
          title: "NO SALE",
          subtitle: this.internalSuitName(s.turnedDownSuit) + " turned down",
          tone: "quiet",
        };
        return s;
      }
      s.orderOffset += 1;
      s.currentPlayer =
        s.players[(s.dealerIndex + s.orderOffset) % s.players.length];
      return s;
    }

    if (action.type !== "order_up") return state;
    return this.internalAcceptTrump(
      s,
      playerId,
      this.internalCardSuit(s.upcard),
      this.internalMustGoAloneOnOrderUp(s, playerId) || action.alone === true,
      true,
    );
  },

  internalPerformDiscard: function (state, playerId, action) {
    if (action.type !== "discard") return state;
    if (playerId !== state.players[state.dealerIndex]) return state;
    if (state.hands[playerId].indexOf(action.card) === -1) return state;

    var s = this.internalClone(state);
    s.hands[playerId] = this.internalRemoveOne(s.hands[playerId], action.card);
    s.buried = [action.card].concat(s.kitty);
    s.kitty = [];
    s.phase = "play";
    s.leader = this.internalNextActive(s, s.players[s.dealerIndex]);
    s.currentPlayer = s.leader;
    s.trick = [];
    s.lastEvent = {
      id: "discard-" + s.handNumber,
      type: "discard",
      title: "TRUMP LOCKED",
      subtitle:
        this.internalTeamName(s.makerTeam) +
        " attacks in " +
        this.internalSuitName(s.trump),
      tone: "trump",
    };
    return s;
  },

  internalPerformCallTrump: function (state, playerId, action) {
    var s = this.internalClone(state);
    if (action.type === "pass") {
      if (s.orderOffset >= 4) return state;
      s.orderOffset += 1;
      s.currentPlayer =
        s.players[(s.dealerIndex + s.orderOffset) % s.players.length];
      return s;
    }

    if (action.type !== "call_trump") return state;
    if (!this.internalIsValidCalledSuit(s, action.suit)) return state;
    return this.internalAcceptTrump(
      s,
      playerId,
      action.suit,
      action.alone === true,
      false,
    );
  },

  internalPerformPlay: function (state, playerId, action) {
    if (action.type !== "play") return state;
    var legal = this.internalLegalCards(state, playerId);
    if (legal.indexOf(action.card) === -1) return state;

    var s = this.internalClone(state);
    s.hands[playerId] = this.internalRemoveOne(s.hands[playerId], action.card);
    s.trick.push({ playerId: playerId, card: action.card });

    var activeCount = this.internalActivePlayers(s, s.leader).length;
    if (s.trick.length < activeCount) {
      s.currentPlayer = this.internalNextActive(s, playerId);
      return s;
    }

    var winner = this.internalTrickWinner(s.trick, s.trump);
    var team = s.teams[winner];
    s.tricksWon[team] += 1;
    s.completedTricks.push({
      number: s.completedTricks.length + 1,
      winner: winner,
      team: team,
      cards: s.trick.slice(),
    });
    s.lastEvent = {
      id: "trick-" + s.handNumber + "-" + s.completedTricks.length,
      type: "trick",
      title: "TRICK HIT",
      subtitle:
        this.internalTeamName(team) +
        " takes trick " +
        s.completedTricks.length,
      tone: "trick",
      playerId: winner,
      team: team,
    };

    if (s.completedTricks.length >= 5) {
      return this.internalFinishHand(s);
    }

    s.leader = winner;
    s.currentPlayer = winner;
    s.trick = [];
    return s;
  },

  internalAcceptTrump: function (s, maker, trump, alone, pickedUp) {
    var dealer = s.players[s.dealerIndex];
    s.trump = trump;
    s.maker = maker;
    s.makerTeam = s.teams[maker];
    s.alone = alone;
    s.sitOut = alone ? this.internalPartnerOf(s, maker) : null;
    s.orderOffset = 0;
    s.lastEvent = {
      id: "trump-" + s.handNumber,
      type: alone ? "alone" : "trump",
      title: alone ? "LONER JACKPOT" : "TRUMP!",
      subtitle:
        this.internalTeamName(s.makerTeam) +
        " makes " +
        this.internalSuitName(trump),
      tone: alone ? "jackpot" : "trump",
      playerId: maker,
      team: s.makerTeam,
    };

    if (pickedUp) {
      s.hands[dealer].push(s.upcard);
      s.kitty = s.kitty.slice(1);
      s.phase = "discard";
      s.currentPlayer = dealer;
      return s;
    }

    s.phase = "play";
    s.leader = this.internalNextActive(s, dealer);
    s.currentPlayer = s.leader;
    s.trick = [];
    return s;
  },

  internalFinishHand: function (s) {
    var makerTricks = s.tricksWon[s.makerTeam];
    var scoringTeam = s.makerTeam;
    var points = 0;
    var eventType = "point";
    var title = "POINT PAID";

    if (makerTricks >= 3) {
      if (makerTricks === 5) {
        points = s.alone ? 4 : 2;
        eventType = s.alone ? "loner" : "march";
        title = s.alone ? "JACKPOT LONER" : "MARCH BONUS";
      } else {
        points = 1;
      }
    } else {
      scoringTeam = 1 - s.makerTeam;
      points = 2;
      eventType = "euchre";
      title = "EUCHRE BLAST";
    }

    s.scores[scoringTeam] += points;
    s.handSummary = {
      maker: s.maker,
      makerTeam: s.makerTeam,
      scoringTeam: scoringTeam,
      makerTricks: makerTricks,
      defenderTricks: 5 - makerTricks,
      points: points,
      alone: s.alone,
      eventType: eventType,
    };
    s.currentPlayer = null;
    s.leader = null;
    s.trick = [];
    s.lastEvent = {
      id: "score-" + s.handNumber,
      type: eventType,
      title: title,
      subtitle:
        this.internalTeamName(scoringTeam) +
        " scores " +
        points +
        " (" +
        s.scores[0] +
        "-" +
        s.scores[1] +
        ")",
      tone: eventType,
      team: scoringTeam,
    };

    if (s.scores[scoringTeam] >= s.targetScore) {
      s.phase = "gameOver";
      s.winnerTeam = scoringTeam;
      s.lastEvent = {
        id: "game-" + s.handNumber,
        type: "game_over",
        title: "EUCHRE WIN",
        subtitle:
          this.internalTeamName(scoringTeam) +
          " cashes out " +
          s.scores[scoringTeam] +
          "-" +
          s.scores[1 - scoringTeam],
        tone: "jackpot",
        team: scoringTeam,
      };
    } else {
      s.phase = "handEnd";
    }
    return s;
  },

  internalStartHand: function (base, dealerIndex, handNumber) {
    var shuffled = this.internalShuffle(this.internalNewDeck(), base.rng);
    var deck = shuffled.deck;
    var players = base.players.slice();
    var hands = {};
    for (var i = 0; i < players.length; i++) {
      hands[players[i]] = [];
    }

    for (var cardRound = 0; cardRound < 5; cardRound++) {
      for (var offset = 1; offset <= players.length; offset++) {
        var pid = players[(dealerIndex + offset) % players.length];
        hands[pid].push(deck.shift());
      }
    }

    var kitty = deck.slice();
    var upcard = kitty[0];
    return {
      players: players,
      teams: this.internalClone(base.teams),
      dealerIndex: dealerIndex,
      scores: base.scores.slice(),
      targetScore: base.targetScore || this.internalTARGET_SCORE,
      handNumber: handNumber,
      rng: shuffled.rng,
      phase: "orderUp",
      orderRound: 1,
      orderOffset: 1,
      currentPlayer: players[(dealerIndex + 1) % players.length],
      hands: hands,
      kitty: kitty,
      buried: [],
      upcard: upcard,
      turnedDownSuit: null,
      trump: null,
      maker: null,
      makerTeam: null,
      alone: false,
      sitOut: null,
      leader: null,
      trick: [],
      tricksWon: [0, 0],
      completedTricks: [],
      handSummary: null,
      winnerTeam: null,
      lastEvent: {
        id: "deal-" + handNumber,
        type: "deal",
        title: "NEW DEAL",
        subtitle: "Upcard " + this.internalCardName(upcard),
        tone: "deal",
      },
    };
  },

  internalBuildView: function (state, playerId) {
    var playersView = [];
    for (var i = 0; i < state.players.length; i++) {
      var pid = state.players[i];
      playersView.push({
        id: pid,
        seat: i,
        team: state.teams[pid],
        dealer: i === state.dealerIndex,
        maker: pid === state.maker,
        current: pid === state.currentPlayer,
        leader: pid === state.leader,
        sittingOut: pid === state.sitOut,
        handCount: state.hands[pid] ? state.hands[pid].length : 0,
        tricks: state.tricksWon[state.teams[pid]],
      });
    }

    var view = {
      phase: state.phase,
      handNumber: state.handNumber,
      players: playersView,
      teams: [
        this.internalTeamPlayers(state, 0),
        this.internalTeamPlayers(state, 1),
      ],
      scores: {
        team0: state.scores[0],
        team1: state.scores[1],
        target: state.targetScore,
      },
      dealer: state.players[state.dealerIndex],
      currentPlayer: state.currentPlayer,
      leader: state.leader,
      upcard: state.upcard,
      kittyCount: state.kitty.length,
      turnedDownSuit: state.turnedDownSuit,
      trump: state.trump,
      maker: state.maker,
      makerTeam: state.makerTeam,
      alone: state.alone,
      sitOut: state.sitOut,
      trick: state.trick.slice(),
      tricksWon: { team0: state.tricksWon[0], team1: state.tricksWon[1] },
      completedTricks: state.completedTricks.slice(
        Math.max(0, state.completedTricks.length - 5),
      ),
      handSummary: state.handSummary,
      lastEvent: state.lastEvent,
      winnerTeam: state.winnerTeam,
    };

    if (playerId && state.hands[playerId]) {
      view.myHand = this.internalSortHand(state.hands[playerId], state.trump);
    }
    if (playerId === null) {
      var allHands = {};
      for (var h = 0; h < state.players.length; h++) {
        allHands[state.players[h]] = this.internalSortHand(
          state.hands[state.players[h]],
          state.trump,
        );
      }
      view.allHands = allHands;
      view.kitty = state.kitty.slice();
      view.buried = state.buried.slice();
    }
    return view;
  },

  internalActionsFor: function (state, playerId) {
    if (!playerId || state.phase === "gameOver" || state.phase === "handEnd")
      return [];
    if (state.currentPlayer !== playerId) return [];
    var actions = [];
    var upSuit = this.internalCardSuit(state.upcard);

    if (state.phase === "orderUp") {
      var forcesAlone = this.internalMustGoAloneOnOrderUp(state, playerId);
      actions.push(this.internalOption("Pass", { type: "pass" }, "pass"));
      if (forcesAlone) {
        actions.push(
          this.internalOption(
            "Order Alone " + this.internalSuitName(upSuit),
            { type: "order_up", alone: true },
            "jackpot",
          ),
        );
      } else {
        actions.push(
          this.internalOption(
            "Order " + this.internalSuitName(upSuit),
            { type: "order_up", alone: false },
            "trump",
          ),
        );
        actions.push(
          this.internalOption(
            "Go Alone " + this.internalSuitName(upSuit),
            { type: "order_up", alone: true },
            "jackpot",
          ),
        );
      }
      return actions;
    }

    if (state.phase === "callTrump") {
      var isDealerStuck =
        state.orderOffset >= 4 && playerId === state.players[state.dealerIndex];
      if (!isDealerStuck)
        actions.push(this.internalOption("Pass", { type: "pass" }, "pass"));
      for (var i = 0; i < this.internalSUITS.length; i++) {
        var suit = this.internalSUITS[i];
        if (suit === state.turnedDownSuit) continue;
        actions.push(
          this.internalOption(
            "Call " + this.internalSuitName(suit),
            { type: "call_trump", suit: suit, alone: false },
            "trump",
          ),
        );
        actions.push(
          this.internalOption(
            "Go Alone " + this.internalSuitName(suit),
            { type: "call_trump", suit: suit, alone: true },
            "jackpot",
          ),
        );
      }
      return actions;
    }

    if (state.phase === "discard") {
      var hand = this.internalSortHand(state.hands[playerId], state.trump);
      for (var d = 0; d < hand.length; d++) {
        actions.push(
          this.internalOption(
            "Discard " + this.internalCardName(hand[d]),
            { type: "discard", card: hand[d] },
            "discard",
          ),
        );
      }
      return actions;
    }

    if (state.phase === "play") {
      var legal = this.internalLegalCards(state, playerId);
      for (var c = 0; c < legal.length; c++) {
        actions.push(
          this.internalOption(
            "Play " + this.internalCardName(legal[c]),
            { type: "play", card: legal[c] },
            "play",
          ),
        );
      }
      return actions;
    }

    return actions;
  },

  internalAgentView: function (state, playerId) {
    var lines = [];
    lines.push("Phase: " + state.phase + " | Hand " + state.handNumber);
    lines.push(
      "Score: Team A " +
        state.scores[0] +
        " - Team B " +
        state.scores[1] +
        " (first to " +
        state.targetScore +
        ")",
    );
    lines.push(
      "Dealer: seat " +
        state.dealerIndex +
        " | Current: " +
        (state.currentPlayer || "-"),
    );
    lines.push(
      "Upcard: " +
        this.internalCardName(state.upcard) +
        " | Trump: " +
        (state.trump ? this.internalSuitName(state.trump) : "-"),
    );
    if (state.maker)
      lines.push(
        "Maker: " +
          state.maker +
          " (" +
          this.internalTeamName(state.makerTeam) +
          ")" +
          (state.alone ? " alone" : ""),
      );
    lines.push(
      "Tricks: Team A " +
        state.tricksWon[0] +
        " | Team B " +
        state.tricksWon[1],
    );
    if (state.trick.length > 0) {
      var trickParts = [];
      for (var i = 0; i < state.trick.length; i++) {
        trickParts.push(
          state.trick[i].playerId +
            ":" +
            this.internalCardName(state.trick[i].card),
        );
      }
      lines.push("Current trick: " + trickParts.join(" "));
    }
    if (playerId && state.hands[playerId]) {
      var hand = this.internalSortHand(state.hands[playerId], state.trump);
      var handNames = [];
      for (var h = 0; h < hand.length; h++)
        handNames.push(this.internalCardName(hand[h]));
      lines.push("Your hand: " + handNames.join(" "));
    } else if (playerId === null) {
      for (var p = 0; p < state.players.length; p++) {
        var pid = state.players[p];
        var cards = this.internalSortHand(state.hands[pid], state.trump);
        var names = [];
        for (var n = 0; n < cards.length; n++)
          names.push(this.internalCardName(cards[n]));
        lines.push(pid + ": " + names.join(" "));
      }
    }
    return lines.join("\n");
  },

  internalLegalCards: function (state, playerId) {
    var hand = state.hands[playerId] ? state.hands[playerId].slice() : [];
    if (hand.length === 0) return [];
    if (!state.trick || state.trick.length === 0)
      return this.internalSortHand(hand, state.trump);

    var ledSuit = this.internalEffectiveSuit(state.trick[0].card, state.trump);
    var follow = [];
    for (var i = 0; i < hand.length; i++) {
      if (this.internalEffectiveSuit(hand[i], state.trump) === ledSuit)
        follow.push(hand[i]);
    }
    return this.internalSortHand(
      follow.length > 0 ? follow : hand,
      state.trump,
    );
  },

  internalTrickWinner: function (trick, trump) {
    var ledSuit = this.internalEffectiveSuit(trick[0].card, trump);
    var best = trick[0];
    var bestPower = this.internalCardPower(best.card, trump, ledSuit);
    for (var i = 1; i < trick.length; i++) {
      var power = this.internalCardPower(trick[i].card, trump, ledSuit);
      if (power > bestPower) {
        best = trick[i];
        bestPower = power;
      }
    }
    return best.playerId;
  },

  internalCardPower: function (card, trump, ledSuit) {
    var rank = this.internalCardRank(card);
    var suit = this.internalCardSuit(card);
    var effective = this.internalEffectiveSuit(card, trump);
    if (effective === trump) {
      if (rank === "J" && suit === trump) return 300;
      if (rank === "J" && suit === this.internalLeftSuit(trump)) return 299;
      return 200 + this.internalRankPower(rank);
    }
    if (effective === ledSuit) return 100 + this.internalRankPower(rank);
    return this.internalRankPower(rank);
  },

  internalRankPower: function (rank) {
    if (rank === "A") return 6;
    if (rank === "K") return 5;
    if (rank === "Q") return 4;
    if (rank === "J") return 3;
    if (rank === "T") return 2;
    return 1;
  },

  internalEffectiveSuit: function (card, trump) {
    var rank = this.internalCardRank(card);
    var suit = this.internalCardSuit(card);
    if (trump && rank === "J" && suit === this.internalLeftSuit(trump))
      return trump;
    return suit;
  },

  internalLeftSuit: function (trump) {
    if (trump === "h") return "d";
    if (trump === "d") return "h";
    if (trump === "s") return "c";
    if (trump === "c") return "s";
    return null;
  },

  internalIsValidCalledSuit: function (state, suit) {
    if (!suit || suit === state.turnedDownSuit) return false;
    return this.internalSUITS.indexOf(suit) !== -1;
  },

  internalNextActive: function (state, afterId) {
    var idx = state.players.indexOf(afterId);
    for (var offset = 1; offset <= state.players.length; offset++) {
      var pid = state.players[(idx + offset) % state.players.length];
      if (pid !== state.sitOut) return pid;
    }
    return state.players[(idx + 1) % state.players.length];
  },

  internalActivePlayers: function (state, leaderId) {
    var leaderIndex = state.players.indexOf(leaderId);
    if (leaderIndex < 0) leaderIndex = state.dealerIndex;
    var active = [];
    for (var offset = 0; offset < state.players.length; offset++) {
      var pid = state.players[(leaderIndex + offset) % state.players.length];
      if (pid !== state.sitOut) active.push(pid);
    }
    return active;
  },

  internalPartnerOf: function (state, playerId) {
    var idx = state.players.indexOf(playerId);
    if (idx < 0) return null;
    return state.players[(idx + 2) % state.players.length];
  },

  internalMustGoAloneOnOrderUp: function (state, playerId) {
    var dealer = state.players[state.dealerIndex];
    return this.internalPartnerOf(state, dealer) === playerId;
  },

  internalTeamPlayers: function (state, team) {
    var ids = [];
    for (var i = 0; i < state.players.length; i++) {
      if (state.teams[state.players[i]] === team) ids.push(state.players[i]);
    }
    return ids;
  },

  internalTeamName: function (team) {
    return team === 0 ? "Team A" : "Team B";
  },

  internalNewDeck: function () {
    var deck = [];
    for (var s = 0; s < this.internalSUITS.length; s++) {
      for (var r = 0; r < this.internalRANKS.length; r++) {
        deck.push(this.internalRANKS[r] + this.internalSUITS[s]);
      }
    }
    return deck;
  },

  internalShuffle: function (deck, rng) {
    var out = deck.slice();
    var next = rng >>> 0;
    for (var i = out.length - 1; i > 0; i--) {
      next = this.internalNextRng(next);
      var j = next % (i + 1);
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return { deck: out, rng: next };
  },

  internalNextRng: function (rng) {
    return (Math.imul(rng >>> 0, 1664525) + 1013904223) >>> 0;
  },

  internalSortHand: function (hand, trump) {
    var self = this;
    var copy = hand ? hand.slice() : [];
    copy.sort(function (a, b) {
      var suitA = self.internalEffectiveSuit(a, trump);
      var suitB = self.internalEffectiveSuit(b, trump);
      var suitScoreA =
        suitA === trump ? 0 : self.internalSUITS.indexOf(suitA) + 1;
      var suitScoreB =
        suitB === trump ? 0 : self.internalSUITS.indexOf(suitB) + 1;
      if (suitScoreA !== suitScoreB) return suitScoreA - suitScoreB;
      return (
        self.internalCardPower(b, trump, suitA) -
        self.internalCardPower(a, trump, suitA)
      );
    });
    return copy;
  },

  internalRemoveOne: function (cards, card) {
    var out = cards.slice();
    var idx = out.indexOf(card);
    if (idx >= 0) out.splice(idx, 1);
    return out;
  },

  internalOption: function (label, action, tone) {
    return { label: label, action: action, tone: tone };
  },

  internalUnwrap: function (option) {
    if (option?.action) return option.action;
    return option;
  },

  internalCardRank: function (card) {
    return card ? card.charAt(0) : "";
  },

  internalCardSuit: function (card) {
    return card ? card.charAt(1) : "";
  },

  internalSuitName: function (suit) {
    return this.internalSUIT_NAMES[suit] || suit || "-";
  },

  internalCardName: function (card) {
    if (!card) return "-";
    return this.internalCardRank(card) + this.internalCardSuit(card);
  },

  internalClone: function (value) {
    return JSON.parse(JSON.stringify(value));
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
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.phase === "handEnd") {
      prompt = "Hand ended - next hand starts automatically.";
    } else if (state.alone && playerId === state.sitOut) {
      prompt = "Waiting while your partner plays alone.";
    } else if (state.phase === "orderUp" && state.currentPlayer) {
      prompt = "Waiting for " + state.currentPlayer + " to order up or pass.";
    } else if (state.phase === "callTrump" && state.currentPlayer) {
      prompt = "Waiting for " + state.currentPlayer + " to call trump or pass.";
    } else if (state.phase === "discard" && state.currentPlayer) {
      prompt = "Waiting for " + state.currentPlayer + " to discard for trump.";
    } else if (state.phase === "play" && state.currentPlayer) {
      prompt = "Waiting for " + state.currentPlayer + " to play a card.";
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
