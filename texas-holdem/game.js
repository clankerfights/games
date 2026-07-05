// === Seeded PRNG (platform standard) ===

var internalSeededRandom = function (seed) {
  var s = (seed + 0x6d2b79f5) | 0;
  var t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
var internalAdvanceSeed = function (seed) {
  return (seed + 0x6d2b79f5) | 0;
};
var internalShuffle = function (arr, seed) {
  var result = arr.slice();
  var s = seed | 0;
  for (var i = result.length - 1; i > 0; i--) {
    s = (s + 0x6d2b79f5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    var r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    var j = Math.floor(r * (i + 1));
    var tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
};

// === GameLogic ===

var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  // Cards as integers 0-51. rank = c % 13 (0=2..12=A), suit = floor(c / 13) (0=s,1=h,2=d,3=c)
  internalR: ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"],
  internalS: ["s", "h", "d", "c"],
  internalCv: function (c) {
    return {
      rank: this.internalR[c % 13],
      suit: this.internalS[Math.floor(c / 13)],
    };
  },

  // --- Hand evaluation ---
  // Returns single numeric score; higher = better. Supports all 9 hand ranks.
  internalEval5: function (cards) {
    var ranks = [],
      suits = [];
    for (var i = 0; i < 5; i++) {
      ranks.push(cards[i] % 13);
      suits.push(Math.floor(cards[i] / 13));
    }
    ranks.sort(function (a, b) {
      return b - a;
    });
    var isFlush =
      suits[0] === suits[1] &&
      suits[1] === suits[2] &&
      suits[2] === suits[3] &&
      suits[3] === suits[4];
    var unique = true;
    for (var ui = 0; ui < 4; ui++) {
      if (ranks[ui] === ranks[ui + 1]) {
        unique = false;
        break;
      }
    }
    var isStraight = unique && ranks[0] - ranks[4] === 4;
    var straightHi = ranks[0];
    // Wheel: A-2-3-4-5
    if (
      !isStraight &&
      unique &&
      ranks[0] === 12 &&
      ranks[1] === 3 &&
      ranks[2] === 2 &&
      ranks[3] === 1 &&
      ranks[4] === 0
    ) {
      isStraight = true;
      straightHi = 3;
    }
    var freq = {};
    for (var fi = 0; fi < 5; fi++) freq[ranks[fi]] = (freq[ranks[fi]] || 0) + 1;
    var g = [];
    for (var r in freq) g.push({ r: parseInt(r, 10), c: freq[r] });
    g.sort(function (a, b) {
      return b.c - a.c || b.r - a.r;
    });
    var B = 371293; // 13^5 — enough room per category
    if (isStraight && isFlush) return 8 * B + straightHi;
    if (g[0].c === 4) return 7 * B + g[0].r * 13 + g[1].r;
    if (g[0].c === 3 && g[1].c === 2) return 6 * B + g[0].r * 13 + g[1].r;
    if (isFlush)
      return (
        5 * B +
        ranks[0] * 28561 +
        ranks[1] * 2197 +
        ranks[2] * 169 +
        ranks[3] * 13 +
        ranks[4]
      );
    if (isStraight) return 4 * B + straightHi;
    if (g[0].c === 3) return 3 * B + g[0].r * 169 + g[1].r * 13 + g[2].r;
    if (g[0].c === 2 && g[1].c === 2) {
      var hi = g[0].r > g[1].r ? g[0].r : g[1].r;
      var lo = g[0].r < g[1].r ? g[0].r : g[1].r;
      return 2 * B + hi * 169 + lo * 13 + g[2].r;
    }
    if (g[0].c === 2)
      return 1 * B + g[0].r * 2197 + g[1].r * 169 + g[2].r * 13 + g[3].r;
    return (
      ranks[0] * 28561 +
      ranks[1] * 2197 +
      ranks[2] * 169 +
      ranks[3] * 13 +
      ranks[4]
    );
  },

  internalBestHandInfo: function (cards) {
    var best = -1,
      bestCards = [];
    if (!cards || cards.length < 5) return { score: best, cards: bestCards };
    for (var a = 0; a < cards.length - 4; a++)
      for (var b = a + 1; b < cards.length - 3; b++)
        for (var c = b + 1; c < cards.length - 2; c++)
          for (var d = c + 1; d < cards.length - 1; d++)
            for (var e = d + 1; e < cards.length; e++) {
              var five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
              var score = this.internalEval5(five);
              if (score > best) {
                best = score;
                bestCards = five;
              }
            }
    return { score: best, cards: bestCards.slice() };
  },

  // Best 5 out of 7.
  internalBestHand: function (seven) {
    return this.internalBestHandInfo(seven).score;
  },

  internalHandName: function (score) {
    var n = [
      "High Card",
      "Pair",
      "Two Pair",
      "Three of a Kind",
      "Straight",
      "Flush",
      "Full House",
      "Four of a Kind",
      "Straight Flush",
    ];
    return n[Math.floor(score / 371293)] || "High Card";
  },

  internalPushUnique: function (arr, value) {
    if (arr.indexOf(value) === -1) arr.push(value);
  },

  internalPotContributors: function (state) {
    return state.players.filter(function (seatId) {
      return (state.handBets[seatId] || 0) > 0;
    });
  },

  internalSidePotLevels: function (state, contributors, maxLiveBet) {
    var levels = [];
    for (var i = 0; i < contributors.length; i++) {
      var bet = state.handBets[contributors[i]] || 0;
      if (bet > maxLiveBet) bet = maxLiveBet;
      if (bet > 0 && levels.indexOf(bet) === -1) levels.push(bet);
    }
    levels.sort(function (left, right) {
      return left - right;
    });
    return levels;
  },

  internalBestWinners: function (state, elig) {
    var bestS = -1,
      winners = [];
    for (var ei = 0; ei < elig.length; ei++) {
      var ac = state.holeCards[elig[ei]].concat(state.communityCards);
      var sc = this.internalBestHand(ac);
      if (sc > bestS) {
        bestS = sc;
        winners = [elig[ei]];
      } else if (sc === bestS) winners.push(elig[ei]);
    }
    return winners;
  },

  internalAwardPot: function (chips, payouts, winners, amount) {
    var share = Math.floor(amount / winners.length);
    var rem = amount - share * winners.length;
    for (var wi = 0; wi < winners.length; wi++) {
      var won = share + (wi === 0 ? rem : 0);
      chips[winners[wi]] += won;
      payouts[winners[wi]] = (payouts[winners[wi]] || 0) + won;
    }
  },

  internalShowdownHands: function (state, ih) {
    var hands = {};
    for (var hi = 0; hi < ih.length; hi++) {
      var cid = ih[hi];
      var best = this.internalBestHandInfo(
        state.holeCards[cid].concat(state.communityCards),
      );
      hands[cid] = {
        cards: state.holeCards[cid],
        bestCards: best.cards,
        handName: this.internalHandName(best.score),
      };
    }
    return hands;
  },

  internalResolveShowdown: function (state, ih, chips, totalPot) {
    var contributors = this.internalPotContributors(state);
    var maxLiveBet = 0;
    for (var mi = 0; mi < ih.length; mi++) {
      var liveBet = state.handBets[ih[mi]] || 0;
      if (liveBet > maxLiveBet) maxLiveBet = liveBet;
    }

    var returned = {},
      returnedTotal = 0;
    for (var ri = 0; ri < contributors.length; ri++) {
      var cid = contributors[ri];
      var excess = (state.handBets[cid] || 0) - maxLiveBet;
      if (excess > 0) {
        chips[cid] += excess;
        returned[cid] = excess;
        returnedTotal += excess;
      }
    }

    var levels = this.internalSidePotLevels(state, contributors, maxLiveBet);
    var prev = 0,
      mainWinners = [],
      potWinners = [],
      pots = [],
      payouts = {};
    for (var pi = 0; pi < contributors.length; pi++)
      payouts[contributors[pi]] = payouts[contributors[pi]] || 0;

    for (var li = 0; li < levels.length; li++) {
      var lv = levels[li],
        amt = 0;
      for (var ci2 = 0; ci2 < contributors.length; ci2++) {
        var bet = state.handBets[contributors[ci2]] || 0;
        if (bet > maxLiveBet) bet = maxLiveBet;
        amt += Math.min(bet, lv) - Math.min(bet, prev);
      }
      if (amt <= 0) {
        prev = lv;
        continue;
      }
      var elig = ih.filter(function (seatId) {
        return (state.handBets[seatId] || 0) >= lv;
      });
      if (elig.length === 0) {
        prev = lv;
        continue;
      }
      var winners = this.internalBestWinners(state, elig);
      this.internalAwardPot(chips, payouts, winners, amt);
      for (var wi = 0; wi < winners.length; wi++)
        this.internalPushUnique(potWinners, winners[wi]);
      pots.push({ amount: amt, winners: winners.slice() });
      if (li === 0) mainWinners = winners.slice();
      prev = lv;
    }

    return {
      winners: potWinners,
      mainWinners: mainWinners,
      hands: this.internalShowdownHands(state, ih),
      pot: totalPot - returnedTotal,
      totalPot: totalPot,
      returned: returned,
      returnedTotal: returnedTotal,
      pots: pots,
      payouts: payouts,
    };
  },

  // --- Table helpers ---
  internalNextSeat: function (players, eliminated, fromIdx) {
    var n = players.length;
    for (var i = 1; i <= n; i++) {
      var idx = (fromIdx + i) % n;
      if (eliminated.indexOf(players[idx]) === -1) return idx;
    }
    return fromIdx;
  },

  internalActive: function (state) {
    return state.players.filter(function (id) {
      return state.eliminated.indexOf(id) === -1;
    });
  },

  internalInHand: function (state) {
    return state.players.filter(function (id) {
      return (
        state.eliminated.indexOf(id) === -1 && state.folded.indexOf(id) === -1
      );
    });
  },

  internalCanBet: function (state) {
    return state.players.filter(function (id) {
      return (
        state.eliminated.indexOf(id) === -1 &&
        state.folded.indexOf(id) === -1 &&
        state.allIn.indexOf(id) === -1
      );
    });
  },

  // Current actor: scan from actSeat through needsToAct
  internalActor: function (state) {
    if (!state.needsToAct || state.needsToAct.length === 0) return null;
    var n = state.players.length;
    for (var i = 0; i < n; i++) {
      var idx = (state.actSeat + i) % n;
      var id = state.players[idx];
      if (state.needsToAct.indexOf(id) !== -1) return id;
    }
    return null;
  },

  internalPot: function (state) {
    var t = 0;
    for (var id in state.handBets) t += state.handBets[id] || 0;
    return t;
  },

  internalIsInteger: function (value) {
    return (
      typeof value === "number" &&
      isFinite(value) &&
      Math.floor(value) === value
    );
  },

  internalBettingInfo: function (state, playerId) {
    if (!playerId || state.players.indexOf(playerId) === -1) return null;
    var roundBet = state.roundBets[playerId] || 0;
    var stack = state.chips[playerId] || 0;
    var toCall = state.currentBet - roundBet;
    if (toCall < 0) toCall = 0;
    var minRaiseTo = state.currentBet + state.minRaise;
    var minRaiseCost = minRaiseTo - roundBet;
    var maxRaiseTo = roundBet + stack - 1;
    var maxRaiseCost = maxRaiseTo - roundBet;
    var canRaise =
      stack > 1 &&
      minRaiseCost > 0 &&
      minRaiseCost < stack &&
      maxRaiseTo >= minRaiseTo;
    var step = Math.max(1, state.smallBlind || 1);
    if (maxRaiseCost - minRaiseCost < step) step = 1;
    return {
      roundBet: roundBet,
      stack: stack,
      toCall: toCall,
      pot: this.internalPot(state),
      currentBet: state.currentBet,
      minRaise: state.minRaise,
      minRaiseTo: minRaiseTo,
      minRaiseCost: minRaiseCost,
      maxRaiseTo: maxRaiseTo,
      maxRaiseCost: maxRaiseCost,
      allInTotal: roundBet + stack,
      canRaise: canRaise,
      step: step,
    };
  },

  internalRaiseToForCommit: function (info, commit) {
    var stepped = commit;
    if (info.step > 1) stepped = Math.round(commit / info.step) * info.step;
    else stepped = Math.round(stepped);
    if (stepped < info.minRaiseCost) stepped = info.minRaiseCost;
    if (stepped > info.maxRaiseCost) stepped = info.maxRaiseCost;
    return info.roundBet + stepped;
  },

  internalRaiseSuggestions: function (info) {
    var out = [];
    if (!info || !info.canRaise) return out;
    var seen = {};
    var minOption = {
      key: "min",
      label: "Min",
      pct: null,
      amount: info.minRaiseTo,
    };
    out.push(minOption);
    seen[String(info.minRaiseTo)] = true;
    var percents = [10, 25, 50, 75];
    for (var i = 0; i < percents.length; i++) {
      var pct = percents[i];
      var raiseTo = this.internalRaiseToForCommit(info, (info.stack * pct) / 100);
      var key = String(raiseTo);
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        key: String(pct),
        label: pct + "%",
        pct: pct,
        amount: raiseTo,
      });
    }
    return out;
  },

  internalCommitPct: function (info, raiseTo) {
    if (!info || info.stack <= 0) return 0;
    return Math.round(((raiseTo - info.roundBet) / info.stack) * 100);
  },

  internalRaiseOptionLabel: function (info, raiseTo, prefix) {
    var commit = raiseTo - info.roundBet;
    var pct = this.internalCommitPct(info, raiseTo);
    var potRatio =
      info.pot > 0 ? (raiseTo / info.pot).toFixed(1) + "x pot" : "opens pot";
    return (
      prefix +
      " " +
      raiseTo +
      " (" +
      pct +
      "% stack, commits " +
      commit +
      ", " +
      potRatio +
      ", leaves " +
      (info.stack - commit) +
      ")"
    );
  },

  internalBuildTurnActions: function (state, playerId, surface) {
    var actions = [];
    var info = this.internalBettingInfo(state, playerId);
    if (!info) return actions;

    actions.push({ decision: { type: "fold" }, label: "fold" });
    if (info.toCall === 0) {
      actions.push({ decision: { type: "check" }, label: "check" });
    } else if (info.toCall < info.stack) {
      actions.push({
        decision: { type: "call" },
        label:
          "call " +
          info.toCall +
          " (matches current bet, leaves " +
          (info.stack - info.toCall) +
          ")",
      });
    }

    if (info.canRaise) {
      var suggestions = this.internalRaiseSuggestions(info);
      if (surface === "agent") {
        for (var si = 0; si < suggestions.length; si++) {
          actions.push({
            decision: { type: "raise", amount: suggestions[si].amount },
            label: this.internalRaiseOptionLabel(
              info,
              suggestions[si].amount,
              suggestions[si].label === "Min"
                ? "raise_to_min"
                : "raise_to_" + suggestions[si].label,
            ),
          });
        }
      }
      actions.push({
        decision: { type: "raise", amount: info.minRaiseTo },
        label:
          "raise_to custom amount (min " +
          info.minRaiseTo +
          ", max " +
          info.maxRaiseTo +
          "; all-in is separate)",
        schema: {
          fields: {
            amount: {
              kind: "number",
              integer: true,
              min: info.minRaiseTo,
              max: info.maxRaiseTo,
            },
          },
        },
        required: surface !== "agent",
      });
    }

    if (info.stack > 0) {
      actions.push({
        decision: { type: "allin" },
        label:
          "all_in " +
          info.stack +
          " (total bet " +
          info.allInTotal +
          ")",
      });
    }
    return actions;
  },

  internalCanRaiseTo: function (state, playerId, amount) {
    if (!this.internalIsInteger(amount)) return false;
    var info = this.internalBettingInfo(state, playerId);
    return (
      !!info &&
      info.canRaise &&
      amount >= info.minRaiseTo &&
      amount <= info.maxRaiseTo
    );
  },

  // --- Deal a new hand ---
  internalDeal: function (state) {
    var active = this.internalActive(state);
    if (active.length <= 1) {
      return Object.assign({}, state, {
        gameWinner: active[0] || null,
        phase: "gameover",
      });
    }
    var dlr =
      state.handNumber === 0
        ? state.players.indexOf(active[0])
        : this.internalNextSeat(
            state.players,
            state.eliminated,
            state.dealerIdx,
          );

    var deck52 = [];
    for (var i = 0; i < 52; i++) deck52.push(i);
    var deck = internalShuffle(deck52, state.nextSeed);
    var seed = internalAdvanceSeed(state.nextSeed);

    var hc = {},
      pos = 0;
    for (var ai = 0; ai < active.length; ai++) {
      hc[active[ai]] = [deck[pos], deck[pos + 1]];
      pos += 2;
    }

    // Blind positions
    var sb, bb;
    if (active.length === 2) {
      sb = dlr;
      bb = this.internalNextSeat(state.players, state.eliminated, dlr);
    } else {
      sb = this.internalNextSeat(state.players, state.eliminated, dlr);
      bb = this.internalNextSeat(state.players, state.eliminated, sb);
    }

    // Escalate blinds every 10 hands
    var newHN = state.handNumber + 1;
    var nSB = state.smallBlind,
      nBB = state.bigBlind;
    if (newHN > 1 && newHN % 10 === 0) {
      nSB = Math.min(nSB * 2, 500);
      nBB = Math.min(nBB * 2, 1000);
    }

    var chips = {};
    for (var id in state.chips) chips[id] = state.chips[id];
    var rb = {},
      hb = {},
      allIn = [];
    var sbId = state.players[sb],
      bbId = state.players[bb];
    var sbA = Math.min(nSB, chips[sbId]),
      bbA = Math.min(nBB, chips[bbId]);
    chips[sbId] -= sbA;
    rb[sbId] = sbA;
    hb[sbId] = sbA;
    chips[bbId] -= bbA;
    rb[bbId] = bbA;
    hb[bbId] = bbA;
    if (chips[sbId] === 0) allIn.push(sbId);
    if (chips[bbId] === 0 && allIn.indexOf(bbId) === -1) allIn.push(bbId);
    var curBet = sbA > bbA ? sbA : bbA;

    // First to act preflop: UTG (left of BB), or SB in heads-up
    var firstAct =
      active.length === 2
        ? sb
        : this.internalNextSeat(state.players, state.eliminated, bb);
    var nta = active.filter(function (seatId) {
      return allIn.indexOf(seatId) === -1;
    });

    var dealt = {
      players: state.players,
      chips: chips,
      dealerIdx: dlr,
      phase: "preflop",
      communityCards: [],
      holeCards: hc,
      roundBets: rb,
      handBets: hb,
      folded: [],
      allIn: allIn,
      actSeat: firstAct,
      currentBet: curBet,
      minRaise: nBB,
      needsToAct: nta,
      deck: deck,
      deckPos: pos,
      nextSeed: seed,
      handNumber: newHN,
      smallBlind: nSB,
      bigBlind: nBB,
      eliminated: state.eliminated,
      showdownResult: null,
      gameWinner: null,
      sbIdx: sb,
      bbIdx: bb,
      lastAction: {},
    };

    // All players all-in from blinds — run out the board immediately
    if (nta.length === 0) return this.internalAdvance(dealt);
    return dealt;
  },

  // --- Advance after betting round completes ---
  internalAdvance: function (state) {
    var ih = this.internalInHand(state);
    if (ih.length <= 1) return this.internalResolve(state);
    var cb = this.internalCanBet(state);
    // If ≤1 player can still bet, run out remaining community cards
    if (cb.length <= 1 && state.phase !== "river")
      return this.internalRunOut(state);
    if (cb.length <= 1 && state.phase === "river")
      return this.internalResolve(state);

    var cc = state.communityCards.slice(),
      p = state.deckPos,
      next;
    if (state.phase === "preflop") {
      next = "flop";
      cc.push(state.deck[p], state.deck[p + 1], state.deck[p + 2]);
      p += 3;
    } else if (state.phase === "flop") {
      next = "turn";
      cc.push(state.deck[p]);
      p += 1;
    } else if (state.phase === "turn") {
      next = "river";
      cc.push(state.deck[p]);
      p += 1;
    } else return this.internalResolve(state);

    // First to act post-flop: first active bettor after dealer
    var first = state.dealerIdx;
    for (var i = 1; i <= state.players.length; i++) {
      var idx = (state.dealerIdx + i) % state.players.length;
      if (cb.indexOf(state.players[idx]) !== -1) {
        first = idx;
        break;
      }
    }

    return Object.assign({}, state, {
      phase: next,
      communityCards: cc,
      deckPos: p,
      roundBets: {},
      currentBet: 0,
      minRaise: state.bigBlind,
      actSeat: first,
      needsToAct: cb.slice(),
    });
  },

  internalRunOut: function (state) {
    var cc = state.communityCards.slice(),
      p = state.deckPos;
    while (cc.length < 5) {
      cc.push(state.deck[p]);
      p++;
    }
    return this.internalResolve(
      Object.assign({}, state, { communityCards: cc, deckPos: p }),
    );
  },

  // --- Resolve hand: award pot(s), eliminate busted players ---
  internalResolve: function (state) {
    var ih = this.internalInHand(state);
    var chips = {};
    for (var id in state.chips) chips[id] = state.chips[id];
    var totalPot = this.internalPot(state);
    var result;

    if (ih.length === 1) {
      // Everyone folded
      chips[ih[0]] += totalPot;
      result = { winners: [ih[0]], byFold: true, pot: totalPot };
    } else {
      result = this.internalResolveShowdown(state, ih, chips, totalPot);
    }

    // Find newly busted players but DON'T eliminate them yet.
    // During showdown, players stay "alive" so the UI shows their cards
    // and doesn't switch them to spectator mode. Eliminations apply
    // when 'continue' fires (after the animation plays out).
    var newlyBusted = [];
    for (var bi = 0; bi < state.players.length; bi++) {
      var pid = state.players[bi];
      if (state.eliminated.indexOf(pid) === -1 && chips[pid] <= 0)
        newlyBusted.push(pid);
    }

    // Check game-over using pending eliminations
    var pendingElim = state.eliminated.concat(newlyBusted);
    var survivors = state.players.filter(function (seatId) {
      return pendingElim.indexOf(seatId) === -1;
    });
    var gw = survivors.length <= 1 ? survivors[0] || null : null;

    return Object.assign({}, state, {
      phase: "showdown",
      chips: chips,
      eliminated: state.eliminated /* unchanged during showdown */,
      internalPendingEliminations: newlyBusted,
      showdownResult: result,
      gameWinner: null,
      internalPendingWinner: gw,
      needsToAct: [],
      roundBets: {},
    });
  },

  // ===== Required Functions =====

  setup: function (ctx) {
    var ids = ctx.players.map(function (p) {
      return p.id;
    });
    var startChips = ctx.config?.startingChips || 150;
    var chips = {};
    for (var i = 0; i < ids.length; i++) chips[ids[i]] = startChips;
    return this.internalDeal({
      players: ids,
      chips: chips,
      dealerIdx: 0,
      eliminated: [],
      handNumber: 0,
      smallBlind: 10,
      bigBlind: 20,
      nextSeed: Math.floor(ctx.random.next() * 2147483647),
      phase: "init",
      communityCards: [],
      holeCards: {},
      roundBets: {},
      handBets: {},
      folded: [],
      allIn: [],
      actSeat: 0,
      currentBet: 0,
      minRaise: 20,
      needsToAct: [],
      deck: [],
      deckPos: 0,
      showdownResult: null,
      gameWinner: null,
      sbIdx: 0,
      bbIdx: 0,
    });
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    // Showdown: continue to next hand — must be before __system__ guard
    // because the phase timer fires as __system__ with deadline.onExpire: {type:'continue'}
    if (state.phase === "showdown" && action.type === "continue") {
      /* Apply deferred eliminations now that the showdown animation is done */
      var elim = state.eliminated.slice();
      if (state.internalPendingEliminations) {
        for (var pe = 0; pe < state.internalPendingEliminations.length; pe++) {
          if (elim.indexOf(state.internalPendingEliminations[pe]) === -1) {
            elim.push(state.internalPendingEliminations[pe]);
          }
        }
      }
      var updated = Object.assign({}, state, {
        eliminated: elim,
        internalPendingEliminations: null,
      });

      /* Promote pending winner if exists — triggers the shell's game-over overlay */
      if (updated.internalPendingWinner) {
        return Object.assign({}, updated, {
          gameWinner: updated.internalPendingWinner,
          internalPendingWinner: null,
          phase: "gameover",
        });
      }
      if (updated.gameWinner) return updated;
      return this.internalDeal(updated);
    }

    // System actions
    if (playerId === "__system__") {
      if (action.type === "player_left") {
        var lid = action.playerId;
        var nf =
          state.folded.indexOf(lid) === -1 &&
          state.eliminated.indexOf(lid) === -1
            ? state.folded.concat([lid])
            : state.folded;
        var ne =
          state.eliminated.indexOf(lid) === -1
            ? state.eliminated.concat([lid])
            : state.eliminated;
        var nn = state.needsToAct.filter(function (id) {
          return id !== lid;
        });
        var nc = {};
        for (var id in state.chips) nc[id] = state.chips[id];
        nc[lid] = 0;
        var ns = Object.assign({}, state, {
          folded: nf,
          eliminated: ne,
          needsToAct: nn,
          chips: nc,
        });
        if (this.internalInHand(ns).length <= 1)
          return this.internalResolve(ns);
        if (nn.length === 0 && state.phase !== "showdown")
          return this.internalAdvance(ns);
        return ns;
      }
      return state;
    }

    var seat = state.players.indexOf(playerId);
    if (
      seat === -1 ||
      state.eliminated.indexOf(playerId) !== -1 ||
      this.internalActor(state) !== playerId
    )
      return state;
    var nextSeat = (seat + 1) % state.players.length;

    // Track last action per player for UI display
    var withAction = function (s, label) {
      var la = Object.assign({}, state.lastAction || {});
      la[playerId] = label;
      return Object.assign({}, s, { lastAction: la });
    };

    if (action.type === "fold") {
      var foldF = state.folded.concat([playerId]);
      var foldN = state.needsToAct.filter(function (seatId) {
        return seatId !== playerId;
      });
      var foldS = withAction(
        Object.assign({}, state, {
          folded: foldF,
          needsToAct: foldN,
          actSeat: nextSeat,
        }),
        "FOLD",
      );
      if (this.internalInHand(foldS).length <= 1)
        return this.internalResolve(foldS);
      if (foldN.length === 0) return this.internalAdvance(foldS);
      return foldS;
    }
    if (action.type === "check") {
      var checkBet = state.roundBets[playerId] || 0;
      if (state.currentBet > checkBet) return state;
      var checkN = state.needsToAct.filter(function (seatId) {
        return seatId !== playerId;
      });
      var checkS = withAction(
        Object.assign({}, state, { needsToAct: checkN, actSeat: nextSeat }),
        "CHECK",
      );
      if (checkN.length === 0) return this.internalAdvance(checkS);
      return checkS;
    }
    if (action.type === "call") {
      var callBet = state.roundBets[playerId] || 0;
      var callCost = state.currentBet - callBet;
      if (callCost <= 0 || callCost >= (state.chips[playerId] || 0))
        return state;
      var callCh = {};
      for (var callId in state.chips) callCh[callId] = state.chips[callId];
      callCh[playerId] -= callCost;
      var callRb = Object.assign({}, state.roundBets);
      callRb[playerId] = state.currentBet;
      var callHb = Object.assign({}, state.handBets);
      callHb[playerId] = (callHb[playerId] || 0) + callCost;
      var callN = state.needsToAct.filter(function (seatId) {
        return seatId !== playerId;
      });
      var callS = withAction(
        Object.assign({}, state, {
          chips: callCh,
          roundBets: callRb,
          handBets: callHb,
          needsToAct: callN,
          actSeat: nextSeat,
        }),
        "CALL",
      );
      if (callN.length === 0) return this.internalAdvance(callS);
      return callS;
    }
    if (action.type === "raise") {
      var rBet = state.roundBets[playerId] || 0;
      var raiseTo = action.amount;
      if (!this.internalCanRaiseTo(state, playerId, raiseTo)) return state;
      var rCost = raiseTo - rBet;
      var raiseBy = raiseTo - state.currentBet;
      var rCh = {};
      for (var rId in state.chips) rCh[rId] = state.chips[rId];
      rCh[playerId] -= rCost;
      var rRb = Object.assign({}, state.roundBets);
      rRb[playerId] = raiseTo;
      var rHb = Object.assign({}, state.handBets);
      rHb[playerId] = (rHb[playerId] || 0) + rCost;
      // Reopening: everyone else must act again
      var cb = this.internalCanBet(state).filter(function (seatId) {
        return seatId !== playerId;
      });
      var raiseS = withAction(
        Object.assign({}, state, {
          chips: rCh,
          roundBets: rRb,
          handBets: rHb,
          currentBet: raiseTo,
          minRaise: raiseBy > state.minRaise ? raiseBy : state.minRaise,
          needsToAct: cb,
          actSeat: nextSeat,
        }),
        "RAISE " + raiseTo,
      );
      if (cb.length === 0) return this.internalAdvance(raiseS);
      return raiseS;
    }
    if (action.type === "allin") {
      var aBet = state.roundBets[playerId] || 0;
      var allInAmt = state.chips[playerId];
      if (allInAmt <= 0) return state;
      var newTotal = aBet + allInAmt;
      var aCh = {};
      for (var aId in state.chips) aCh[aId] = state.chips[aId];
      aCh[playerId] = 0;
      var aRb = Object.assign({}, state.roundBets);
      aRb[playerId] = newTotal;
      var aHb = Object.assign({}, state.handBets);
      aHb[playerId] = (aHb[playerId] || 0) + allInAmt;
      var na = state.allIn.concat([playerId]);
      var aN = state.needsToAct.filter(function (seatId) {
        return seatId !== playerId;
      });
      var newCB = state.currentBet,
        newMR = state.minRaise;
      if (newTotal > state.currentBet) {
        var aRaiseBy = newTotal - state.currentBet;
        newCB = newTotal;
        if (aRaiseBy >= state.minRaise) {
          newMR = aRaiseBy;
          // Full raise — reopen for everyone
          aN = state.players.filter(function (seatId) {
            return (
              state.eliminated.indexOf(seatId) === -1 &&
              state.folded.indexOf(seatId) === -1 &&
              na.indexOf(seatId) === -1
            );
          });
        }
      }
      var aS = withAction(
        Object.assign({}, state, {
          chips: aCh,
          roundBets: aRb,
          handBets: aHb,
          allIn: na,
          needsToAct: aN,
          currentBet: newCB,
          minRaise: newMR,
          actSeat: nextSeat,
        }),
        "ALL IN",
      );
      if (this.internalInHand(aS).length <= 1) return this.internalResolve(aS);
      if (aN.length === 0) return this.internalAdvance(aS);
      return aS;
    }
    return state;
  },

  internalTurnProjection: function (state, playerId, context) {
    var self = this;
    var actor = this.internalActor(state);
    var surface = context && context.surface ? context.surface : "human";
    var isGamePlayer = playerId && state.players.indexOf(playerId) !== -1;
    var isGodView =
      !isGamePlayer ||
      (state.eliminated && state.eliminated.indexOf(playerId) !== -1);

    var visiblePot =
      state.phase === "showdown" &&
      state.showdownResult &&
      state.showdownResult.pot !== undefined
        ? state.showdownResult.pot
        : this.internalPot(state);

    // --- View (same filtering as old view()) ---
    var view = {
      phase: state.phase,
      communityCards: state.communityCards.map(function (c) {
        return self.internalCv(c);
      }),
      pot: visiblePot,
      currentBet: state.currentBet,
      handNumber: state.handNumber,
      blinds: { small: state.smallBlind, big: state.bigBlind },
      gameWinner: state.gameWinner,
      turn: actor,
      lastAction: (function () {
        var la = state.lastAction || {};
        if (!actor) return la;
        var filtered = {};
        for (var k in la) {
          if (k !== actor) filtered[k] = la[k];
        }
        return filtered;
      })(),
      players: state.players.map(function (id, idx) {
        return {
          id: id,
          chips: state.chips[id],
          bet: state.roundBets[id] || 0,
          totalBet: state.handBets[id] || 0,
          folded: state.folded.indexOf(id) !== -1,
          allIn: state.allIn.indexOf(id) !== -1,
          eliminated: state.eliminated.indexOf(id) !== -1,
          role:
            idx === state.dealerIdx
              ? "dealer"
              : idx === state.sbIdx
                ? "smallBlind"
                : idx === state.bbIdx
                  ? "bigBlind"
                  : null,
        };
      }),
    };

    // God view: spectators (null, or not a game player) and eliminated players see ALL hole cards
    if (isGodView && state.holeCards) {
      view.allHands = {};
      for (var gid in state.holeCards) {
        if (state.holeCards[gid]) {
          view.allHands[gid] = state.holeCards[gid].map(function (c) {
            return self.internalCv(c);
          });
        }
      }
    } else if (playerId && state.holeCards[playerId]) {
      // Active player: only show own hole cards
      view.myCards = state.holeCards[playerId].map(function (c) {
        return self.internalCv(c);
      });
    }

    // Showdown: reveal remaining players' hands
    if (state.phase === "showdown" && state.showdownResult) {
      var sr = state.showdownResult;
      view.result = {
        winners: sr.winners,
        pot: sr.pot,
        totalPot: sr.totalPot,
        returned: sr.returned,
        returnedTotal: sr.returnedTotal || 0,
        mainWinners: sr.mainWinners,
        pots: sr.pots,
        payouts: sr.payouts,
        byFold: sr.byFold || false,
      };
      if (sr.hands) {
        view.revealedHands = {};
        for (var id in sr.hands) {
          view.revealedHands[id] = {
            cards: sr.hands[id].cards.map(function (c) {
              return self.internalCv(c);
            }),
            bestCards: sr.hands[id].bestCards
              ? sr.hands[id].bestCards.map(function (c) {
                  return self.internalCv(c);
                })
              : null,
            handName: sr.hands[id].handName,
          };
        }
      }
    }

    // --- Actions ---
    var actions = [];
    if (
      !(state.phase === "gameover" || state.gameWinner) &&
      state.phase !== "showdown" &&
      actor === playerId &&
      playerId !== null
    ) {
      actions = this.internalBuildTurnActions(state, playerId, surface);
    }

    // --- Result ---
    var result = null;
    if (state.gameWinner) {
      result = { winners: [state.gameWinner], summary: "Winner takes all!" };
    }

    // --- Legacy timing projection (timeoutMs, on-expire decision, chatChannel) ---
    var timeoutMs = null;
    var defaultAction = null;
    var chatChannel = null;

    if (state.phase === "gameover" || state.gameWinner) {
      // No timers when game is over
    } else if (
      playerId &&
      state.eliminated &&
      state.eliminated.indexOf(playerId) !== -1
    ) {
      // Eliminated players go to eliminated chat channel
      chatChannel = "eliminated";
    } else if (state.phase === "showdown") {
      // Phase timer: auto-deal next hand after 30s via system action.
      // playerId === null is the platform's phase-timer call (no player has actions).
      if (playerId === null) {
        timeoutMs = 30000;
        defaultAction = { type: "continue" };
      }
    } else if (actor !== null && actor === playerId) {
      timeoutMs = 180000;
      defaultAction = { type: "fold" };
    }

    return {
      view: view,
      actions: actions,
      result: result,
      timeoutMs: timeoutMs,
      defaultAction: defaultAction,
      currentPlayerId: actor,
      chatChannel: chatChannel,
      agentView: (function () {
        var cv = self.internalCv.bind(self);
        var cc = state.communityCards.map(function (c) {
          return cv(c).rank + cv(c).suit;
        });
        var rows = [];
        var agentBet =
          playerId && state.roundBets[playerId] ? state.roundBets[playerId] : 0;
        var agentToCall = Math.max(0, state.currentBet - agentBet);
        var agentInfo = self.internalBettingInfo(state, playerId);
        rows.push(
          "Phase: " +
            state.phase +
            " | Hand: " +
            state.handNumber +
            " | Actor: " +
            (actor || "-"),
        );
        rows.push("Community: " + (cc.length > 0 ? cc.join(" ") : "(none)"));
        rows.push(
          "Pot: " +
            self.internalPot(state) +
            " | Current bet: " +
            state.currentBet +
            " | Min raise: " +
            state.minRaise,
        );
        if (view.myCards)
          rows.push(
            "Your cards: " +
              view.myCards
                .map(function (c) {
                  return c.rank + c.suit;
                })
                .join(" "),
          );
        if (view.allHands)
          rows.push("Visible hands: " + JSON.stringify(view.allHands));
        rows.push("Players:");
        for (var ap = 0; ap < view.players.length; ap++) {
          var vp = view.players[ap];
          rows.push(
            "- " +
              vp.id +
              " chips=" +
              vp.chips +
              " bet=" +
              vp.bet +
              " total=" +
              vp.totalBet +
              (vp.folded ? " folded" : "") +
              (vp.allIn ? " all-in" : "") +
              (vp.eliminated ? " eliminated" : "") +
              (vp.role ? " " + vp.role : ""),
          );
        }
        if (actor === playerId)
          rows.push(
            "Your decision: toCall=" +
              agentToCall +
              (agentInfo && agentInfo.canRaise
                ? " minRaiseTo=" +
                  agentInfo.minRaiseTo +
                  " maxRaiseTo=" +
                  agentInfo.maxRaiseTo
                : "") +
              (agentInfo
                ? " allInTotal=" + agentInfo.allInTotal
                : ""),
          );
        if (view.revealedHands)
          rows.push("Showdown: " + JSON.stringify(view.revealedHands));
        return rows.join("\n");
      })(),
    };
  },

  // === Micro-Predictions (optional platform contract) ===
  //
  // Single prediction: "Will [chipleader] win this hand?"
  // Skewed toward yes (~55-65%), but coins are fake/ephemeral/per-room.
  // Engagement from rooting interest outweighs economic purity.
  //

  // Find the chip leader among non-eliminated players.
  // Ties: first in state.players order (deterministic).
  internalChipleader: function (state) {
    var best = null;
    var bestChips = -1;
    for (var i = 0; i < state.players.length; i++) {
      var id = state.players[i];
      if (state.eliminated.indexOf(id) !== -1) continue;
      var c = state.chips[id] || 0;
      if (c > bestChips) {
        bestChips = c;
        best = id;
      }
    }
    return best;
  },

  predictions: function (state) {
    if (state.phase !== "preflop") return null;

    // Need at least 2 non-eliminated players for a meaningful prediction
    var active = state.players.filter(function (id) {
      return state.eliminated.indexOf(id) === -1;
    });
    if (active.length < 2) return null;

    var leader = this.internalChipleader(state);
    if (!leader) return null;

    return [
      {
        id: "chipleader_wins",
        question: "Will {0} win this hand?",
        targetPlayer: leader,
      },
    ];
  },

  resolve: function (state, predictionId, baselineState) {
    if (predictionId !== "chipleader_wins") return null;

    var leader = this.internalChipleader(baselineState);
    if (!leader) return null;

    // Chipleader folded — can't win
    if (state.folded.indexOf(leader) !== -1) return false;

    // Hand reached showdown — check if chipleader is in the main pot winners
    if (state.showdownResult) {
      return state.showdownResult.winners.indexOf(leader) !== -1;
    }

    // Game over and chipleader eliminated — they lost
    if (state.phase === "gameover" && state.eliminated.indexOf(leader) !== -1)
      return false;

    // Still pending
    return null;
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
    var actor = this.internalActor(state);
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.eliminated && state.eliminated.indexOf(playerId) !== -1) {
      prompt = "Waiting for the remaining players to finish the tournament.";
    } else if (state.phase === "showdown") {
      prompt = state.internalPendingWinner
        ? "Showdown ended - final results post automatically."
        : "Showdown ended - next hand starts automatically.";
    } else if (state.folded && state.folded.indexOf(playerId) !== -1) {
      prompt = "Waiting for the hand to finish after folding.";
    } else if (state.allIn && state.allIn.indexOf(playerId) !== -1) {
      prompt = "Waiting for remaining betting to finish while all-in.";
    } else if (actor) {
      prompt = "Waiting for " + actor + " to act.";
    } else if (state.phase !== "gameover") {
      prompt = "Waiting for betting to advance.";
    }
    if (!prompt) return null;
    return {
      kind: "wait",
      id: "wait",
      prompt: prompt,
      decision: { type: "none" },
    };
  },

  internalOpportunitiesFromTurn: function (state, actorId, context) {
    var playerId = actorId === "__system__" ? null : actorId;
    /** @type {Object} */
    var projection = this.internalTurnProjection(state, playerId, context) || {
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

  opportunities: function (state, actorId, context) {
    return this.internalOpportunitiesFromTurn(state, actorId, context);
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
