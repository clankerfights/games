var BOARD = [
  { type: "start", name: "City Hall Start" },
  {
    type: "property",
    name: "First Brown",
    color: "brown",
    price: 60,
    rents: [2, 10, 30, 90, 160, 250],
    houseCost: 50,
  },
  { type: "chest", name: "Borough Chest" },
  {
    type: "property",
    name: "Second Brown",
    color: "brown",
    price: 60,
    rents: [4, 20, 60, 180, 320, 450],
    houseCost: 50,
  },
  { type: "tax", name: "City Income Tax", amount: 200 },
  { type: "transit", name: "First Railroad", price: 200 },
  {
    type: "property",
    name: "First Light Blue",
    color: "lightBlue",
    price: 100,
    rents: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  { type: "chance", name: "City Beat" },
  {
    type: "property",
    name: "Second Light Blue",
    color: "lightBlue",
    price: 100,
    rents: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  {
    type: "property",
    name: "Third Light Blue",
    color: "lightBlue",
    price: 120,
    rents: [8, 40, 100, 300, 450, 600],
    houseCost: 50,
  },
  { type: "jail", name: "Detention Visit" },
  {
    type: "property",
    name: "First Pink",
    color: "pink",
    price: 140,
    rents: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  { type: "utility", name: "Electric", price: 150 },
  {
    type: "property",
    name: "Second Pink",
    color: "pink",
    price: 140,
    rents: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  {
    type: "property",
    name: "Third Pink",
    color: "pink",
    price: 160,
    rents: [12, 60, 180, 500, 700, 900],
    houseCost: 100,
  },
  { type: "transit", name: "Second Railroad", price: 200 },
  {
    type: "property",
    name: "First Orange",
    color: "orange",
    price: 180,
    rents: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  { type: "chest", name: "Borough Chest" },
  {
    type: "property",
    name: "Second Orange",
    color: "orange",
    price: 180,
    rents: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  {
    type: "property",
    name: "Third Orange",
    color: "orange",
    price: 200,
    rents: [16, 80, 220, 600, 800, 1000],
    houseCost: 100,
  },
  { type: "free", name: "Free Staten Ferry" },
  {
    type: "property",
    name: "First Red",
    color: "red",
    price: 220,
    rents: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  { type: "chance", name: "City Beat" },
  {
    type: "property",
    name: "Second Red",
    color: "red",
    price: 220,
    rents: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  {
    type: "property",
    name: "Third Red",
    color: "red",
    price: 240,
    rents: [20, 100, 300, 750, 925, 1100],
    houseCost: 150,
  },
  { type: "transit", name: "Third Railroad", price: 200 },
  {
    type: "property",
    name: "First Yellow",
    color: "yellow",
    price: 260,
    rents: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  {
    type: "property",
    name: "Second Yellow",
    color: "yellow",
    price: 260,
    rents: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  { type: "utility", name: "Water", price: 150 },
  {
    type: "property",
    name: "Third Yellow",
    color: "yellow",
    price: 280,
    rents: [24, 120, 360, 850, 1025, 1200],
    houseCost: 150,
  },
  { type: "goToJail", name: "Go To Detention" },
  {
    type: "property",
    name: "First Green",
    color: "green",
    price: 300,
    rents: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  {
    type: "property",
    name: "Second Green",
    color: "green",
    price: 300,
    rents: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  { type: "chest", name: "Borough Chest" },
  {
    type: "property",
    name: "Third Green",
    color: "green",
    price: 320,
    rents: [28, 150, 450, 1000, 1200, 1400],
    houseCost: 200,
  },
  { type: "transit", name: "Fourth Railroad", price: 200 },
  { type: "chance", name: "City Beat" },
  {
    type: "property",
    name: "First Dark Blue",
    color: "darkBlue",
    price: 350,
    rents: [35, 175, 500, 1100, 1300, 1500],
    houseCost: 200,
  },
  { type: "tax", name: "Luxury Condo Tax", amount: 100 },
  {
    type: "property",
    name: "Second Dark Blue",
    color: "darkBlue",
    price: 400,
    rents: [50, 200, 600, 1400, 1700, 2000],
    houseCost: 200,
  },
];

var COLOR_NAMES = {
  brown: "Brown",
  lightBlue: "Light Blue",
  pink: "Pink",
  orange: "Orange",
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  darkBlue: "Dark Blue",
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function nextRand(seed) {
  var s = (seed + 0x6d2b79f5) | 0;
  var t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { seed: s, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

function sameAction(a, b) {
  var ak = Object.keys(a).toSorted();
  var bk = Object.keys(b).toSorted();
  if (ak.length !== bk.length) return false;
  for (var i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i] || a[ak[i]] !== b[bk[i]]) return false;
  }
  return true;
}

var GameLogic = {
  rules: {
    visibility: "public",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  actionSchemas: {
    bid: {
      fields: {
        amount: { kind: "number", integer: true, min: 1, max: 5000 },
      },
    },
    build: {
      fields: {
        tile: { kind: "number", integer: true, min: 0, max: 39 },
      },
    },
    propose_trade: {
      fields: {
        to: { kind: "string", minLength: 1, maxLength: 80 },
        offerCash: { kind: "number", integer: true, min: 0, max: 5000 },
        requestCash: { kind: "number", integer: true, min: 0, max: 5000 },
        offerJailCards: { kind: "number", integer: true, min: 0, max: 10 },
        offerTiles: { kind: "string", maxLength: 500 },
        requestTiles: { kind: "string", maxLength: 500 },
      },
    },
    raise_cash: {
      fields: {},
    },
    pay_debt: {
      fields: {},
    },
    declare_bankruptcy: {
      fields: {},
    },
    mortgage: {
      fields: {
        tile: { kind: "number", integer: true, min: 0, max: 39 },
      },
    },
    unmortgage: {
      fields: {
        tile: { kind: "number", integer: true, min: 0, max: 39 },
      },
    },
    sell_building: {
      fields: {
        tile: { kind: "number", integer: true, min: 0, max: 39 },
      },
    },
  },

  setup: function (ctx) {
    var ids = ctx.players.map(function (p) {
      return p.id;
    });
    var cash = {},
      pos = {},
      jail = {},
      jailTurns = {},
      jailCards = {};
    for (var i = 0; i < ids.length; i++) {
      cash[ids[i]] = 1500;
      pos[ids[i]] = 0;
      jail[ids[i]] = false;
      jailTurns[ids[i]] = 0;
      jailCards[ids[i]] = 0;
    }
    return {
      phase: "roll",
      players: ids,
      currentIndex: 0,
      round: 1,
      maxRound: 35,
      seed: Math.floor(ctx.random.next() * 2147483647),
      cash: cash,
      positions: pos,
      jail: jail,
      jailTurns: jailTurns,
      jailCards: jailCards,
      properties: {},
      houses: {},
      mortgaged: {},
      eliminated: [],
      lastRoll: null,
      doublesInRow: 0,
      pendingTile: null,
      auction: null,
      tradeOffer: null,
      debt: null,
      log: ["Welcome to Rentopoly."],
      winner: null,
      gameOverSummary: null,
    };
  },

  internalActivePlayers: function (state) {
    return state.players.filter(function (id) {
      return state.eliminated.indexOf(id) === -1;
    });
  },

  internalCurrentPlayer: function (state) {
    return state.players[state.currentIndex];
  },

  internalTile: function (i) {
    return BOARD[((i % BOARD.length) + BOARD.length) % BOARD.length];
  },

  internalGroupTiles: function (color) {
    var out = [];
    for (var i = 0; i < BOARD.length; i++) {
      if (BOARD[i].type === "property" && BOARD[i].color === color) out.push(i);
    }
    return out;
  },

  internalOwnedTiles: function (state, pid) {
    var out = [];
    for (var k in state.properties) {
      if (state.properties[k] === pid) out.push(parseInt(k, 10));
    }
    return out;
  },

  internalOwnsSet: function (state, pid, color) {
    var group = this.internalGroupTiles(color);
    for (var i = 0; i < group.length; i++) {
      if (state.properties[group[i]] !== pid) return false;
    }
    return true;
  },

  internalNetWorth: function (state, pid) {
    var total = state.cash[pid] || 0;
    var owned = this.internalOwnedTiles(state, pid);
    for (var i = 0; i < owned.length; i++) {
      var tile = this.internalTile(owned[i]);
      total += state.mortgaged?.[owned[i]]
        ? Math.floor((tile.price || 0) / 2)
        : tile.price || 0;
      total += (state.houses[owned[i]] || 0) * (tile.houseCost || 0);
    }
    return total;
  },

  internalBuildingCounts: function (state) {
    var houses = 0;
    var hotels = 0;
    for (var k in state.houses) {
      var n = state.houses[k] || 0;
      if (n >= 5) hotels += 1;
      else houses += n;
    }
    return {
      houses: houses,
      hotels: hotels,
      housesAvailable: 32 - houses,
      hotelsAvailable: 12 - hotels,
    };
  },

  internalMortgageValue: function (tile) {
    return Math.floor((tile.price || 0) / 2);
  },

  internalMortgageInterest: function (tile) {
    return Math.ceil(this.internalMortgageValue(tile) * 0.1);
  },

  internalUnmortgageCost: function (tile) {
    return (
      this.internalMortgageValue(tile) + this.internalMortgageInterest(tile)
    );
  },

  internalMortgageTransferInterest: function (state, tiles) {
    var total = 0;
    for (var i = 0; i < tiles.length; i++) {
      if (state.mortgaged?.[tiles[i]])
        total += this.internalMortgageInterest(this.internalTile(tiles[i]));
    }
    return total;
  },

  internalDeclareWinner: function (state, reason) {
    var active = this.internalActivePlayers(state);
    if (active.length === 0) {
      state.phase = "gameover";
      state.winner = null;
      state.gameOverSummary = reason || "Nobody survived the city.";
      return state;
    }
    var best = active[0];
    var bestWorth = this.internalNetWorth(state, best);
    for (var i = 1; i < active.length; i++) {
      var worth = this.internalNetWorth(state, active[i]);
      if (worth > bestWorth) {
        best = active[i];
        bestWorth = worth;
      }
    }
    state.phase = "gameover";
    state.winner = best;
    state.gameOverSummary = reason || "The richest borough boss wins.";
    return state;
  },

  internalTileIndexByName: function (value) {
    var needle = String(value || "")
      .trim()
      .toLowerCase();
    if (!needle) return -1;
    for (var i = 0; i < BOARD.length; i++) {
      if (BOARD[i].name.toLowerCase() === needle) return i;
    }
    return -1;
  },

  internalParseTileList: function (value) {
    if (value === null || value === undefined || value === "") return [];
    var parts = Array.isArray(value) ? value : String(value).split(",");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var raw = String(parts[i]).trim();
      var n = /^\d+$/.test(raw)
        ? parseInt(raw, 10)
        : this.internalTileIndexByName(raw);
      if (
        !Number.isNaN(n) &&
        n >= 0 &&
        n < BOARD.length &&
        out.indexOf(n) === -1
      )
        out.push(n);
    }
    out.sort(function (a, b) {
      return a - b;
    });
    return out;
  },

  internalHasBuildingsInGroup: function (state, tileIndex) {
    var tile = this.internalTile(tileIndex);
    if (tile.type !== "property") return false;
    var group = this.internalGroupTiles(tile.color);
    for (var i = 0; i < group.length; i++) {
      if ((state.houses[group[i]] || 0) > 0) return true;
    }
    return false;
  },

  internalIsTradeValid: function (state, from, trade) {
    var to = trade.to;
    if (!to || from === to) return false;
    if (state.players.indexOf(to) === -1) return false;
    if (
      state.eliminated.indexOf(from) !== -1 ||
      state.eliminated.indexOf(to) !== -1
    )
      return false;
    var offerCash = Math.max(0, Math.floor(Number(trade.offerCash) || 0));
    var requestCash = Math.max(0, Math.floor(Number(trade.requestCash) || 0));
    var offerJailCards = Math.max(
      0,
      Math.floor(Number(trade.offerJailCards) || 0),
    );
    var offerTiles = this.internalParseTileList(trade.offerTiles);
    var requestTiles = this.internalParseTileList(trade.requestTiles);
    var fromCashAfter = (state.cash[from] || 0) - offerCash + requestCash;
    var toCashAfter = (state.cash[to] || 0) - requestCash + offerCash;
    if (
      fromCashAfter <
        this.internalMortgageTransferInterest(state, requestTiles) ||
      toCashAfter < this.internalMortgageTransferInterest(state, offerTiles)
    )
      return false;
    if ((state.jailCards[from] || 0) < offerJailCards) return false;
    if (
      offerCash === 0 &&
      requestCash === 0 &&
      offerJailCards === 0 &&
      offerTiles.length === 0 &&
      requestTiles.length === 0
    )
      return false;
    for (var i = 0; i < offerTiles.length; i++) {
      if (
        state.properties[offerTiles[i]] !== from ||
        this.internalHasBuildingsInGroup(state, offerTiles[i])
      )
        return false;
    }
    for (var r = 0; r < requestTiles.length; r++) {
      if (
        state.properties[requestTiles[r]] !== to ||
        this.internalHasBuildingsInGroup(state, requestTiles[r])
      )
        return false;
    }
    return true;
  },

  internalMakeTradeOffer: function (state, from, action) {
    var offer = {
      from: from,
      to: String(action.to || ""),
      offerCash: Math.max(0, Math.floor(Number(action.offerCash) || 0)),
      requestCash: Math.max(0, Math.floor(Number(action.requestCash) || 0)),
      offerJailCards: Math.max(
        0,
        Math.floor(Number(action.offerJailCards) || 0),
      ),
      offerTiles: this.internalParseTileList(action.offerTiles),
      requestTiles: this.internalParseTileList(action.requestTiles),
      returnPhase: state.phase,
      returnActorIndex: state.currentIndex,
    };
    return offer;
  },

  internalDescribeTrade: function (state, offer) {
    var give = [];
    var get = [];
    if (offer.offerCash > 0) give.push("$" + offer.offerCash);
    if (offer.offerJailCards > 0)
      give.push(
        offer.offerJailCards +
          " Detention card" +
          (offer.offerJailCards === 1 ? "" : "s"),
      );
    for (var i = 0; i < offer.offerTiles.length; i++)
      give.push(this.internalTile(offer.offerTiles[i]).name);
    if (offer.requestCash > 0) get.push("$" + offer.requestCash);
    for (var r = 0; r < offer.requestTiles.length; r++)
      get.push(this.internalTile(offer.requestTiles[r]).name);
    return (
      offer.from +
      " offers " +
      (give.length ? give.join(", ") : "nothing") +
      " for " +
      (get.length ? get.join(", ") : "nothing") +
      " from " +
      offer.to +
      "."
    );
  },

  internalApplyTrade: function (state, offer) {
    if (
      !this.internalIsTradeValid(state, offer.from, {
        to: offer.to,
        offerCash: offer.offerCash,
        requestCash: offer.requestCash,
        offerJailCards: offer.offerJailCards,
        offerTiles: offer.offerTiles.join(","),
        requestTiles: offer.requestTiles.join(","),
      })
    )
      return state;
    state.cash[offer.from] -= offer.offerCash;
    state.cash[offer.to] += offer.offerCash;
    state.cash[offer.to] -= offer.requestCash;
    state.cash[offer.from] += offer.requestCash;
    state.jailCards[offer.from] -= offer.offerJailCards;
    state.jailCards[offer.to] += offer.offerJailCards;
    for (var i = 0; i < offer.offerTiles.length; i++)
      state.properties[offer.offerTiles[i]] = offer.to;
    for (var r = 0; r < offer.requestTiles.length; r++)
      state.properties[offer.requestTiles[r]] = offer.from;
    var toInterest = this.internalMortgageTransferInterest(
      state,
      offer.offerTiles,
    );
    var fromInterest = this.internalMortgageTransferInterest(
      state,
      offer.requestTiles,
    );
    if (toInterest > 0) {
      state.cash[offer.to] -= toInterest;
      state.log.push(
        offer.to + " paid $" + toInterest + " mortgage interest to the Bank.",
      );
    }
    if (fromInterest > 0) {
      state.cash[offer.from] -= fromInterest;
      state.log.push(
        offer.from +
          " paid $" +
          fromInterest +
          " mortgage interest to the Bank.",
      );
    }
    state.log.push(offer.to + " accepted a trade from " + offer.from + ".");
    return state;
  },

  internalCheckGameOver: function (state) {
    var active = this.internalActivePlayers(state);
    if (active.length <= 1) {
      return this.internalDeclareWinner(
        state,
        active.length === 1
          ? "Last solvent player standing."
          : "The city claimed every wallet.",
      );
    }
    if (state.round > state.maxRound) {
      return this.internalDeclareWinner(
        state,
        "Round limit reached; net worth decides the winner.",
      );
    }
    return state;
  },

  internalLiquidationGroupKey: function (tile) {
    return tile.type === "property" ? "color:" + tile.color : "misc";
  },

  internalStepInLiquidationGroup: function (step, key) {
    return (
      this.internalLiquidationGroupKey(this.internalTile(step.tile)) === key
    );
  },

  internalApplyDebtStep: function (state, pid, step, logIt) {
    var tile = this.internalTile(step.tile);
    var value;
    if (!state.mortgaged) state.mortgaged = {};
    if (step.type === "sell_building") {
      return this.internalApplySellBuilding(
        state,
        pid,
        step.tile,
        logIt !== false,
      );
    }
    if (step.type === "mortgage") {
      if (
        !tile.price ||
        state.properties[step.tile] !== pid ||
        state.mortgaged?.[step.tile]
      )
        return false;
      if (this.internalHasBuildingsInGroup(state, step.tile)) return false;
      value = this.internalMortgageValue(tile);
      state.mortgaged[step.tile] = true;
      state.cash[pid] += value;
      if (logIt !== false)
        state.log.push(
          pid + " mortgaged " + tile.name + " for $" + value + ".",
        );
      return true;
    }
    return false;
  },

  internalDebtStepLabel: function (step) {
    if (step.label) return step.label;
    var tile = this.internalTile(step.tile);
    if (step.type === "sell_building") return "Sell building on " + tile.name;
    if (step.type === "mortgage") return "Mortgage " + tile.name;
    return step.type;
  },

  internalDebtGroupOptions: function (state, pid, key) {
    var self = this;
    var local = clone(state);
    var saleSteps = [];
    var mortgageSteps = [];
    var options = [];
    var optionKeys = {};

    function addOption(steps) {
      var count = steps.length;
      var value = 0;
      var idParts = [];
      for (var i = 0; i < steps.length; i++) {
        value += steps[i].value || 0;
        idParts.push(steps[i].type + ":" + steps[i].tile);
      }
      var optionKey = count + ":" + value + ":" + idParts.join(",");
      if (optionKeys[optionKey]) return;
      optionKeys[optionKey] = true;
      options.push({ count: count, value: value, steps: steps.slice() });
    }

    while (true) {
      var sell = this.internalSellBuildingActions(local, pid).filter(
        function (action) {
          return self.internalStepInLiquidationGroup(action, key);
        },
      );
      if (sell.length === 0) break;
      sell.sort(function (a, b) {
        return a.tile - b.tile;
      });
      var action = sell[0];
      var tile = this.internalTile(action.tile);
      var current = local.houses[action.tile] || 0;
      var step = {
        type: "sell_building",
        tile: action.tile,
        value: Math.floor((tile.houseCost || 0) / 2),
        label:
          "Sell " + (current >= 5 ? "hotel" : "house") + " on " + tile.name,
      };
      saleSteps.push(step);
      this.internalApplyDebtStep(local, pid, step, false);
    }

    var mortgages = this.internalMortgageActions(local, pid).filter(
      function (mortgageAction) {
        return self.internalStepInLiquidationGroup(mortgageAction, key);
      },
    );
    for (var m = 0; m < mortgages.length; m++) {
      var mTile = this.internalTile(mortgages[m].tile);
      mortgageSteps.push({
        type: "mortgage",
        tile: mortgages[m].tile,
        value: this.internalMortgageValue(mTile),
        label: "Mortgage " + mTile.name,
      });
    }
    mortgageSteps.sort(function (a, b) {
      if (b.value !== a.value) return b.value - a.value;
      return a.tile - b.tile;
    });

    addOption([]);
    for (var s = 1; s < saleSteps.length; s++) addOption(saleSteps.slice(0, s));
    if (saleSteps.length > 0) addOption(saleSteps);
    for (var take = 1; take <= mortgageSteps.length; take++) {
      addOption(saleSteps.concat(mortgageSteps.slice(0, take)));
    }
    return options;
  },

  internalMinimumDebtPlan: function (state, pid, amount) {
    var cash = state.cash[pid] || 0;
    var shortfall = Math.max(0, Math.floor(amount) - cash);
    var keys = [];
    var seen = {};
    var owned = this.internalOwnedTiles(state, pid);
    var states = [{ count: 0, value: 0, steps: [] }];
    var best = null;
    var maxValue = 0;
    var maxPlan = [];
    if (shortfall <= 0)
      return {
        canCover: true,
        shortfall: 0,
        raise: 0,
        cashAfter: cash - amount,
        steps: [],
      };
    for (var i = 0; i < owned.length; i++) {
      var tile = this.internalTile(owned[i]);
      if (!tile.price) continue;
      var key = this.internalLiquidationGroupKey(tile);
      if (!seen[key]) {
        seen[key] = true;
        keys.push(key);
      }
    }
    keys.sort();
    for (var k = 0; k < keys.length; k++) {
      var options = this.internalDebtGroupOptions(state, pid, keys[k]);
      var next = [];
      var nextKeys = {};
      for (var s = 0; s < states.length; s++) {
        for (var o = 0; o < options.length; o++) {
          var count = states[s].count + options[o].count;
          var value = states[s].value + options[o].value;
          var comboKey = count + ":" + value;
          if (nextKeys[comboKey]) continue;
          nextKeys[comboKey] = true;
          next.push({
            count: count,
            value: value,
            steps: states[s].steps.concat(options[o].steps),
          });
        }
      }
      states = next;
    }
    for (var p = 0; p < states.length; p++) {
      if (states[p].value > maxValue) {
        maxValue = states[p].value;
        maxPlan = states[p].steps;
      }
      if (states[p].value < shortfall) continue;
      if (
        !best ||
        states[p].count < best.count ||
        (states[p].count === best.count && states[p].value < best.value)
      ) {
        best = states[p];
      }
    }
    if (!best) {
      return {
        canCover: false,
        shortfall: shortfall,
        raise: maxValue,
        cashAfter: cash + maxValue - amount,
        steps: maxPlan,
      };
    }
    return {
      canCover: true,
      shortfall: shortfall,
      raise: best.value,
      cashAfter: cash + best.value - amount,
      steps: best.steps,
    };
  },

  internalDebtView: function (state) {
    if (!state.debt) return null;
    var plan = this.internalMinimumDebtPlan(
      state,
      state.debt.playerId,
      state.debt.amount,
    );
    var steps = [];
    for (var i = 0; i < plan.steps.length; i++) {
      steps.push({
        type: plan.steps[i].type,
        tile: plan.steps[i].tile,
        label: this.internalDebtStepLabel(plan.steps[i]),
        value: plan.steps[i].value,
      });
    }
    return {
      playerId: state.debt.playerId,
      amount: state.debt.amount,
      creditor: state.debt.creditor || null,
      note: state.debt.note || "",
      cash: state.cash[state.debt.playerId] || 0,
      shortfall: plan.shortfall,
      canCover: plan.canCover,
      raise: plan.raise,
      cashAfter: plan.cashAfter,
      plan: steps,
    };
  },

  internalBeginDebt: function (state, pid, amount, creditor, note, afterDebt) {
    var plan = this.internalMinimumDebtPlan(state, pid, amount);
    if (!plan.canCover) return false;
    state.phase = "debt";
    state.debt = {
      playerId: pid,
      amount: Math.max(0, Math.floor(amount)),
      creditor: creditor || null,
      note: note || pid + " owes $" + amount + ".",
      returnPhase: "post_roll",
      afterDebt: afterDebt || null,
    };
    state.log.push(
      pid + " needs $" + plan.shortfall + " more to stay solvent.",
    );
    return true;
  },

  internalDebtActions: function (state, pid) {
    if (!state.debt || state.debt.playerId !== pid) return [];
    if ((state.cash[pid] || 0) >= state.debt.amount)
      return [{ type: "pay_debt" }];
    var plan = this.internalMinimumDebtPlan(state, pid, state.debt.amount);
    if (plan.canCover) return [{ type: "raise_cash" }];
    return [{ type: "declare_bankruptcy" }];
  },

  internalFinishDebt: function (state) {
    var afterDebt = state.debt ? state.debt.afterDebt : null;
    state.debt = null;
    state.phase = "post_roll";
    if (afterDebt && afterDebt.type === "jail_move") {
      state.jail[afterDebt.playerId] = false;
      state.jailTurns[afterDebt.playerId] = 0;
      this.internalMove(state, afterDebt.playerId, afterDebt.steps);
      return this.internalLand(state, afterDebt.playerId, true);
    }
    return state;
  },

  internalPayDebt: function (state) {
    var debt = state.debt;
    if (!debt) return state;
    if ((state.cash[debt.playerId] || 0) < debt.amount) return state;
    state.cash[debt.playerId] -= debt.amount;
    if (
      debt.creditor &&
      state.players.indexOf(debt.creditor) !== -1 &&
      state.eliminated.indexOf(debt.creditor) === -1
    ) {
      state.cash[debt.creditor] += debt.amount;
    }
    state.log.push(debt.note || debt.playerId + " paid $" + debt.amount + ".");
    return this.internalFinishDebt(state);
  },

  internalApplyDebtPlan: function (state) {
    var debt = state.debt;
    if (!debt) return state;
    var plan = this.internalMinimumDebtPlan(state, debt.playerId, debt.amount);
    if (!plan.canCover) return state;
    for (var i = 0; i < plan.steps.length; i++)
      this.internalApplyDebtStep(state, debt.playerId, plan.steps[i], true);
    if ((state.cash[debt.playerId] || 0) >= debt.amount)
      return this.internalPayDebt(state);
    return state;
  },

  internalDeclareDebtBankruptcy: function (state) {
    var debt = state.debt;
    if (!debt) return state;
    var paid = state.cash[debt.playerId] || 0;
    if (
      debt.creditor &&
      state.players.indexOf(debt.creditor) !== -1 &&
      state.eliminated.indexOf(debt.creditor) === -1
    ) {
      state.cash[debt.creditor] += paid;
    }
    state.cash[debt.playerId] = 0;
    state.debt = null;
    return this.internalBankrupt(
      state,
      debt.playerId,
      debt.creditor,
      debt.note || debt.playerId + " could not cover $" + debt.amount + ".",
    );
  },

  internalBankrupt: function (state, pid, creditor, note) {
    if (state.eliminated.indexOf(pid) === -1) state.eliminated.push(pid);
    state.jail[pid] = false;
    state.jailTurns[pid] = 0;
    var buildingCash = 0;
    for (var hk in state.houses) {
      if (state.properties[hk] === pid && (state.houses[hk] || 0) > 0) {
        buildingCash += Math.floor(
          ((this.internalTile(parseInt(hk, 10)).houseCost || 0) *
            (state.houses[hk] || 0)) /
            2,
        );
        state.houses[hk] = 0;
      }
    }
    state.cash[pid] = (state.cash[pid] || 0) + buildingCash;
    if (
      creditor &&
      state.players.indexOf(creditor) !== -1 &&
      state.eliminated.indexOf(creditor) === -1
    ) {
      state.cash[creditor] += state.cash[pid] || 0;
    }
    state.cash[pid] = 0;
    for (var k in state.properties) {
      if (state.properties[k] === pid) {
        if (
          creditor &&
          state.players.indexOf(creditor) !== -1 &&
          state.eliminated.indexOf(creditor) === -1
        ) {
          state.properties[k] = creditor;
          if (state.mortgaged?.[k]) {
            var interest = this.internalMortgageInterest(
              this.internalTile(parseInt(k, 10)),
            );
            state.cash[creditor] = Math.max(
              0,
              (state.cash[creditor] || 0) - interest,
            );
            state.log.push(
              creditor +
                " paid $" +
                interest +
                " mortgage interest after receiving " +
                this.internalTile(parseInt(k, 10)).name +
                ".",
            );
          }
        } else {
          delete state.properties[k];
          delete state.houses[k];
          if (state.mortgaged) delete state.mortgaged[k];
        }
      }
    }
    state.log.push((note || pid + " went bankrupt.") + " " + pid + " is out.");
    return this.internalCheckGameOver(state);
  },

  internalCharge: function (state, pid, amount, creditor, note, afterDebt) {
    amount = Math.max(0, Math.floor(amount));
    if (amount <= 0 || state.eliminated.indexOf(pid) !== -1) return state;
    if (
      (state.cash[pid] || 0) < amount &&
      this.internalBeginDebt(state, pid, amount, creditor, note, afterDebt)
    )
      return state;
    if ((state.cash[pid] || 0) >= amount) {
      state.cash[pid] -= amount;
      if (creditor) state.cash[creditor] += amount;
      state.log.push(note || pid + " paid $" + amount + ".");
      return state;
    }
    var paid = state.cash[pid] || 0;
    if (creditor) state.cash[creditor] += paid;
    state.cash[pid] = 0;
    return this.internalBankrupt(
      state,
      pid,
      creditor,
      note || pid + " could not cover $" + amount + ".",
    );
  },

  internalMove: function (state, pid, steps) {
    var old = state.positions[pid] || 0;
    var next = (old + steps) % BOARD.length;
    if (old + steps >= BOARD.length) {
      state.cash[pid] += 200;
      state.log.push(pid + " passed City Hall and collected $200.");
    }
    state.positions[pid] = next;
    return next;
  },

  internalRollDice: function (state) {
    var r1 = nextRand(state.seed);
    var r2 = nextRand(r1.seed);
    state.seed = r2.seed;
    var d1 = 1 + Math.floor(r1.value * 6);
    var d2 = 1 + Math.floor(r2.value * 6);
    state.lastRoll = { d1: d1, d2: d2, total: d1 + d2, doubles: d1 === d2 };
    return state.lastRoll;
  },

  internalGoToJail: function (state, pid, message) {
    state.positions[pid] = 10;
    state.jail[pid] = true;
    state.jailTurns[pid] = 0;
    state.doublesInRow = 0;
    state.phase = "post_roll";
    state.pendingTile = null;
    state.log.push(message || pid + " went to Detention.");
    return state;
  },

  internalCountOwnedType: function (state, pid, type) {
    var count = 0;
    for (var k in state.properties) {
      if (
        state.properties[k] === pid &&
        this.internalTile(parseInt(k, 10)).type === type
      )
        count++;
    }
    return count;
  },

  internalRentFor: function (state, tileIndex, diceTotal) {
    var tile = this.internalTile(tileIndex);
    var owner = state.properties[tileIndex];
    if (!owner) return 0;
    if (state.mortgaged?.[tileIndex]) return 0;
    if (tile.type === "transit") {
      var subways = this.internalCountOwnedType(state, owner, "transit");
      return [0, 25, 50, 100, 200][subways] || 200;
    }
    if (tile.type === "utility") {
      var utilities = this.internalCountOwnedType(state, owner, "utility");
      return (utilities >= 2 ? 10 : 4) * (diceTotal || 7);
    }
    var houses = state.houses[tileIndex] || 0;
    if (houses > 0) {
      return tile.rents[houses] || tile.rents[5];
    }
    return this.internalOwnsSet(state, owner, tile.color)
      ? tile.rents[0] * 2
      : tile.rents[0];
  },

  internalDrawCard: function (state, kind, pid) {
    var cards =
      kind === "chance"
        ? [
            {
              text: "Taxi to City Hall. Collect $200.",
              moveTo: 0,
              collectStart: true,
            },
            { text: "Broadway bonus. Collect $100.", cash: 100 },
            {
              text: "Street repair assessment. Pay $40 per building.",
              repairs: 40,
            },
            { text: "Express train to Second Railroad.", moveTo: 15 },
            { text: "Go directly to Detention.", jail: true },
            { text: "Freelance invoice cleared. Collect $75.", cash: 75 },
            { text: "Parking ticket. Pay $50.", cash: -50 },
            { text: "Keep this: Get Out of Detention.", jailCard: true },
          ]
        : [
            { text: "Bodega dividend. Collect $50.", cash: 50 },
            { text: "Rent rebate. Collect $100.", cash: 100 },
            { text: "MTA delay refund. Collect $25.", cash: 25 },
            { text: "Condo fee surprise. Pay $100.", cash: -100 },
            {
              text: "Go to City Hall. Collect $200.",
              moveTo: 0,
              collectStart: true,
            },
            { text: "Community fundraiser. Pay each rival $25.", payEach: 25 },
            { text: "Keep this: Get Out of Detention.", jailCard: true },
            { text: "Go directly to Detention.", jail: true },
          ];
    var r = nextRand(state.seed);
    state.seed = r.seed;
    var card = cards[Math.floor(r.value * cards.length)];
    state.log.push(pid + " drew: " + card.text);
    if (card.jailCard) {
      state.jailCards[pid] += 1;
      return state;
    }
    if (card.jail) return this.internalGoToJail(state, pid, card.text);
    if (card.cash) {
      if (card.cash > 0) {
        state.cash[pid] += card.cash;
      } else {
        this.internalCharge(state, pid, -card.cash, null, card.text);
        if (state.phase === "debt" || state.phase === "gameover") return state;
      }
    }
    if (card.repairs) {
      var buildings = 0;
      var owned = this.internalOwnedTiles(state, pid);
      for (var i = 0; i < owned.length; i++)
        buildings += state.houses[owned[i]] || 0;
      this.internalCharge(
        state,
        pid,
        buildings * card.repairs,
        null,
        card.text,
      );
      if (state.phase === "debt" || state.phase === "gameover") return state;
    }
    if (card.payEach) {
      var active = this.internalActivePlayers(state);
      for (var p = 0; p < active.length; p++) {
        if (active[p] !== pid && state.eliminated.indexOf(pid) === -1) {
          this.internalCharge(
            state,
            pid,
            card.payEach,
            active[p],
            "Community fundraiser payment.",
          );
          if (state.phase === "debt" || state.phase === "gameover")
            return state;
        }
      }
    }
    if (card.moveTo !== undefined && state.eliminated.indexOf(pid) === -1) {
      var old = state.positions[pid];
      if (card.collectStart && card.moveTo <= old) {
        state.cash[pid] += 200;
        state.log.push(pid + " collected $200 at City Hall.");
      }
      state.positions[pid] = card.moveTo;
      return this.internalLand(state, pid, false);
    }
    return state;
  },

  internalLand: function (state, pid, fromRoll) {
    var tileIndex = state.positions[pid];
    var tile = this.internalTile(tileIndex);
    state.pendingTile = tileIndex;
    state.log.push(pid + " landed on " + tile.name + ".");
    if (
      tile.type === "property" ||
      tile.type === "transit" ||
      tile.type === "utility"
    ) {
      var owner = state.properties[tileIndex];
      if (!owner) {
        state.phase = "buy";
        return state;
      }
      if (owner !== pid && state.eliminated.indexOf(owner) === -1) {
        var rent = this.internalRentFor(
          state,
          tileIndex,
          state.lastRoll ? state.lastRoll.total : 7,
        );
        this.internalCharge(
          state,
          pid,
          rent,
          owner,
          pid +
            " paid $" +
            rent +
            " rent to " +
            owner +
            " for " +
            tile.name +
            ".",
        );
        if (state.phase === "debt") return state;
        if (state.phase === "gameover") return state;
        if (state.eliminated.indexOf(pid) !== -1 && state.phase !== "gameover")
          return this.internalAdvanceTurn(state);
      }
      state.phase = "post_roll";
      return state;
    }
    if (tile.type === "tax") {
      this.internalCharge(
        state,
        pid,
        tile.amount,
        null,
        pid + " paid $" + tile.amount + " City Tax.",
      );
      if (state.phase === "debt") return state;
      if (state.phase === "gameover") return state;
      if (state.eliminated.indexOf(pid) !== -1 && state.phase !== "gameover")
        return this.internalAdvanceTurn(state);
    } else if (tile.type === "chance" || tile.type === "chest") {
      this.internalDrawCard(state, tile.type, pid);
      if (state.phase === "debt") return state;
      if (state.phase === "gameover") return state;
      if (state.eliminated.indexOf(pid) !== -1 && state.phase !== "gameover")
        return this.internalAdvanceTurn(state);
    } else if (tile.type === "goToJail") {
      return this.internalGoToJail(
        state,
        pid,
        "The city sent " + pid + " directly to Detention.",
      );
    }
    if (state.phase !== "gameover" && state.phase !== "buy")
      state.phase = "post_roll";
    return state;
  },

  internalAdvanceTurn: function (state) {
    state.pendingTile = null;
    state.auction = null;
    state.tradeOffer = null;
    state.debt = null;
    state.doublesInRow = 0;
    var active = this.internalActivePlayers(state);
    if (active.length <= 1) return this.internalCheckGameOver(state);
    var oldIndex = state.currentIndex;
    for (var i = 1; i <= state.players.length; i++) {
      var idx = (oldIndex + i) % state.players.length;
      if (state.eliminated.indexOf(state.players[idx]) === -1) {
        state.currentIndex = idx;
        break;
      }
    }
    if (state.currentIndex <= oldIndex) state.round += 1;
    state.phase = "roll";
    state.lastRoll = null;
    return this.internalCheckGameOver(state);
  },

  internalStartAuction: function (state, tileIndex) {
    var active = this.internalActivePlayers(state).filter(function (pid) {
      return state.cash[pid] > 0;
    });
    state.phase = "auction";
    state.auction = {
      tile: tileIndex,
      active: active,
      passed: [],
      highBid: 0,
      highBidder: null,
      currentBidder: active[0] || null,
    };
    state.log.push(
      "Auction opened for " + this.internalTile(tileIndex).name + ".",
    );
    if (active.length === 0) {
      state.phase = "post_roll";
      state.auction = null;
    }
    return state;
  },

  internalNextAuctionBidder: function (state) {
    var a = state.auction;
    if (!a) return null;
    var candidates = a.active.filter(function (pid) {
      return (
        a.passed.indexOf(pid) === -1 &&
        pid !== a.highBidder &&
        state.cash[pid] >= a.highBid + 1
      );
    });
    if (candidates.length === 0) return null;
    var start = state.players.indexOf(a.currentBidder);
    for (var i = 1; i <= state.players.length; i++) {
      var pid =
        state.players[
          (start + i + state.players.length) % state.players.length
        ];
      if (candidates.indexOf(pid) !== -1) return pid;
    }
    return candidates[0];
  },

  internalSettleAuctionIfDone: function (state) {
    var a = state.auction;
    if (!a) return state;
    if (a.highBidder && state.cash[a.highBidder] < a.highBid) {
      a.highBidder = null;
      a.highBid = 0;
    }
    var next = this.internalNextAuctionBidder(state);
    if (next) {
      a.currentBidder = next;
      return state;
    }
    if (a.highBidder) {
      state.cash[a.highBidder] -= a.highBid;
      state.properties[a.tile] = a.highBidder;
      state.houses[a.tile] = state.houses[a.tile] || 0;
      if (state.mortgaged) delete state.mortgaged[a.tile];
      state.log.push(
        a.highBidder +
          " won " +
          this.internalTile(a.tile).name +
          " at auction for $" +
          a.highBid +
          ".",
      );
    } else {
      state.log.push(this.internalTile(a.tile).name + " stayed unowned.");
    }
    state.auction = null;
    state.phase = "post_roll";
    return state;
  },

  internalBuildActions: function (state, pid) {
    var out = [];
    var owned = this.internalOwnedTiles(state, pid);
    for (var i = 0; i < owned.length; i++) {
      var idx = owned[i];
      var tile = this.internalTile(idx);
      if (tile.type !== "property") continue;
      if (state.mortgaged?.[idx]) continue;
      if (!this.internalOwnsSet(state, pid, tile.color)) continue;
      var group = this.internalGroupTiles(tile.color);
      var current = state.houses[idx] || 0;
      if (current >= 5 || state.cash[pid] < tile.houseCost) continue;
      var stock = this.internalBuildingCounts(state);
      if (current < 4 && stock.housesAvailable <= 0) continue;
      if (current === 4 && stock.hotelsAvailable <= 0) continue;
      var min = 99;
      for (var g = 0; g < group.length; g++) {
        if (state.mortgaged?.[group[g]]) {
          min = -1;
          break;
        }
        var h = state.houses[group[g]] || 0;
        if (h < min) min = h;
      }
      if (current <= min) out.push({ type: "build", tile: idx });
    }
    return out;
  },

  internalMortgageActions: function (state, pid) {
    var out = [];
    var owned = this.internalOwnedTiles(state, pid);
    for (var i = 0; i < owned.length; i++) {
      var idx = owned[i];
      var tile = this.internalTile(idx);
      if (!tile.price) continue;
      if (state.mortgaged?.[idx]) continue;
      if (this.internalHasBuildingsInGroup(state, idx)) continue;
      out.push({ type: "mortgage", tile: idx });
    }
    return out;
  },

  internalUnmortgageActions: function (state, pid) {
    var out = [];
    var owned = this.internalOwnedTiles(state, pid);
    for (var i = 0; i < owned.length; i++) {
      var idx = owned[i];
      if (!state.mortgaged?.[idx]) continue;
      var tile = this.internalTile(idx);
      if ((state.cash[pid] || 0) >= this.internalUnmortgageCost(tile))
        out.push({ type: "unmortgage", tile: idx });
    }
    return out;
  },

  internalSellBuildingActions: function (state, pid) {
    var out = [];
    var owned = this.internalOwnedTiles(state, pid);
    for (var i = 0; i < owned.length; i++) {
      var idx = owned[i];
      var tile = this.internalTile(idx);
      var current = state.houses[idx] || 0;
      if (tile.type !== "property" || current <= 0) continue;
      var group = this.internalGroupTiles(tile.color);
      var max = 0;
      for (var g = 0; g < group.length; g++) {
        var h = state.houses[group[g]] || 0;
        if (h > max) max = h;
      }
      if (current === max) out.push({ type: "sell_building", tile: idx });
    }
    return out;
  },

  internalExtraFinanceActions: function (state, pid) {
    return this.internalBuildActions(state, pid).concat(
      this.internalSellBuildingActions(state, pid),
      this.internalMortgageActions(state, pid),
      this.internalUnmortgageActions(state, pid),
    );
  },

  internalActionOption: function (action) {
    var tile;
    if (!action?.type) return action;
    if (action.type === "propose_trade") {
      return {
        action: action,
        label: "propose_trade(to=<player>, cash/cards/deeds)",
        schema: this.actionSchemas.propose_trade,
        required: true,
      };
    }
    if (action.type === "bid")
      return { action: action, label: "bid($" + action.amount + ")" };
    if (action.type === "raise_cash")
      return { action: action, label: "raise_cash(minimum asset plan)" };
    if (action.type === "pay_debt")
      return { action: action, label: "pay_debt" };
    if (action.type === "declare_bankruptcy")
      return { action: action, label: "declare_bankruptcy" };
    if (action.tile !== undefined) {
      tile = this.internalTile(action.tile);
      if (action.type === "build")
        return {
          action: action,
          label: "build(" + action.tile + ":" + tile.name + ")",
        };
      if (action.type === "mortgage")
        return {
          action: action,
          label: "mortgage(" + action.tile + ":" + tile.name + ")",
        };
      if (action.type === "unmortgage")
        return {
          action: action,
          label: "unmortgage(" + action.tile + ":" + tile.name + ")",
        };
      if (action.type === "sell_building")
        return {
          action: action,
          label: "sell_building(" + action.tile + ":" + tile.name + ")",
        };
    }
    return action;
  },

  internalApplySellBuilding: function (state, pid, tileIndex, logIt) {
    var tile = this.internalTile(tileIndex);
    if (
      state.properties[tileIndex] !== pid ||
      tile.type !== "property" ||
      (state.houses[tileIndex] || 0) <= 0
    )
      return false;
    var legal = this.internalSellBuildingActions(state, pid);
    var ok = false;
    for (var i = 0; i < legal.length; i++)
      if (legal[i].tile === tileIndex) ok = true;
    if (!ok) return false;
    state.houses[tileIndex] = (state.houses[tileIndex] || 0) - 1;
    state.cash[pid] += Math.floor((tile.houseCost || 0) / 2);
    if (logIt !== false)
      state.log.push(
        pid +
          " sold a building from " +
          tile.name +
          " for $" +
          Math.floor((tile.houseCost || 0) / 2) +
          ".",
      );
    return true;
  },

  _raiseCashForDebt: function (state, pid, amount) {
    while ((state.cash[pid] || 0) < amount) {
      var sell = this.internalSellBuildingActions(state, pid);
      if (sell.length === 0) break;
      this.internalApplySellBuilding(state, pid, sell[0].tile);
    }
    while ((state.cash[pid] || 0) < amount) {
      var mortgages = this.internalMortgageActions(state, pid);
      if (mortgages.length === 0) break;
      var idx = mortgages[0].tile;
      var value = this.internalMortgageValue(this.internalTile(idx));
      state.mortgaged[idx] = true;
      state.cash[pid] += value;
      state.log.push(
        pid +
          " mortgaged " +
          this.internalTile(idx).name +
          " for $" +
          value +
          " to cover debt.",
      );
    }
    return state;
  },

  internalLegalActions: function (state, playerId) {
    if (state.phase === "gameover") return [];
    var actor = this.internalCurrentPlayer(state);
    if (state.phase === "auction")
      actor = state.auction ? state.auction.currentBidder : null;
    if (state.phase === "trade")
      actor = state.tradeOffer ? state.tradeOffer.to : null;
    if (state.phase === "debt") actor = state.debt ? state.debt.playerId : null;
    if (playerId !== actor) return [];
    if (state.eliminated.indexOf(playerId) !== -1) return [];
    if (state.phase === "trade")
      return [{ type: "accept_trade" }, { type: "reject_trade" }];
    if (state.phase === "debt")
      return this.internalDebtActions(state, playerId);
    var activeOthers = this.internalActivePlayers(state).filter(function (id) {
      return id !== playerId;
    });
    var tradeAction =
      activeOthers.length > 0
        ? {
            type: "propose_trade",
            to: activeOthers[0],
            offerCash: 1,
            requestCash: 0,
            offerJailCards: 0,
            offerTiles: "",
            requestTiles: "",
          }
        : null;
    if (state.phase === "roll") {
      if (state.jail[playerId]) {
        var jailActs = [{ type: "roll_jail" }];
        if (state.cash[playerId] >= 50) jailActs.push({ type: "pay_bail" });
        if (state.jailCards[playerId] > 0)
          jailActs.push({ type: "use_jail_card" });
        var jailOut = jailActs.concat(
          this.internalExtraFinanceActions(state, playerId),
        );
        return tradeAction ? jailOut.concat([tradeAction]) : jailOut;
      }
      var rollActs = [{ type: "roll" }].concat(
        this.internalExtraFinanceActions(state, playerId),
      );
      return tradeAction ? rollActs.concat([tradeAction]) : rollActs;
    }
    if (state.phase === "buy") {
      var tile = this.internalTile(state.pendingTile);
      var acts = [];
      if (state.cash[playerId] >= tile.price) acts.push({ type: "buy" });
      acts.push({ type: "pass" });
      return acts.concat(this.internalExtraFinanceActions(state, playerId));
    }
    if (state.phase === "auction") {
      var a = state.auction;
      if (!a || a.currentBidder !== playerId) return [];
      var out = [{ type: "pass" }];
      var increments = [1, 10, 50, 100];
      for (var i = 0; i < increments.length; i++) {
        var amount = a.highBid + increments[i];
        if (amount > a.highBid && amount <= state.cash[playerId])
          out.push({ type: "bid", amount: amount });
      }
      return out;
    }
    if (state.phase === "post_roll") {
      var actions = [];
      if (
        state.lastRoll?.doubles &&
        !state.jail[playerId] &&
        state.doublesInRow > 0
      ) {
        actions.push({ type: "roll_again" });
      } else {
        actions.push({ type: "end_turn" });
      }
      if (tradeAction) actions.push(tradeAction);
      return actions.concat(this.internalExtraFinanceActions(state, playerId));
    }
    return [];
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    var s = clone(state);
    if (!s.mortgaged) s.mortgaged = {};
    if (!action?.type) return s;
    if (playerId === "__system__") {
      if (s.phase === "auction" && s.auction)
        playerId = s.auction.currentBidder;
      else if (s.phase === "debt" && s.debt) playerId = s.debt.playerId;
      else playerId = this.internalCurrentPlayer(s);
    }
    var legal = this.internalLegalActions(s, playerId);
    var ok = false;
    for (var i = 0; i < legal.length; i++) {
      if (
        action.type === "propose_trade" &&
        legal[i].type === "propose_trade"
      ) {
        ok = true;
        break;
      }
      if (action.type === "bid" && legal[i].type === "bid") {
        ok = true;
        break;
      }
      if (
        (action.type === "raise_cash" ||
          action.type === "pay_debt" ||
          action.type === "declare_bankruptcy") &&
        legal[i].type === action.type
      ) {
        ok = true;
        break;
      }
      if (sameAction(legal[i], action)) {
        ok = true;
        break;
      }
    }
    if (!ok) return s;

    var pid = this.internalCurrentPlayer(s);
    if (action.type === "propose_trade") {
      var made = this.internalMakeTradeOffer(s, playerId, action);
      if (
        !this.internalIsTradeValid(s, playerId, {
          to: made.to,
          offerCash: made.offerCash,
          requestCash: made.requestCash,
          offerJailCards: made.offerJailCards,
          offerTiles: made.offerTiles.join(","),
          requestTiles: made.requestTiles.join(","),
        })
      )
        return s;
      s.tradeOffer = made;
      s.phase = "trade";
      s.log.push(this.internalDescribeTrade(s, made));
      return s;
    }

    if (
      action.type === "accept_trade" &&
      s.phase === "trade" &&
      s.tradeOffer &&
      s.tradeOffer.to === playerId
    ) {
      var accepted = s.tradeOffer;
      this.internalApplyTrade(s, accepted);
      s.currentIndex = accepted.returnActorIndex;
      s.phase = accepted.returnPhase;
      s.tradeOffer = null;
      return s;
    }

    if (
      action.type === "reject_trade" &&
      s.phase === "trade" &&
      s.tradeOffer &&
      s.tradeOffer.to === playerId
    ) {
      var rejected = s.tradeOffer;
      s.log.push(playerId + " rejected the trade from " + rejected.from + ".");
      s.currentIndex = rejected.returnActorIndex;
      s.phase = rejected.returnPhase;
      s.tradeOffer = null;
      return s;
    }

    if (action.type === "raise_cash" && s.phase === "debt") {
      return this.internalApplyDebtPlan(s);
    }

    if (action.type === "pay_debt" && s.phase === "debt") {
      return this.internalPayDebt(s);
    }

    if (action.type === "declare_bankruptcy" && s.phase === "debt") {
      return this.internalDeclareDebtBankruptcy(s);
    }

    if (action.type === "roll") {
      var roll = this.internalRollDice(s);
      if (roll.doubles) s.doublesInRow += 1;
      else s.doublesInRow = 0;
      s.log.push(playerId + " rolled " + roll.d1 + "+" + roll.d2 + ".");
      if (s.doublesInRow >= 3)
        return this.internalGoToJail(
          s,
          playerId,
          playerId + " rolled three doubles and went to Detention.",
        );
      this.internalMove(s, playerId, roll.total);
      return this.internalLand(s, playerId, true);
    }

    if (action.type === "roll_jail") {
      var jailRoll = this.internalRollDice(s);
      s.log.push(
        playerId +
          " tried for doubles in Detention: " +
          jailRoll.d1 +
          "+" +
          jailRoll.d2 +
          ".",
      );
      if (jailRoll.doubles) {
        s.jail[playerId] = false;
        s.jailTurns[playerId] = 0;
        s.doublesInRow = 0;
        this.internalMove(s, playerId, jailRoll.total);
        return this.internalLand(s, playerId, true);
      }
      s.jailTurns[playerId] += 1;
      if (s.jailTurns[playerId] >= 3) {
        this.internalCharge(
          s,
          playerId,
          50,
          null,
          playerId + " paid $50 after three Detention attempts.",
          { type: "jail_move", playerId: playerId, steps: jailRoll.total },
        );
        if (s.phase === "debt") return s;
        if (s.phase === "gameover") return s;
        if (s.eliminated.indexOf(playerId) !== -1)
          return this.internalAdvanceTurn(s);
        s.jail[playerId] = false;
        s.jailTurns[playerId] = 0;
        this.internalMove(s, playerId, jailRoll.total);
        return this.internalLand(s, playerId, true);
      }
      s.phase = "post_roll";
      return s;
    }

    if (action.type === "pay_bail") {
      this.internalCharge(s, playerId, 50, null, playerId + " paid $50 bail.");
      if (s.phase === "debt") return s;
      if (s.eliminated.indexOf(playerId) === -1) {
        s.jail[playerId] = false;
        s.jailTurns[playerId] = 0;
        s.phase = "roll";
      }
      return s;
    }

    if (action.type === "use_jail_card") {
      s.jailCards[playerId] -= 1;
      s.jail[playerId] = false;
      s.jailTurns[playerId] = 0;
      s.phase = "roll";
      s.log.push(playerId + " used a Get Out of Detention card.");
      return s;
    }

    if (action.type === "buy") {
      var tile = this.internalTile(s.pendingTile);
      if (s.properties[s.pendingTile] || s.cash[playerId] < tile.price)
        return s;
      s.cash[playerId] -= tile.price;
      s.properties[s.pendingTile] = playerId;
      s.houses[s.pendingTile] = s.houses[s.pendingTile] || 0;
      delete s.mortgaged[s.pendingTile];
      s.log.push(
        playerId + " bought " + tile.name + " for $" + tile.price + ".",
      );
      s.phase = "post_roll";
      return s;
    }

    if (action.type === "pass" && s.phase === "buy") {
      return this.internalStartAuction(s, s.pendingTile);
    }

    if (action.type === "pass" && s.phase === "auction") {
      if (s.auction.passed.indexOf(playerId) === -1)
        s.auction.passed.push(playerId);
      s.log.push(playerId + " passed in the auction.");
      return this.internalSettleAuctionIfDone(s);
    }

    if (action.type === "bid" && s.phase === "auction") {
      var bidAmount = Math.floor(Number(action.amount) || 0);
      if (
        !s.auction ||
        bidAmount > s.cash[playerId] ||
        bidAmount <= s.auction.highBid
      )
        return s;
      s.auction.highBid = bidAmount;
      s.auction.highBidder = playerId;
      s.log.push(
        playerId +
          " bid $" +
          bidAmount +
          " for " +
          this.internalTile(s.auction.tile).name +
          ".",
      );
      return this.internalSettleAuctionIfDone(s);
    }

    if (action.type === "build") {
      var bTile = this.internalTile(action.tile);
      if (s.mortgaged?.[action.tile]) return s;
      s.cash[playerId] -= bTile.houseCost;
      s.houses[action.tile] = (s.houses[action.tile] || 0) + 1;
      s.log.push(
        playerId + " built on " + bTile.name + " for $" + bTile.houseCost + ".",
      );
      return s;
    }

    if (action.type === "sell_building") {
      this.internalApplySellBuilding(s, playerId, action.tile);
      return s;
    }

    if (action.type === "mortgage") {
      var mTile = this.internalTile(action.tile);
      if (
        !mTile.price ||
        s.properties[action.tile] !== playerId ||
        s.mortgaged[action.tile]
      )
        return s;
      if (this.internalHasBuildingsInGroup(s, action.tile)) return s;
      var value = Math.floor(mTile.price / 2);
      s.mortgaged[action.tile] = true;
      s.cash[playerId] += value;
      s.log.push(
        playerId + " mortgaged " + mTile.name + " for $" + value + ".",
      );
      return s;
    }

    if (action.type === "unmortgage") {
      var uTile = this.internalTile(action.tile);
      if (
        !uTile.price ||
        s.properties[action.tile] !== playerId ||
        !s.mortgaged?.[action.tile]
      )
        return s;
      var cost = this.internalUnmortgageCost(uTile);
      if ((s.cash[playerId] || 0) < cost) return s;
      s.cash[playerId] -= cost;
      delete s.mortgaged[action.tile];
      s.log.push(
        playerId +
          " lifted the mortgage on " +
          uTile.name +
          " for $" +
          cost +
          ".",
      );
      return s;
    }

    if (action.type === "roll_again") {
      s.phase = "roll";
      s.pendingTile = null;
      s.log.push(playerId + " earned another roll with doubles.");
      return s;
    }

    if (action.type === "end_turn") {
      return this.internalAdvanceTurn(s);
    }

    return s;
  },

  internalTurnProjection: function (state, playerId) {
    var self = this;
    var actions = this.internalLegalActions(state, playerId);
    var actionOptions = [];
    var currentActor =
      state.phase === "auction" && state.auction
        ? state.auction.currentBidder
        : this.internalCurrentPlayer(state);
    if (state.phase === "trade" && state.tradeOffer)
      currentActor = state.tradeOffer.to;
    if (state.phase === "debt" && state.debt)
      currentActor = state.debt.playerId;
    if (state.phase === "gameover") currentActor = null;
    var players = state.players.map(function (id) {
      return {
        id: id,
        cash: state.cash[id],
        position: state.positions[id],
        inJail: state.jail[id],
        jailCards: state.jailCards[id],
        eliminated: state.eliminated.indexOf(id) !== -1,
        netWorth: self.internalNetWorth(state, id),
        owned: self.internalOwnedTiles(state, id),
      };
    });
    var tiles = BOARD.map(function (t, i) {
      return {
        index: i,
        name: t.name,
        type: t.type,
        color: t.color || null,
        price: t.price || null,
        rent: t.rents ? t.rents[0] : null,
        rents: t.rents || null,
        mortgage: t.price ? Math.floor(t.price / 2) : null,
        unmortgageCost: t.price ? self.internalUnmortgageCost(t) : null,
        houseCost: t.houseCost || null,
        owner: state.properties[i] || null,
        houses: state.houses[i] || 0,
        mortgaged: state.mortgaged?.[i] || false,
      };
    });
    var result = null;
    if (state.phase === "gameover") {
      result = state.winner
        ? {
            winners: [state.winner],
            summary: state.gameOverSummary || "Winner by net worth.",
          }
        : { winners: [], summary: state.gameOverSummary || "No winner." };
    }
    var agentRows = [
      "Round " + state.round + "/" + state.maxRound + " Phase: " + state.phase,
    ];
    for (var p = 0; p < players.length; p++) {
      agentRows.push(
        "Player " +
          (p + 1) +
          " $" +
          players[p].cash +
          " NW $" +
          players[p].netWorth +
          " at " +
          BOARD[players[p].position].name +
          (players[p].eliminated ? " OUT" : ""),
      );
    }
    if (state.pendingTile !== null && state.pendingTile !== undefined) {
      var pending = BOARD[state.pendingTile];
      agentRows.push(
        "Pending: " +
          pending.name +
          " type=" +
          pending.type +
          (pending.price ? " price=$" + pending.price : "") +
          (state.properties[state.pendingTile]
            ? " owner=" + state.properties[state.pendingTile]
            : " unowned"),
      );
    }
    agentRows.push(
      "Actor: " +
        (currentActor || "-") +
        " | Current player: " +
        (this.internalCurrentPlayer(state) || "-") +
        " | Last roll: " +
        (state.lastRoll
          ? state.lastRoll.d1 +
            "+" +
            state.lastRoll.d2 +
            "=" +
            state.lastRoll.total
          : "-"),
    );
    if (state.auction) {
      agentRows.push(
        "Auction: tile " +
          state.auction.tile +
          " " +
          BOARD[state.auction.tile].name +
          " highBid=$" +
          state.auction.highBid +
          " bidder=" +
          (state.auction.highBidder || "-") +
          " currentBidder=" +
          state.auction.currentBidder,
      );
    }
    if (state.tradeOffer) {
      agentRows.push(
        "Trade: from " +
          state.tradeOffer.from +
          " to " +
          state.tradeOffer.to +
          " offerCash=$" +
          state.tradeOffer.offerCash +
          " requestCash=$" +
          state.tradeOffer.requestCash,
      );
    }
    if (state.debt) {
      var debtPlan = this.internalMinimumDebtPlan(
        state,
        state.debt.playerId,
        state.debt.amount,
      );
      agentRows.push(
        "Debt: " +
          state.debt.playerId +
          " owes $" +
          state.debt.amount +
          " shortfall=$" +
          debtPlan.shortfall +
          " plan=" +
          (debtPlan.canCover
            ? debtPlan.steps
                .map(function (step) {
                  return step.type + "(" + step.tile + ")";
                })
                .join(",")
            : "bankruptcy"),
      );
    }
    if (playerId && state.players.indexOf(playerId) !== -1) {
      var mine = this.internalOwnedTiles(state, playerId);
      agentRows.push(
        "Your deeds: " +
          (mine.length
            ? mine
                .map(function (i) {
                  return (
                    i +
                    ":" +
                    BOARD[i].name +
                    (state.mortgaged?.[i] ? "(mortgaged)" : "")
                  );
                })
                .join(", ")
            : "none"),
      );
    }
    for (var ao = 0; ao < actions.length; ao++)
      actionOptions.push(this.internalActionOption(actions[ao]));
    return {
      view: {
        phase: state.phase,
        round: state.round,
        maxRound: state.maxRound,
        currentPlayer: this.internalCurrentPlayer(state),
        currentActor: currentActor,
        players: players,
        tiles: tiles,
        colorNames: COLOR_NAMES,
        buildingBank: this.internalBuildingCounts(state),
        lastRoll: state.lastRoll,
        doublesInRow: state.doublesInRow,
        pendingTile: state.pendingTile,
        auction: state.auction,
        tradeOffer: state.tradeOffer,
        debt: this.internalDebtView(state),
        log: state.log.slice(-8),
        winner: state.winner,
      },
      actions: actionOptions,
      result: result,
      timeoutMs: state.phase === "gameover" ? null : 60000,
      defaultAction: actions.length > 0 ? actions[0] : null,
      currentPlayerId: currentActor,
      agentView: agentRows.join("\n"),
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
    var currentActor = projection ? projection.currentPlayerId : null;
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.eliminated && state.eliminated.indexOf(playerId) !== -1) {
      prompt = "Waiting for the remaining players to finish the game.";
    } else if (state.phase === "auction" && state.auction) {
      prompt =
        "Waiting for " +
        state.auction.currentBidder +
        " to bid or pass in the auction.";
    } else if (state.phase === "trade" && state.tradeOffer) {
      prompt =
        "Waiting for " +
        state.tradeOffer.to +
        " to respond to the trade offer.";
    } else if (state.phase === "debt" && state.debt) {
      prompt = "Waiting for " + state.debt.playerId + " to resolve debt.";
    } else if (currentActor) {
      prompt = "Waiting for " + currentActor + " to act.";
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

  invariants: function (state) {
    var failures = [];
    var players = state.players || [];
    var playerSet = {};
    for (var i = 0; i < players.length; i++) {
      playerSet[players[i]] = true;
      if ((state.cash[players[i]] || 0) < 0)
        failures.push(players[i] + " has negative cash.");
      if ((state.jailCards[players[i]] || 0) < 0)
        failures.push(players[i] + " has negative Detention cards.");
    }
    for (var k in state.properties || {}) {
      var owner = state.properties[k];
      var tileIndex = parseInt(k, 10);
      var tile = this.internalTile(tileIndex);
      if (!playerSet[owner])
        failures.push("Property " + k + " has invalid owner " + owner + ".");
      if (!tile.price)
        failures.push("Non-purchasable tile " + k + " has an owner.");
      if ((state.houses[k] || 0) > 0 && tile.type !== "property")
        failures.push("Non-property tile " + k + " has buildings.");
      if ((state.houses[k] || 0) < 0 || (state.houses[k] || 0) > 5)
        failures.push("Property " + k + " has invalid building count.");
      if (state.mortgaged?.[k] && owner === undefined)
        failures.push("Tile " + k + " is mortgaged without an owner.");
    }
    var stock = this.internalBuildingCounts(state);
    if (stock.housesAvailable < 0 || stock.hotelsAvailable < 0)
      failures.push("Building bank stock went negative.");
    if (
      state.auction &&
      state.auction.highBidder &&
      (state.cash[state.auction.highBidder] || 0) < state.auction.highBid
    ) {
      failures.push("Auction high bidder is committed above cash.");
    }
    if (state.debt) {
      if (!playerSet[state.debt.playerId])
        failures.push("Debt has invalid debtor.");
      if ((state.debt.amount || 0) <= 0)
        failures.push("Debt amount must be positive.");
      if (state.phase !== "debt")
        failures.push("Debt exists outside debt phase.");
    }
    return failures;
  },

  validate: function () {
    return { ok: true };
  },
};
export default GameLogic;
