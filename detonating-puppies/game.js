var TURN_TIMEOUT_MS = 90000;
var RESPONSE_TIMEOUT_MS = 12000;

var CARD_META = {
  DETONATING_PUPPY: {
    title: "Detonating Puppy",
    short: "Boom Pup",
    tone: "danger",
    effect: "Reveal it. Use Safety Squeak or you are out.",
  },
  SAFETY_SQUEAK: {
    title: "Safety Squeak",
    short: "Squeak",
    tone: "safe",
    effect: "Cancel a Detonating Puppy and hide it back in the pile.",
  },
  DOUBLE_DOG_DARE: {
    title: "Double Dog Dare",
    short: "Dare",
    tone: "hot",
    effect: "End this turn and make the next handler take two turns.",
  },
  FETCH_FAVOR: {
    title: "Fetch Favor",
    short: "Favor",
    tone: "gold",
    effect: "Choose a handler. They pick one card to give you.",
  },
  NAH: {
    title: "Nah",
    short: "Nah",
    tone: "blue",
    effect: "Cancel or uncancel the latest played card or combo.",
  },
  YARD_SHAKE: {
    title: "Yard Shake",
    short: "Shake",
    tone: "green",
    effect: "Shuffle the draw pile without looking.",
  },
  ROLL_OVER: {
    title: "Roll Over",
    short: "Roll",
    tone: "mint",
    effect: "End one owed turn without drawing.",
  },
  NOSE_THE_FUTURE: {
    title: "Nose the Future",
    short: "Nose",
    tone: "purple",
    effect: "Privately peek at the top three draw cards.",
  },
  BISCUIT_BEAGLE: {
    title: "Biscuit Beagle",
    short: "Beagle",
    tone: "pack",
    effect: "Match two to steal randomly, or three to ask by name.",
  },
  CORGI_COMET: {
    title: "Corgi Comet",
    short: "Corgi",
    tone: "pack",
    effect: "Match two to steal randomly, or three to ask by name.",
  },
  MOON_POODLE: {
    title: "Moon Poodle",
    short: "Poodle",
    tone: "pack",
    effect: "Match two to steal randomly, or three to ask by name.",
  },
  SOCK_RETRIEVER: {
    title: "Sock Retriever",
    short: "Sock",
    tone: "pack",
    effect: "Match two to steal randomly, or three to ask by name.",
  },
  WAFFLE_BULLDOG: {
    title: "Waffle Bulldog",
    short: "Waffle",
    tone: "pack",
    effect: "Match two to steal randomly, or three to ask by name.",
  },
};

var CARD_ORDER = [
  "DETONATING_PUPPY",
  "SAFETY_SQUEAK",
  "DOUBLE_DOG_DARE",
  "FETCH_FAVOR",
  "NAH",
  "YARD_SHAKE",
  "ROLL_OVER",
  "NOSE_THE_FUTURE",
  "BISCUIT_BEAGLE",
  "CORGI_COMET",
  "MOON_POODLE",
  "SOCK_RETRIEVER",
  "WAFFLE_BULLDOG",
];

var PACK_CARD_TYPES = [
  "BISCUIT_BEAGLE",
  "CORGI_COMET",
  "MOON_POODLE",
  "SOCK_RETRIEVER",
  "WAFFLE_BULLDOG",
];

function copyState(state) {
  return JSON.parse(JSON.stringify(state));
}

function cardTitle(type) {
  return CARD_META[type] ? CARD_META[type].title : type;
}

function cardShort(type) {
  return CARD_META[type] ? CARD_META[type].short : type;
}

function cardTone(type) {
  return CARD_META[type] ? CARD_META[type].tone : "plain";
}

function cardEffect(type) {
  return CARD_META[type] ? CARD_META[type].effect : "";
}

function addCards(deck, type, count, cards, bucket) {
  var i, id;
  for (i = 0; i < count; i++) {
    id = type + "_" + i;
    cards[id] = {
      id: id,
      type: type,
      title: cardTitle(type),
      short: cardShort(type),
      tone: cardTone(type),
      effect: cardEffect(type),
    };
    deck.push(id);
    if (bucket) bucket.push(id);
  }
}

function makeRngQueue(random) {
  var out = [];
  var i;
  for (i = 0; i < 1200; i++) out.push(random.integer(1, 2147483646));
  return out;
}

function nextRandomInt(state) {
  var value;
  if (state.rng && state.rng.length > 0) {
    value = state.rng[0];
    state.rng = state.rng.slice(1);
    return value;
  }
  value = ((state.actionCount || 1) * 48271 + 137) % 2147483647;
  return value <= 0 ? 1 : value;
}

function seededShuffle(ids, seed) {
  var out = ids.slice();
  var i, j, tmp;
  var s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  function next() {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  }
  for (i = out.length - 1; i > 0; i--) {
    j = Math.floor(next() * (i + 1));
    tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function option(decision, label) {
  return { decision: decision, label: label };
}

function decisionOf(action) {
  if (action && typeof action === "object" && action.decision !== undefined)
    return action.decision;
  if (action && typeof action === "object" && action.action !== undefined)
    return action.action;
  return action;
}

function isAlive(state, playerId) {
  return !!(state.alive && state.alive[playerId]);
}

function alivePlayers(state) {
  var out = [];
  var i, pid;
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    if (isAlive(state, pid)) out.push(pid);
  }
  return out;
}

function currentPlayerId(state) {
  return state.players[state.currentIndex];
}

function playerName(state, playerId) {
  return (state.playerNames && state.playerNames[playerId]) || playerId;
}

function nextAliveIndex(state, fromIndex) {
  var i, idx, len;
  len = state.players.length;
  for (i = 1; i <= len; i++) {
    idx = (fromIndex + i) % len;
    if (isAlive(state, state.players[idx])) return idx;
  }
  return fromIndex;
}

function handOf(state, playerId) {
  return (state.hands && state.hands[playerId]) || [];
}

function countType(state, playerId, type) {
  var hand = handOf(state, playerId);
  var i, n;
  n = 0;
  for (i = 0; i < hand.length; i++) {
    if (state.cards[hand[i]] && state.cards[hand[i]].type === type) n++;
  }
  return n;
}

function clearPeeks(state) {
  var pid;
  for (pid in state.peeks) state.peeks[pid] = [];
}

function recordEvent(state, text, tone) {
  var event = {
    text: text,
    tone: tone || "table",
  };
  state.lastEvent = text;
  state.eventLog = (state.eventLog || []).concat([event]).slice(-5);
  return text;
}

function firstCardOfType(state, playerId, type) {
  var hand = handOf(state, playerId);
  var i;
  for (i = 0; i < hand.length; i++) {
    if (state.cards[hand[i]] && state.cards[hand[i]].type === type)
      return hand[i];
  }
  return null;
}

function firstCardsOfType(state, playerId, type, count) {
  var hand = handOf(state, playerId);
  var ids = [];
  var i;
  for (i = 0; i < hand.length; i++) {
    if (state.cards[hand[i]] && state.cards[hand[i]].type === type)
      ids.push(hand[i]);
    if (ids.length === count) break;
  }
  return ids.length === count ? ids : null;
}

function removeCardIds(hand, ids) {
  var out = hand.slice();
  var i, idx;
  for (i = 0; i < ids.length; i++) {
    idx = out.indexOf(ids[i]);
    if (idx < 0) return null;
    out.splice(idx, 1);
  }
  return out;
}

function publicCard(state, id) {
  var card = state.cards[id];
  if (!card) return null;
  return {
    id: id,
    type: card.type,
    title: card.title,
    short: card.short,
    tone: card.tone,
    effect: card.effect,
  };
}

function publicCards(state, ids) {
  var out = [];
  var i, card;
  for (i = 0; i < ids.length; i++) {
    card = publicCard(state, ids[i]);
    if (card) out.push(card);
  }
  return out;
}

function liveTargetsWithCards(state, actorId) {
  var out = [];
  var i, pid;
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    if (pid !== actorId && isAlive(state, pid) && handOf(state, pid).length > 0)
      out.push(pid);
  }
  return out;
}

function hasAnyNah(state) {
  var i;
  for (i = 0; i < state.players.length; i++) {
    if (isAlive(state, state.players[i]) && countType(state, state.players[i], "NAH") > 0)
      return true;
  }
  return false;
}

function setGameOverIfNeeded(state) {
  var alive = alivePlayers(state);
  if (alive.length <= 1) {
    state.phase = "gameOver";
    state.winnerId = alive.length === 1 ? alive[0] : null;
    state.pending = null;
    state.pendingGive = null;
    state.drawnPuppy = null;
    recordEvent(
      state,
      state.winnerId
        ? playerName(state, state.winnerId) + " is the last handler standing."
        : "No handlers survived the puppy pile.",
      "win",
    );
    return true;
  }
  return false;
}

function advanceToNextLive(state, turnsRemaining, attackChain) {
  if (setGameOverIfNeeded(state)) return state;
  state.currentIndex = nextAliveIndex(state, state.currentIndex);
  state.turnsRemaining = turnsRemaining;
  state.attackChain = !!attackChain;
  state.phase = "play";
  state.pending = null;
  state.pendingGive = null;
  state.drawnPuppy = null;
  recordEvent(
    state,
    playerName(state, currentPlayerId(state)) +
      (attackChain ? " is under a Double Dog Dare." : " is up."),
    attackChain ? "attack" : "turn",
  );
  return state;
}

function completeOneTurn(state, message) {
  if (setGameOverIfNeeded(state)) return state;
  state.pending = null;
  state.pendingGive = null;
  state.drawnPuppy = null;
  if (state.turnsRemaining > 1) {
    state.turnsRemaining -= 1;
    state.phase = "play";
    recordEvent(
      state,
      message +
        " " +
        playerName(state, currentPlayerId(state)) +
        " still owes " +
        state.turnsRemaining +
        " turn" +
        (state.turnsRemaining === 1 ? "." : "s."),
      "turn",
    );
    return state;
  }
  state.turnsRemaining = 1;
  state.attackChain = false;
  recordEvent(state, message, "turn");
  return advanceToNextLive(state, 1, false);
}

function transferAttack(state, actorId) {
  var turns = state.attackChain ? state.turnsRemaining + 2 : 2;
  recordEvent(
    state,
    playerName(state, actorId) +
      " sent a Double Dog Dare down the table.",
    "attack",
  );
  return advanceToNextLive(state, turns, true);
}

function eliminatePlayer(state, playerId, puppyId) {
  var hand = handOf(state, playerId);
  state.buried[playerId] = hand.slice();
  if (puppyId) state.bursts[playerId] = puppyId;
  state.hands[playerId] = [];
  state.alive[playerId] = false;
  state.eliminated.push(playerId);
  state.peeks[playerId] = [];
  recordEvent(
    state,
    playerName(state, playerId) + " was chased out by a Detonating Puppy.",
    "danger",
  );
  if (setGameOverIfNeeded(state)) return state;
  return advanceToNextLive(state, 1, false);
}

function stealRandomCard(state, actorId, targetId) {
  var targetHand = handOf(state, targetId);
  var idx, cardId;
  if (targetHand.length === 0) return state;
  idx = nextRandomInt(state) % targetHand.length;
  cardId = targetHand[idx];
  targetHand = targetHand.slice();
  targetHand.splice(idx, 1);
  state.hands[targetId] = targetHand;
  state.hands[actorId] = handOf(state, actorId).concat([cardId]);
  recordEvent(
    state,
    playerName(state, actorId) +
      " swiped a random card from " +
      playerName(state, targetId) +
      ".",
    "steal",
  );
  return state;
}

function stealNamedCard(state, actorId, targetId, cardType) {
  var cardId = firstCardOfType(state, targetId, cardType);
  var targetHand;
  if (!cardId) {
    recordEvent(
      state,
      playerName(state, actorId) +
        " asked for " +
        cardTitle(cardType) +
        ", but " +
        playerName(state, targetId) +
        " had none.",
      "steal",
    );
    return state;
  }
  targetHand = removeCardIds(handOf(state, targetId), [cardId]);
  state.hands[targetId] = targetHand;
  state.hands[actorId] = handOf(state, actorId).concat([cardId]);
  recordEvent(
    state,
    playerName(state, actorId) +
      " fetched " +
      cardTitle(cardType) +
      " from " +
      playerName(state, targetId) +
      ".",
    "steal",
  );
  return state;
}

function finishPendingAsCanceled(state) {
  state.phase = "play";
  recordEvent(
    state,
    "The table Nah'd " +
      pendingLabel(state.pending) +
      " into the discard pile.",
    "nah",
  );
  state.pending = null;
  return state;
}

function pendingLabel(pending) {
  if (!pending) return "that move";
  if (pending.kind === "card") return cardTitle(pending.cardType);
  if (pending.kind === "pair") return "a matching pair";
  if (pending.kind === "triple") return "a matching triple";
  return "that move";
}

function executePending(state) {
  var pending = state.pending;
  var actorId, targetId, top;
  if (!pending) return state;
  if (pending.noped) return finishPendingAsCanceled(state);

  actorId = pending.actorId;
  if (!isAlive(state, actorId)) {
    state.pending = null;
    state.phase = "play";
    return state;
  }

  if (pending.kind === "card") {
    if (pending.cardType === "YARD_SHAKE") {
      state.drawPile = seededShuffle(state.drawPile, nextRandomInt(state));
      clearPeeks(state);
      state.phase = "play";
      recordEvent(
        state,
        playerName(state, actorId) + " shook the yard until nobody trusted the deck.",
        "deck",
      );
    } else if (pending.cardType === "NOSE_THE_FUTURE") {
      top = state.drawPile.slice(0, 3);
      state.peeks[actorId] = top;
      state.phase = "play";
      recordEvent(
        state,
        playerName(state, actorId) + " sniffed the next few cards.",
        "peek",
      );
    } else if (pending.cardType === "ROLL_OVER") {
      return completeOneTurn(
        state,
        playerName(state, actorId) + " rolled over and skipped the draw.",
      );
    } else if (pending.cardType === "DOUBLE_DOG_DARE") {
      return transferAttack(state, actorId);
    } else if (pending.cardType === "FETCH_FAVOR") {
      targetId = pending.targetId;
      if (isAlive(state, targetId) && handOf(state, targetId).length > 0) {
        state.phase = "give";
        state.pendingGive = {
          requesterId: actorId,
          targetId: targetId,
        };
        recordEvent(
          state,
          playerName(state, targetId) +
            " must hand a card to " +
            playerName(state, actorId) +
            ".",
          "favor",
        );
        state.pending = null;
        return state;
      }
      state.phase = "play";
      recordEvent(state, "Fetch Favor found no cards to fetch.", "favor");
    }
  } else if (pending.kind === "pair") {
    stealRandomCard(state, actorId, pending.targetId);
    state.phase = "play";
  } else if (pending.kind === "triple") {
    stealNamedCard(state, actorId, pending.targetId, pending.askType);
    state.phase = "play";
  }

  state.pending = null;
  return state;
}

function beginPending(state, pending) {
  pending.noped = false;
  pending.nahCount = 0;
  state.pending = pending;
  state.pendingGive = null;
  state.drawnPuppy = null;
  if (hasAnyNah(state)) {
    state.phase = "response";
    recordEvent(
      state,
      pendingLabel(pending) + " is on the table. Nah may answer.",
      "pending",
    );
    return state;
  }
  return executePending(state);
}

function playCard(state, actorId, action) {
  var card = state.cards[action.cardId];
  var nextHand;
  var pending;
  if (!card) return state;
  if (handOf(state, actorId).indexOf(action.cardId) < 0) return state;
  if (
    card.type === "DETONATING_PUPPY" ||
    card.type === "SAFETY_SQUEAK" ||
    card.type === "NAH"
  )
    return state;
  if (card.type === "FETCH_FAVOR") {
    if (!action.targetId || liveTargetsWithCards(state, actorId).indexOf(action.targetId) < 0)
      return state;
  }
  nextHand = removeCardIds(handOf(state, actorId), [action.cardId]);
  if (!nextHand) return state;
  state.hands[actorId] = nextHand;
  state.discard.push(action.cardId);
  pending = {
    kind: "card",
    actorId: actorId,
    cardType: card.type,
    cardIds: [action.cardId],
    targetId: action.targetId || null,
  };
  return beginPending(state, pending);
}

function playPair(state, actorId, action) {
  var ids = firstCardsOfType(state, actorId, action.cardType, 2);
  if (!ids) return state;
  if (liveTargetsWithCards(state, actorId).indexOf(action.targetId) < 0)
    return state;
  state.hands[actorId] = removeCardIds(handOf(state, actorId), ids);
  state.discard = state.discard.concat(ids);
  return beginPending(state, {
    kind: "pair",
    actorId: actorId,
    cardType: action.cardType,
    cardIds: ids,
    targetId: action.targetId,
  });
}

function playTriple(state, actorId, action) {
  var ids = firstCardsOfType(state, actorId, action.cardType, 3);
  if (!ids) return state;
  if (liveTargetsWithCards(state, actorId).indexOf(action.targetId) < 0)
    return state;
  state.hands[actorId] = removeCardIds(handOf(state, actorId), ids);
  state.discard = state.discard.concat(ids);
  return beginPending(state, {
    kind: "triple",
    actorId: actorId,
    cardType: action.cardType,
    askType: action.askType,
    cardIds: ids,
    targetId: action.targetId,
  });
}

function drawForPlayer(state, actorId) {
  var cardId, card, hand;
  if (state.drawPile.length === 0) {
    state.phase = "gameOver";
    state.winnerId = actorId;
    recordEvent(
      state,
      "The deck ran out. " + playerName(state, actorId) + " survives by default.",
      "win",
    );
    return state;
  }
  cardId = state.drawPile[0];
  state.drawPile = state.drawPile.slice(1);
  card = state.cards[cardId];
  clearPeeks(state);
  if (card.type === "DETONATING_PUPPY") {
    if (countType(state, actorId, "SAFETY_SQUEAK") > 0) {
      state.phase = "defuse";
      state.drawnPuppy = cardId;
      recordEvent(
        state,
        playerName(state, actorId) +
          " found a Detonating Puppy and can spend a Safety Squeak.",
        "danger",
      );
      return state;
    }
    return eliminatePlayer(state, actorId, cardId);
  }
  hand = handOf(state, actorId).slice();
  hand.push(cardId);
  state.hands[actorId] = hand;
  return completeOneTurn(
    state,
    playerName(state, actorId) + " drew a card.",
  );
}

function giveCard(state, actorId, action) {
  var give = state.pendingGive;
  var targetHand, requesterHand;
  if (!give || actorId !== give.targetId) return state;
  if (handOf(state, actorId).indexOf(action.cardId) < 0) return state;
  targetHand = removeCardIds(handOf(state, actorId), [action.cardId]);
  if (!targetHand) return state;
  requesterHand = handOf(state, give.requesterId).slice();
  requesterHand.push(action.cardId);
  state.hands[actorId] = targetHand;
  state.hands[give.requesterId] = requesterHand;
  state.pendingGive = null;
  state.phase = "play";
  recordEvent(
    state,
    playerName(state, actorId) +
      " gave a card to " +
      playerName(state, give.requesterId) +
      ".",
    "favor",
  );
  return state;
}

function defusePuppy(state, actorId, action) {
  var safetyId, hand, pos, pile, message;
  if (state.phase !== "defuse" || actorId !== currentPlayerId(state))
    return state;
  if (!state.drawnPuppy) return state;
  safetyId = firstCardOfType(state, actorId, "SAFETY_SQUEAK");
  if (!safetyId) return eliminatePlayer(state, actorId, state.drawnPuppy);
  hand = removeCardIds(handOf(state, actorId), [safetyId]);
  if (!hand) return state;
  pos = Number(action.position);
  if (!Number.isFinite(pos)) pos = state.drawPile.length;
  if (pos < 0) pos = 0;
  if (pos > state.drawPile.length) pos = state.drawPile.length;
  pile = state.drawPile.slice();
  pile.splice(pos, 0, state.drawnPuppy);
  state.hands[actorId] = hand;
  state.discard.push(safetyId);
  state.drawPile = pile;
  clearPeeks(state);
  message =
    playerName(state, actorId) +
    " squeaked through and hid the Puppy back in the deck.";
  return completeOneTurn(state, message);
}

function playNah(state, actorId) {
  var nahId, hand;
  if (state.phase !== "response" || !state.pending) return state;
  if (!isAlive(state, actorId)) return state;
  nahId = firstCardOfType(state, actorId, "NAH");
  if (!nahId) return state;
  hand = removeCardIds(handOf(state, actorId), [nahId]);
  state.hands[actorId] = hand;
  state.discard.push(nahId);
  state.pending.noped = !state.pending.noped;
  state.pending.nahCount = (state.pending.nahCount || 0) + 1;
  recordEvent(
    state,
    playerName(state, actorId) +
      " played Nah. The pending move is " +
      (state.pending.noped ? "blocked for now." : "back on."),
    "nah",
  );
  if (!hasAnyNah(state)) return executePending(state);
  return state;
}

function cardLabel(state, cardId) {
  var card = state.cards[cardId];
  if (!card) return cardId;
  return card.title;
}

function targetLabel(state, targetId) {
  return playerName(state, targetId) + " (" + handOf(state, targetId).length + " cards)";
}

function turnOptions(state, actorId) {
  var options = [];
  var hand = handOf(state, actorId);
  var targets = liveTargetsWithCards(state, actorId);
  var i, j, k, card, ids, type, targetId, askType;
  options.push(
    option(
      { type: "draw" },
      "Draw from the puppy pile and end this owed turn",
    ),
  );
  for (i = 0; i < hand.length; i++) {
    card = state.cards[hand[i]];
    if (!card) continue;
    if (
      card.type === "YARD_SHAKE" ||
      card.type === "ROLL_OVER" ||
      card.type === "DOUBLE_DOG_DARE" ||
      card.type === "NOSE_THE_FUTURE"
    ) {
      options.push(
        option(
          { type: "play_card", cardId: hand[i] },
          "Play " + card.title,
        ),
      );
    } else if (card.type === "FETCH_FAVOR") {
      for (j = 0; j < targets.length; j++) {
        options.push(
          option(
            { type: "play_card", cardId: hand[i], targetId: targets[j] },
            "Play Fetch Favor on " + targetLabel(state, targets[j]),
          ),
        );
      }
    }
  }
  for (i = 0; i < CARD_ORDER.length; i++) {
    type = CARD_ORDER[i];
    if (countType(state, actorId, type) >= 2) {
      ids = firstCardsOfType(state, actorId, type, 2);
      for (j = 0; j < targets.length; j++) {
        targetId = targets[j];
        options.push(
          option(
            { type: "pair", cardType: type, targetId: targetId, cardIds: ids },
            "Play pair of " +
              cardTitle(type) +
              " to steal randomly from " +
              targetLabel(state, targetId),
          ),
        );
      }
    }
    if (countType(state, actorId, type) >= 3) {
      ids = firstCardsOfType(state, actorId, type, 3);
      for (j = 0; j < targets.length; j++) {
        targetId = targets[j];
        for (k = 1; k < CARD_ORDER.length; k++) {
          askType = CARD_ORDER[k];
          options.push(
            option(
              {
                type: "triple",
                cardType: type,
                targetId: targetId,
                askType: askType,
                cardIds: ids,
              },
              "Play triple of " +
                cardTitle(type) +
                " and ask " +
                playerName(state, targetId) +
                " for " +
                cardTitle(askType),
            ),
          );
        }
      }
    }
  }
  return options;
}

function giveOptions(state, actorId) {
  var hand = handOf(state, actorId);
  var out = [];
  var i;
  for (i = 0; i < hand.length; i++) {
    out.push(
      option(
        { type: "give_card", cardId: hand[i] },
        "Give " + cardLabel(state, hand[i]),
      ),
    );
  }
  return out;
}

function defuseOptions(state) {
  var out = [];
  var i, label;
  for (i = 0; i <= state.drawPile.length; i++) {
    if (i === 0) label = "Hide the Puppy on top";
    else if (i === state.drawPile.length) label = "Hide the Puppy on the bottom";
    else label = "Hide the Puppy after " + i + " card" + (i === 1 ? "" : "s");
    out.push(option({ type: "defuse", position: i }, label));
  }
  return out;
}

function chatOpportunity(channel) {
  return {
    id: "chat:" + channel,
    kind: "chat",
    prompt:
      channel === "eliminated"
        ? "Chat with eliminated handlers."
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
}

function chatChannelsFor(state, actorId) {
  if (actorId === "__system__" || state.players.indexOf(actorId) < 0) return [];
  if (state.phase === "gameOver") return [];
  if (!isAlive(state, actorId)) return ["eliminated"];
  return ["room", "spectator"];
}

function appendChat(opportunities, channels) {
  var i;
  for (i = 0; i < channels.length; i++) opportunities.push(chatOpportunity(channels[i]));
  return opportunities;
}

function buildAgentView(state, playerId) {
  var lines = [];
  var i, pid, hand;
  lines.push("Phase: " + state.phase);
  lines.push("Current: " + playerName(state, currentPlayerId(state)));
  lines.push("Turns owed: " + state.turnsRemaining);
  lines.push("Draw pile: " + state.drawPile.length + " cards");
  lines.push("Last event: " + (state.lastEvent || "none"));
  lines.push("Players:");
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    lines.push(
      "- " +
        playerName(state, pid) +
        ": " +
        (isAlive(state, pid) ? "alive" : "eliminated") +
        (state.bursts && state.bursts[pid] ? " with a face-up Detonating Puppy" : "") +
        ", " +
        handOf(state, pid).length +
        " cards",
    );
  }
  if (playerId && state.players.indexOf(playerId) >= 0) {
    hand = publicCards(state, handOf(state, playerId));
    lines.push("Your hand:");
    for (i = 0; i < hand.length; i++) {
      lines.push("- " + hand[i].id + ": " + hand[i].title);
    }
    if (state.peeks[playerId] && state.peeks[playerId].length > 0) {
      lines.push("Your Nose the Future peek:");
      hand = publicCards(state, state.peeks[playerId]);
      for (i = 0; i < hand.length; i++) lines.push("- " + hand[i].title);
    }
  }
  if (state.pending) {
    lines.push(
      "Pending: " +
        pendingLabel(state.pending) +
        " by " +
        playerName(state, state.pending.actorId) +
        (state.pending.noped ? " [currently blocked]" : ""),
    );
  }
  return lines.join("\n");
}

function discardView(state) {
  var start = Math.max(0, state.discard.length - 6);
  return publicCards(state, state.discard.slice(start));
}

var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  setup: function (ctx) {
    var players = [];
    var playerNames = {};
    var cards = {};
    var all = [];
    var regular = [];
    var defuses = [];
    var dangers = [];
    var hands = {};
    var alive = {};
    var peeks = {};
    var buried = {};
    var bursts = {};
    var i, pid, shuffledRegular, extraDefuses, defusesBack, dangersBack, drawPile, removed, drawCandidates, trimmedCount, trimmed, firstIndex, firstEvent;

    for (i = 0; i < ctx.players.length; i++) {
      pid = ctx.players[i].id;
      players.push(pid);
      playerNames[pid] = ctx.players[i].name || pid;
      hands[pid] = [];
      alive[pid] = true;
      peeks[pid] = [];
      buried[pid] = [];
      bursts[pid] = null;
    }

    addCards(all, "DETONATING_PUPPY", 4, cards, dangers);
    addCards(all, "SAFETY_SQUEAK", 6, cards, defuses);
    addCards(all, "DOUBLE_DOG_DARE", 4, cards, regular);
    addCards(all, "FETCH_FAVOR", 4, cards, regular);
    addCards(all, "NAH", 5, cards, regular);
    addCards(all, "YARD_SHAKE", 4, cards, regular);
    addCards(all, "ROLL_OVER", 4, cards, regular);
    addCards(all, "NOSE_THE_FUTURE", 5, cards, regular);
    for (i = 0; i < PACK_CARD_TYPES.length; i++)
      addCards(all, PACK_CARD_TYPES[i], 4, cards, regular);

    shuffledRegular = ctx.random.shuffle(regular);
    for (i = 0; i < players.length; i++) {
      pid = players[i];
      hands[pid].push(defuses[i]);
      hands[pid] = hands[pid].concat(shuffledRegular.slice(i * 7, i * 7 + 7));
    }
    shuffledRegular = shuffledRegular.slice(players.length * 7);
    extraDefuses = ctx.random.shuffle(defuses.slice(players.length));
    defusesBack = extraDefuses.slice(0, players.length === 5 ? 1 : 2);
    dangersBack = ctx.random.shuffle(dangers).slice(0, players.length - 1);
    removed = extraDefuses.slice(defusesBack.length);
    for (i = 0; i < dangers.length; i++) {
      if (dangersBack.indexOf(dangers[i]) < 0) removed.push(dangers[i]);
    }
    drawCandidates = shuffledRegular.concat(defusesBack);
    if (players.length <= 3) {
      trimmed = ctx.random.shuffle(drawCandidates);
      trimmedCount = Math.floor(trimmed.length / 3);
      removed = removed.concat(trimmed.slice(0, trimmedCount));
      drawCandidates = trimmed.slice(trimmedCount);
    }
    drawPile = ctx.random.shuffle(drawCandidates.concat(dangersBack));
    firstIndex = ctx.random.integer(0, players.length - 1);
    firstEvent = playerNames[players[firstIndex]] + " gets first leash.";

    return {
      phase: "play",
      players: players,
      playerNames: playerNames,
      cards: cards,
      hands: hands,
      drawPile: drawPile,
      discard: [],
      removed: removed,
      alive: alive,
      eliminated: [],
      peeks: peeks,
      buried: buried,
      bursts: bursts,
      currentIndex: firstIndex,
      turnsRemaining: 1,
      attackChain: false,
      pending: null,
      pendingGive: null,
      drawnPuppy: null,
      winnerId: null,
      actionCount: 0,
      rng: makeRngQueue(ctx.random),
      lastEvent: firstEvent,
      eventLog: [{ text: firstEvent, tone: "turn" }],
    };
  },

  apply: function (state, actorId, action) {
    var next = copyState(state);
    var current = currentPlayerId(next);
    action = decisionOf(action);
    if (!action || !action.type) return state;
    if (next.phase === "gameOver") return state;

    if (action.type === "resolve_pending") {
      if (actorId !== "__system__" || next.phase !== "response") return state;
      next.actionCount += 1;
      return executePending(next);
    }

    if (next.players.indexOf(actorId) < 0) return state;

    if (action.type === "play_nah") {
      next.actionCount += 1;
      return playNah(next, actorId);
    }

    if (next.phase === "give") {
      if (action.type !== "give_card") return state;
      next.actionCount += 1;
      return giveCard(next, actorId, action);
    }

    if (next.phase === "defuse") {
      if (action.type !== "defuse") return state;
      next.actionCount += 1;
      return defusePuppy(next, actorId, action);
    }

    if (next.phase !== "play") return state;
    if (actorId !== current || !isAlive(next, actorId)) return state;

    if (action.type === "draw") {
      next.actionCount += 1;
      return drawForPlayer(next, actorId);
    }
    if (action.type === "play_card") {
      next.actionCount += 1;
      return playCard(next, actorId, action);
    }
    if (action.type === "pair") {
      next.actionCount += 1;
      return playPair(next, actorId, action);
    }
    if (action.type === "triple") {
      next.actionCount += 1;
      return playTriple(next, actorId, action);
    }
    return state;
  },

  project: function (state, playerId) {
    var isPlayer = playerId !== null && state.players.indexOf(playerId) >= 0;
    var view = {
      phase: state.phase,
      players: state.players.slice(),
      playerNames: state.playerNames,
      alive: state.alive,
      eliminated: state.eliminated.slice(),
      bursts: {},
      currentPlayerId: currentPlayerId(state),
      currentPlayerName: playerName(state, currentPlayerId(state)),
      turnsRemaining: state.turnsRemaining,
      attackChain: state.attackChain,
      drawCount: state.drawPile.length,
      discardCount: state.discard.length,
      discardTop: discardView(state),
      handCounts: {},
      lastEvent: state.lastEvent,
      eventLog: state.eventLog ? state.eventLog.slice() : [],
      pending: state.pending
        ? {
            kind: state.pending.kind,
            actorId: state.pending.actorId,
            actorName: playerName(state, state.pending.actorId),
            cardType: state.pending.cardType || null,
            cardTitle: state.pending.cardType ? cardTitle(state.pending.cardType) : null,
            targetId: state.pending.targetId || null,
            targetName: state.pending.targetId ? playerName(state, state.pending.targetId) : null,
            noped: !!state.pending.noped,
            nahCount: state.pending.nahCount || 0,
          }
        : null,
      pendingGive: state.pendingGive
        ? {
            requesterId: state.pendingGive.requesterId,
            requesterName: playerName(state, state.pendingGive.requesterId),
            targetId: state.pendingGive.targetId,
            targetName: playerName(state, state.pendingGive.targetId),
          }
        : null,
      myHand: [],
      myPeek: [],
      spectatorHands: null,
    };
    var i, pid;
    for (i = 0; i < state.players.length; i++) {
      pid = state.players[i];
      view.handCounts[pid] = handOf(state, pid).length;
      if (state.bursts && state.bursts[pid])
        view.bursts[pid] = publicCard(state, state.bursts[pid]);
    }
    if (isPlayer) {
      view.myHand = publicCards(state, handOf(state, playerId));
      view.myPeek = publicCards(state, state.peeks[playerId] || []);
    } else if (playerId === null) {
      view.spectatorHands = {};
      for (i = 0; i < state.players.length; i++) {
        pid = state.players[i];
        view.spectatorHands[pid] = publicCards(state, handOf(state, pid));
      }
      view.drawPile = publicCards(state, state.drawPile);
    }
    return {
      view: view,
      agentView: buildAgentView(state, isPlayer ? playerId : null),
    };
  },

  opportunities: function (state, actorId) {
    var opportunities = [];
    var channels = chatChannelsFor(state, actorId);
    var options;
    if (state.phase === "gameOver") return [];

    if (actorId === "__system__") {
      if (state.phase !== "response") return [];
      return [
        {
          id: "response-window",
          kind: "system",
          prompt: "Resolve the Nah response window.",
          decision: {
            type: "choose",
            options: [
              option(
                { type: "resolve_pending" },
                "Resolve the pending action",
              ),
            ],
          },
          deadline: {
            id: "response-window:" + state.actionCount,
            timeoutMs: RESPONSE_TIMEOUT_MS,
            onExpire: { type: "resolve_pending" },
          },
        },
      ];
    }

    if (state.players.indexOf(actorId) < 0) return [];

    if (state.phase === "response") {
      if (isAlive(state, actorId) && countType(state, actorId, "NAH") > 0) {
        opportunities.push({
          id: "nah",
          kind: "turn",
          prompt: "Play Nah to flip whether the pending move resolves.",
          decision: {
            type: "choose",
            options: [
              option(
                { type: "play_nah" },
                "Play Nah against " + pendingLabel(state.pending),
              ),
            ],
          },
          chat: {
            channels: channels,
            defaultChannel: channels[0] || null,
            canSend: true,
            memberships: channels[0] === "eliminated" ? ["eliminated"] : [],
          },
        });
        return appendChat(opportunities, channels.slice(1));
      }
      return appendChat(opportunities, channels);
    }

    if (state.phase === "give") {
      if (state.pendingGive && actorId === state.pendingGive.targetId) {
        options = giveOptions(state, actorId);
        opportunities.push({
          id: "give-card",
          kind: "turn",
          prompt:
            "Choose a card to give " +
            playerName(state, state.pendingGive.requesterId) +
            ".",
          decision: { type: "choose", options: options },
          deadline: {
            id: "give-card:" + state.actionCount + ":" + actorId,
            timeoutMs: TURN_TIMEOUT_MS,
            onExpire: options[0] ? options[0].decision : { type: "give_card", cardId: null },
          },
          chat: {
            channels: channels,
            defaultChannel: channels[0] || null,
            canSend: true,
            memberships: channels[0] === "eliminated" ? ["eliminated"] : [],
          },
        });
        return appendChat(opportunities, channels.slice(1));
      }
      return appendChat(opportunities, channels);
    }

    if (state.phase === "defuse") {
      if (actorId === currentPlayerId(state)) {
        options = defuseOptions(state);
        opportunities.push({
          id: "defuse",
          kind: "turn",
          prompt: "Spend a Safety Squeak and hide the Detonating Puppy.",
          decision: { type: "choose", options: options },
          deadline: {
            id: "defuse:" + state.actionCount + ":" + actorId,
            timeoutMs: TURN_TIMEOUT_MS,
            onExpire: options[options.length - 1].decision,
          },
          chat: {
            channels: channels,
            defaultChannel: channels[0] || null,
            canSend: true,
            memberships: channels[0] === "eliminated" ? ["eliminated"] : [],
          },
        });
        return appendChat(opportunities, channels.slice(1));
      }
      return appendChat(opportunities, channels);
    }

    if (
      state.phase === "play" &&
      actorId === currentPlayerId(state) &&
      isAlive(state, actorId)
    ) {
      options = turnOptions(state, actorId);
      opportunities.push({
        id: "turn",
        kind: "turn",
        prompt:
          playerName(state, actorId) +
          ", play cards or draw from the puppy pile.",
        decision: { type: "choose", options: options },
        deadline: {
          id: "turn:" + state.actionCount + ":" + actorId,
          timeoutMs: TURN_TIMEOUT_MS,
          onExpire: options[0].decision,
        },
        chat: {
          channels: channels,
          defaultChannel: channels[0] || null,
          canSend: true,
          memberships: channels[0] === "eliminated" ? ["eliminated"] : [],
        },
      });
      return appendChat(opportunities, channels.slice(1));
    }

    return appendChat(opportunities, channels);
  },

  validate: function () {
    return { ok: true };
  },

  outcome: function (state) {
    if (state.phase !== "gameOver") return null;
    if (state.winnerId) {
      return {
        type: "winners",
        playerIds: [state.winnerId],
        summary: playerName(state, state.winnerId) + " is the last handler standing.",
      };
    }
    return { type: "draw", playerIds: [], summary: "No handlers survived." };
  },

  invariants: function (state) {
    var seen = {};
    var failures = [];
    var total = 0;
    var i, pid, id;
    function add(cardId) {
      if (!cardId) return;
      if (seen[cardId]) failures.push("duplicate card location: " + cardId);
      seen[cardId] = true;
      total += 1;
    }
    for (i = 0; i < state.drawPile.length; i++) add(state.drawPile[i]);
    for (i = 0; i < state.discard.length; i++) add(state.discard[i]);
    for (i = 0; i < state.removed.length; i++) add(state.removed[i]);
    for (i = 0; i < state.players.length; i++) {
      pid = state.players[i];
      for (id = 0; id < handOf(state, pid).length; id++)
        add(handOf(state, pid)[id]);
      if (state.buried && state.buried[pid]) {
        for (id = 0; id < state.buried[pid].length; id++)
          add(state.buried[pid][id]);
      }
      if (state.bursts && state.bursts[pid]) add(state.bursts[pid]);
    }
    if (state.drawnPuppy) add(state.drawnPuppy);
    if (total !== 56) failures.push("card conservation expected 56, got " + total);
    if (state.phase !== "gameOver" && alivePlayers(state).length < 1)
      failures.push("ongoing game has no live players");
    return failures;
  },
};

export default GameLogic;
