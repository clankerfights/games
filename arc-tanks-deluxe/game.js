var GameLogic = (function () {
  var WORLD_W = 1600;
  var WORLD_H = 900;
  var CELL = 8;
  var GRID_W = 200;
  var GRID_H = 113;
  var TANK_H = 26;
  var SHOTS_PER_PLAYER = 10;
  var MAX_TURNS = SHOTS_PER_PLAYER * 2;
  var TARGET_WEAPON_COUNT = 50;
  var LOADOUT_SIZE = 10;
  var DRAFT_POOL_SIZE = LOADOUT_SIZE * 2;
  var SELECT_MS = 1400;
  var TURN_MS = 120000;
  var START_MOVE_FUEL = 280;
  var MAX_TURN_MOVE = 64;
  var GRAVITY = 360;
  var TANK_DRAW_SCALE = 1.28;
  var BARREL_ROOT_Y = -22 * TANK_DRAW_SCALE;
  var BARREL_LENGTH = 46 * TANK_DRAW_SCALE;
  var TANK_HIT_W = 66;
  var TANK_HIT_H = 46;
  var PLAYER_KEYS = ["p1", "p2"];
  var MATERIALS = {
    dirt: { blocksProjectile: true, supportsTank: true, extinguishes: true },
    bouncy: { blocksProjectile: true, supportsTank: true, bouncesProjectile: true },
    glue: { blocksProjectile: true, supportsTank: true, pinsTank: true },
    concrete: { blocksProjectile: true, supportsTank: true, hard: true },
    water: { blocksProjectile: true, supportsTank: true, extinguishes: true, liquid: true },
    lava: { blocksProjectile: true, supportsTank: true, burns: true, liquid: true },
    scorch: { blocksProjectile: true, supportsTank: true, visualHazard: true },
  };
  var SOLID = {};
  var MATERIAL_KEY;
  for (MATERIAL_KEY in MATERIALS) if (MATERIALS[MATERIAL_KEY].supportsTank || MATERIALS[MATERIAL_KEY].blocksProjectile) SOLID[MATERIAL_KEY] = true;
  var PALETTE = {
    dirt: "#187b22",
    bouncy: "#33d6ff",
    glue: "#77d8ff",
    concrete: "#8a8d91",
    water: "#1788ff",
    lava: "#ff4a12",
    scorch: "#2e1d17",
  };

  function publicWorld() {
    return {
      width: WORLD_W,
      height: WORLD_H,
      cellSize: CELL,
      gridWidth: GRID_W,
      gridHeight: GRID_H,
      tankHeight: TANK_H,
      tankDrawScale: TANK_DRAW_SCALE,
      tankHitWidth: TANK_HIT_W,
      tankHitHeight: TANK_HIT_H,
    };
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  function numberOr(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function hash01(a, b, c) {
    var n = Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233 + (c + 1) * 37.719);
    return n - Math.floor(n);
  }

  function randomNext(random) {
    if (typeof random === "function") return random();
    if (random && typeof random.next === "function") return random.next();
    return 0.5;
  }

  function slugify(name) {
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function weapon(id, name, archetype, points, radius, tags, extra) {
    var item = {
      id: id,
      name: name,
      archetype: archetype,
      points: points,
      impactPoints: points,
      radius: radius,
      tags: tags || [],
      material: "dirt",
      projectile: "arc",
      description: "",
    };
    var key;
    if (extra) {
      for (key in extra) item[key] = extra[key];
    }
    normalizeWeaponScoring(item);
    return item;
  }

  function scoreModeFor(item) {
    var archetype = item.archetype || "";
    if (item.scoreMode) return item.scoreMode;
    if (item.directOnly) return "direct";
    if (archetype === "fire" || archetype === "lava" || archetype === "flamethrower") return "hazard";
    if ((item.tags || []).indexOf("terrain") >= 0 && numberOr(item.impactPoints, 0) <= 0) return "utility";
    if (item.count > 1 || archetype === "splitter" || archetype === "chain" || archetype === "firecracker" || archetype === "rain" || archetype === "carpet" || archetype === "roller" || archetype === "skipper") return "perPiece";
    return "impact";
  }

  function scoreLabelFor(item) {
    var points = numberOr(item.impactPoints, 0);
    var mode = item.scoreMode;
    if (mode === "utility") return "utility";
    if (mode === "hazard") return "burn " + (item.heat || points || 0);
    if (mode === "direct") return "direct " + points;
    if (mode === "perPiece") return "hit " + points + " x" + (item.pieceCount || item.count || 1);
    return "hit " + points;
  }

  function normalizeWeaponScoring(item) {
    item.impactPoints = numberOr(item.impactPoints, numberOr(item.points, 0));
    item.points = item.impactPoints;
    item.pieceCount = item.count || 1;
    item.scoreMode = scoreModeFor(item);
    item.maxImpactScore = item.scoreMode === "perPiece" ? item.impactPoints * item.pieceCount : item.impactPoints;
    item.scoreLabel = item.scoreLabel || scoreLabelFor(item);
  }

  function weaponImpactPoints(weaponDef) {
    return numberOr(weaponDef.impactPoints, numberOr(weaponDef.points, 0));
  }

  var WEAPON_LIST = [];
  function addWeapon(name, archetype, points, radius, tags, extra) {
    var id = extra && extra.id ? extra.id : slugify(name);
    var suffix = 2;
    var base = id;
    while (WEAPONS_BY_ID[id]) {
      id = base + "_" + suffix;
      suffix += 1;
    }
    var item = weapon(id, name, archetype, points, radius, tags, extra);
    WEAPON_LIST.push(item);
    WEAPONS_BY_ID[id] = item;
    return item;
  }

  var WEAPONS_BY_ID = {};
  function buildWeaponCatalog() {
    var classics = [
      ["Single Shot", "blast", 35, 34, ["classic"], { id: "single_shot", description: "A clean reference shell with a small round crater and strong direct value." }],
      ["Big Shot", "big_crater", 26, 50, ["classic"], { id: "big_shot", description: "A larger single blast with lower precision reward." }],
      ["Heavy Shot", "big_crater", 42, 42, ["classic"], { id: "heavy_shot", description: "A compact high-point crater for direct accuracy." }],
      ["Triple Shot", "splitter", 16, 26, ["classic"], { id: "triple_shot", count: 3, description: "Splits mid-flight into three smaller shells." }],
      ["Five Shot", "splitter", 9, 22, ["classic"], { id: "five_shot", count: 5, description: "A wider mid-air split that trades accuracy for coverage." }],
      ["Scatter Shot", "splitter", 6, 20, ["classic"], { id: "scatter_shot", count: 7, description: "Seven light fragments for probing slopes and exposed tanks." }],
      ["Chain Reaction", "chain", 15, 26, ["classic"], { id: "chain_reaction", count: 8, description: "A marching chain of craters that widens a trench." }],
      ["Mega Reaction", "chain", 13, 30, ["classic"], { id: "mega_reaction", count: 12, description: "More chain blasts with lower per-blast value." }],
      ["Firecracker", "firecracker", 10, 18, ["classic"], { id: "firecracker", count: 9, description: "A horizontal pop-pop-pop line for shaving cover." }],
      ["Jackhammer", "jackhammer", 12, 22, ["classic", "tunnel"], { id: "jackhammer", count: 7, description: "A vertical pile-driver that punches a deep shaft into terrain." }],
      ["Dirt Mover", "earth_mover", 4, 56, ["terrain"], { id: "dirt_mover", description: "A low-damage utility crater for opening a fire pit." }],
      ["Earth Mover", "earth_mover", 0, 72, ["terrain"], { id: "earth_mover", description: "Large terrain removal for escapes and setups." }],
      ["Mountain Mover", "earth_mover", 0, 86, ["terrain"], { id: "mountain_mover", description: "Massive terrain removal that exposes buried tanks." }],
      ["Crater Maker", "crater_maker", 18, 92, ["terrain"], { id: "crater_maker", description: "The biggest clean bowl, best for setting up fire." }],
      ["Mower", "mower", 12, 70, ["terrain"], { id: "mower", description: "Flattens a band of terrain without much damage." }],
      ["Flying Digger", "digger", 14, 28, ["tunnel"], { id: "flying_digger", width: 16, description: "Carves a long slanted trench and exit pocket after landing." }],
      ["Digger", "digger", 14, 24, ["tunnel"], { id: "digger", description: "Drills downward from impact." }],
      ["Tunnel", "tunnel", 12, 22, ["tunnel"], { id: "tunnel", description: "Cuts a longer tunnel through cover." }],
      ["Drillers", "drillers", 10, 24, ["tunnel"], { id: "drillers", count: 4, description: "Four diverging drills that fork through terrain." }],
      ["Bunker Buster", "bunker_buster", 22, 46, ["direct", "tunnel"], { id: "bunker_buster", projectile: "direct", pierceTerrain: true, description: "A piercing shell that bores through cover then detonates." }],
      ["Dirtball", "dirtball", 0, 36, ["terrain"], { id: "dirtball", material: "dirt", description: "Builds dirt and can trap a nearby tank." }],
      ["Big Dirtball", "dirtball", 0, 56, ["terrain"], { id: "big_dirtball", material: "dirt", description: "A stronger bury-and-block setup weapon." }],
      ["Dirt Slinger", "dirt_slinger", 0, 24, ["terrain"], { id: "dirt_slinger", count: 7, material: "dirt", description: "Throws a V of dirt clumps for awkward cover." }],
      ["Cruball", "cruball", 0, 30, ["terrain", "rolling"], { id: "cruball", count: 7, material: "dirt", description: "Rolls dirt forward and piles it around the enemy." }],
      ["Wall", "wall", 0, 44, ["terrain"], { id: "wall", material: "dirt", description: "Raises a simple blocking wall." }],
      ["Magic Wall", "wall", 0, 52, ["terrain", "bounce"], { id: "magic_wall", material: "bouncy", description: "Raises a bouncy wall that changes later trajectories." }],
      ["Crazy Wall", "wall", 5, 62, ["terrain"], { id: "crazy_wall", material: "concrete", description: "Raises a sturdy wall with light contact damage." }],
      ["Bouncy Dirt", "dirtball", 0, 40, ["terrain", "bounce"], { id: "bouncy_dirt", material: "bouncy", description: "Builds a bouncy mound for ricochet setups." }],
      ["Glue Bomb", "liquid", 4, 36, ["terrain"], { id: "glue_bomb", material: "glue", description: "Pins and gums up the enemy side." }],
      ["Concrete Donut", "concrete_donut", 0, 42, ["terrain"], { id: "concrete_donut", material: "concrete", description: "Builds a hard ring around the enemy while keeping the center open." }],
      ["Fire in the Hole", "fire", 11, 28, ["fire"], { id: "fire_in_the_hole", count: 7, heat: 10, burnTurns: 2, dropDirt: true, description: "Fire that pools hard in pits and burns for two turns." }],
      ["Fireball", "fire", 12, 32, ["fire"], { id: "fireball", count: 5, heat: 10, burnTurns: 2, description: "A compact burn weapon for crater follow-ups." }],
      ["Flamethrower", "flamethrower", 8, 22, ["fire"], { id: "flamethrower", count: 12, heat: 7, burnTurns: 2, description: "A short flame stream, strongest when trapped near a tank." }],
      ["Napalm", "fire", 14, 46, ["fire"], { id: "napalm", count: 10, heat: 12, burnTurns: 2, description: "Wide, hot, two-turn area denial." }],
      ["Lava", "lava", 14, 44, ["fire", "liquid"], { id: "lava", material: "lava", count: 12, heat: 14, burnTurns: 2, description: "Liquid fire that clings to low ground." }],
      ["Volcano", "lava", 18, 56, ["fire", "terrain"], { id: "volcano", material: "lava", count: 14, heat: 12, burnTurns: 2, description: "A bigger lava eruption with terrain impact." }],
      ["Hail Storm", "rain", 12, 22, ["rain"], { id: "hail_storm", count: 11, description: "Small vertical impacts across a tight band." }],
      ["Meteor Shower", "rain", 16, 30, ["rain"], { id: "meteor_shower", count: 8, description: "Heavier falling craters for punishing open ground." }],
      ["Carpet Bomb", "carpet", 14, 24, ["rain"], { id: "carpet_bomb", count: 10, description: "A marching strip of blasts that peels open a whole ridge." }],
      ["Dive Bomb", "homing", 26, 38, ["guided"], { id: "dive_bomb", description: "An overhead strike that punches a vertical entry and heavy central crater." }],
      ["Laser", "laser", 28, 18, ["direct"], { id: "laser", projectile: "direct", pierceTerrain: true, description: "A straight tunnel-cutting beam." }],
      ["Death Ray", "laser", 36, 26, ["direct"], { id: "death_ray", projectile: "direct", pierceTerrain: true, description: "A wider, higher-value beam." }],
      ["Sniper Rifle", "laser", 70, 10, ["direct"], { id: "sniper_rifle", projectile: "direct", pierceTerrain: true, directOnly: true, description: "Tiny radius, big reward only on direct tank contact." }],
      ["Water Balloon", "liquid", 6, 42, ["liquid"], { id: "water_balloon", material: "water", count: 6, description: "A low-damage counter that pours water and extinguishes fire." }],
      ["Needle Bloom", "laser", 18, 16, ["direct"], { id: "needle_bloom", projectile: "direct", pierceTerrain: true, description: "A fine beam that blooms into radial terrain-cutting needles." }],
      ["Torpedo", "torpedo", 30, 32, ["rolling", "liquid"], { id: "torpedo", projectile: "direct", material: "water", pierceTerrain: true, description: "A water-tunneling direct weapon that can extinguish fire." }],
      ["Cannon Ball", "roller", 42, 26, ["rolling"], { id: "cannon_ball", count: 3, directOnly: true, description: "A heavy ground-hugger that rewards contact." }],
      ["Cruiser", "roller", 20, 28, ["rolling"], { id: "cruiser", count: 8, description: "Rolls a chain of craters along the surface." }],
      ["Roller", "roller", 16, 24, ["rolling"], { id: "roller", count: 6, description: "A lighter surface-travel weapon." }],
      ["Skipper", "skipper", 44, 24, ["rolling"], { id: "skipper", count: 4, directOnly: true, description: "Skips across terrain and stops hard on tank contact." }],
    ];
    var i;
    for (i = 0; i < classics.length; i++) {
      addWeapon(classics[i][0], classics[i][1], classics[i][2], classics[i][3], classics[i][4], classics[i][5]);
    }
    if (WEAPON_LIST.length !== TARGET_WEAPON_COUNT) throw new Error("Arc Tanks weapon catalog must contain exactly " + TARGET_WEAPON_COUNT + " weapons.");
  }

  var WeaponCatalog = {
    all: function () {
      return WEAPON_LIST;
    },
    get: function (id) {
      return WEAPONS_BY_ID[id];
    },
    fallback: function (id) {
      return WEAPONS_BY_ID[id] || WEAPONS_BY_ID.single_shot;
    },
    count: function () {
      return WEAPON_LIST.length;
    },
  };

  buildWeaponCatalog();

  function intervalAt(column, row) {
    var i, entry;
    if (!column) return "";
    for (i = 0; i < column.length; i++) {
      entry = column[i];
      if (row >= entry.y && row < entry.y + entry.h) return entry.mat;
    }
    return "";
  }

  function gridToCells(grid) {
    var cells = [];
    var x, y;
    for (x = 0; x < GRID_W; x++) {
      cells[x] = [];
      for (y = 0; y < GRID_H; y++) cells[x][y] = intervalAt(grid.columns[x], y);
    }
    return cells;
  }

  function cellsToGrid(cells, version) {
    var columns = [];
    var x, y, mat, start;
    for (x = 0; x < GRID_W; x++) {
      columns[x] = [];
      mat = "";
      start = 0;
      for (y = 0; y <= GRID_H; y++) {
        if (y < GRID_H && cells[x][y] === mat) continue;
        if (mat) columns[x].push({ y: start, h: y - start, mat: mat });
        if (y < GRID_H) {
          mat = cells[x][y];
          start = y;
        }
      }
    }
    return { width: WORLD_W, height: WORLD_H, cellSize: CELL, columns: columns, version: version };
  }

  function generateTerrain(ctx) {
    var random = ctx && ctx.random ? ctx.random : null;
    var cells = [];
    var key = Math.floor(randomNext(random) * 1000000);
    var x, y, surface, n, mat;
    for (x = 0; x < GRID_W; x++) {
      n =
        Math.sin((x + key * 0.001) * 0.049) * 58 +
        Math.sin((x + key * 0.002) * 0.101) * 34 +
        Math.sin((x + key * 0.003) * 0.207) * 14;
      surface = Math.round(56 + n / 4.2);
      if (x < 36) surface = Math.round(surface * 0.7 + 64 * 0.3);
      if (x > 164) surface = Math.round(surface * 0.7 + 64 * 0.3);
      surface = clamp(surface, 26, 84);
      cells[x] = [];
      for (y = 0; y < GRID_H; y++) {
        mat = "";
        if (y >= surface) mat = "dirt";
        cells[x][y] = mat;
      }
    }
    flattenCells(cells, 220, 78);
    flattenCells(cells, 1380, 78);
    return { grid: cellsToGrid(cells, 1), key: key };
  }

  function flattenCells(cells, x, radius) {
    var cx = Math.round(x / CELL);
    var cr = Math.round(radius / CELL);
    var top = topRowAtCells(cells, cx);
    var i, y, target;
    for (i = cx - cr; i <= cx + cr; i++) {
      if (i < 0 || i >= GRID_W) continue;
      target = Math.round(top * 0.55 + topRowAtCells(cells, i) * 0.45);
      for (y = 0; y < GRID_H; y++) cells[i][y] = y >= target ? "dirt" : "";
    }
  }

  function topRowAtCells(cells, col) {
    var y;
    col = clamp(col, 0, GRID_W - 1);
    for (y = 0; y < GRID_H; y++) {
      if (supportsTank(cells[col][y])) return y;
    }
    return GRID_H - 1;
  }

  function topYAt(grid, x) {
    var col = clamp(Math.floor(x / CELL), 0, GRID_W - 1);
    var column = grid.columns[col] || [];
    var i, best;
    best = GRID_H - 1;
    for (i = 0; i < column.length; i++) {
      if (supportsTank(column[i].mat) && column[i].y < best) best = column[i].y;
    }
    return best * CELL;
  }

  function slopeAt(grid, x) {
    var left = topYAt(grid, clamp(x - CELL * 3, 0, WORLD_W));
    var right = topYAt(grid, clamp(x + CELL * 3, 0, WORLD_W));
    return round3(clamp(Math.atan2(right - left, CELL * 6), -0.46, 0.46));
  }

  function materialAt(grid, x, y) {
    var col = clamp(Math.floor(x / CELL), 0, GRID_W - 1);
    var row = clamp(Math.floor(y / CELL), 0, GRID_H - 1);
    return intervalAt(grid.columns[col], row);
  }

  function materialHas(material, trait) {
    return !!(MATERIALS[material] && MATERIALS[material][trait]);
  }

  function supportsTank(material) {
    return materialHas(material, "supportsTank");
  }

  function blocksProjectile(material) {
    return materialHas(material, "blocksProjectile");
  }

  function solidAt(grid, x, y) {
    if (x < 0 || x >= WORLD_W || y >= WORLD_H) return true;
    if (y < 0) return false;
    return blocksProjectile(materialAt(grid, x, y));
  }

  function mutateGrid(grid, mutator) {
    var cells = gridToCells(grid);
    mutator(cells);
    return cellsToGrid(cells, (grid.version || 0) + 1);
  }

  function subtractDisk(grid, cx, cy, radius, strength) {
    var op = { type: "subtractDisk", x: round1(cx), y: round1(cy), r: round1(radius) };
    var next = mutateGrid(grid, function (cells) {
      var minX = clamp(Math.floor((cx - radius) / CELL), 0, GRID_W - 1);
      var maxX = clamp(Math.ceil((cx + radius) / CELL), 0, GRID_W - 1);
      var minY = clamp(Math.floor((cy - radius) / CELL), 0, GRID_H - 1);
      var maxY = clamp(Math.ceil((cy + radius) / CELL), 0, GRID_H - 1);
      var x, y, px, py, mat, d;
      for (x = minX; x <= maxX; x++) {
        for (y = minY; y <= maxY; y++) {
          px = x * CELL + CELL / 2;
          py = y * CELL + CELL / 2;
          d = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
          if (d <= radius) {
            mat = cells[x][y];
            if (mat === "concrete" && (strength || 1) < 1.8 && d > radius * 0.46) continue;
            cells[x][y] = "";
          }
        }
      }
    });
    return { grid: next, op: op };
  }

  function addDisk(grid, cx, cy, radius, material) {
    var mat = material || "dirt";
    var op = { type: "addDisk", x: round1(cx), y: round1(cy), r: round1(radius), mat: mat };
    var next = mutateGrid(grid, function (cells) {
      var minX = clamp(Math.floor((cx - radius) / CELL), 0, GRID_W - 1);
      var maxX = clamp(Math.ceil((cx + radius) / CELL), 0, GRID_W - 1);
      var minY = clamp(Math.floor((cy - radius) / CELL), 0, GRID_H - 1);
      var maxY = clamp(Math.ceil((cy + radius) / CELL), 0, GRID_H - 1);
      var x, y, px, py, d;
      for (x = minX; x <= maxX; x++) {
        for (y = minY; y <= maxY; y++) {
          px = x * CELL + CELL / 2;
          py = y * CELL + CELL / 2;
          d = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
          if (d <= radius) cells[x][y] = mat;
        }
      }
    });
    return { grid: next, op: op };
  }

  function addWall(grid, cx, baseY, width, height, material) {
    var mat = material || "dirt";
    var op = { type: "addWall", x: round1(cx), y: round1(baseY), w: round1(width), h: round1(height), mat: mat };
    var next = mutateGrid(grid, function (cells) {
      var minX = clamp(Math.floor((cx - width / 2) / CELL), 0, GRID_W - 1);
      var maxX = clamp(Math.ceil((cx + width / 2) / CELL), 0, GRID_W - 1);
      var minY = clamp(Math.floor((baseY - height) / CELL), 0, GRID_H - 1);
      var maxY = clamp(Math.ceil(baseY / CELL), 0, GRID_H - 1);
      var x, y;
      for (x = minX; x <= maxX; x++) {
        for (y = minY; y <= maxY; y++) cells[x][y] = mat;
      }
    });
    return { grid: next, op: op };
  }

  function distanceToSegment(px, py, ax, ay, bx, by) {
    var vx = bx - ax;
    var vy = by - ay;
    var wx = px - ax;
    var wy = py - ay;
    var c1 = vx * wx + vy * wy;
    var c2 = vx * vx + vy * vy;
    var t = c2 <= 0 ? 0 : clamp(c1 / c2, 0, 1);
    var dx = px - (ax + vx * t);
    var dy = py - (ay + vy * t);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function subtractLine(grid, ax, ay, bx, by, width, material) {
    var op = { type: material ? "materialLine" : "subtractLine", ax: round1(ax), ay: round1(ay), bx: round1(bx), by: round1(by), w: round1(width), mat: material || "" };
    var next = mutateGrid(grid, function (cells) {
      var minX = clamp(Math.floor((Math.min(ax, bx) - width) / CELL), 0, GRID_W - 1);
      var maxX = clamp(Math.ceil((Math.max(ax, bx) + width) / CELL), 0, GRID_W - 1);
      var minY = clamp(Math.floor((Math.min(ay, by) - width) / CELL), 0, GRID_H - 1);
      var maxY = clamp(Math.ceil((Math.max(ay, by) + width) / CELL), 0, GRID_H - 1);
      var x, y, px, py, d;
      for (x = minX; x <= maxX; x++) {
        for (y = minY; y <= maxY; y++) {
          px = x * CELL + CELL / 2;
          py = y * CELL + CELL / 2;
          d = distanceToSegment(px, py, ax, ay, bx, by);
          if (d <= width) cells[x][y] = material || "";
        }
      }
    });
    return { grid: next, op: op };
  }

  function mowBand(grid, cx, radius, depth) {
    var op = { type: "mowBand", x: round1(cx), r: round1(radius), depth: round1(depth) };
    var next = mutateGrid(grid, function (cells) {
      var minX = clamp(Math.floor((cx - radius) / CELL), 0, GRID_W - 1);
      var maxX = clamp(Math.ceil((cx + radius) / CELL), 0, GRID_W - 1);
      var x, y, top, target, falloff;
      for (x = minX; x <= maxX; x++) {
        falloff = 1 - Math.abs(x * CELL - cx) / radius;
        top = topRowAtCells(cells, x);
        target = Math.min(GRID_H - 1, top + Math.round((depth / CELL) * clamp(falloff, 0, 1)));
        for (y = top; y < target; y++) cells[x][y] = "";
      }
    });
    return { grid: next, op: op };
  }

  var Terrain = {
    topYAt: topYAt,
    slopeAt: slopeAt,
    materialAt: materialAt,
    solidAt: solidAt,
    subtractDisk: subtractDisk,
    addDisk: addDisk,
    addWall: addWall,
    subtractLine: subtractLine,
    mowBand: mowBand,
  };

  function settleTank(tank, grid) {
    var x = clamp(tank.x, 72, WORLD_W - 72);
    tank.x = round1(x);
    if (tank.lockTurns > 0 && typeof tank.lockY === "number") {
      tank.y = round1(tank.lockY);
      tank.slope = slopeAt(grid, x);
      return;
    }
    delete tank.lockTurns;
    delete tank.lockY;
    delete tank.buriedMaterial;
    delete tank.buriedRadius;
    tank.y = round1(topYAt(grid, x) - TANK_H / 2);
    tank.slope = slopeAt(grid, x);
  }

  function settleTanks(tanks, grid) {
    settleTank(tanks.p1, grid);
    settleTank(tanks.p2, grid);
  }

  function releaseTank(tank) {
    if (!tank) return;
    delete tank.lockTurns;
    delete tank.lockY;
    delete tank.buriedMaterial;
    delete tank.buriedRadius;
    delete tank.pitTurns;
    delete tank.pitRadius;
  }

  function windFor(turn, key) {
    return Math.round(Math.sin((turn + 1) * 1.73 + key * 0.001) * 24);
  }

  function otherKey(key) {
    return key === "p1" ? "p2" : "p1";
  }

  function keyForPlayer(state, playerId) {
    if (!state || !state.players) return null;
    if (state.players[0] === playerId) return "p1";
    if (state.players[1] === playerId) return "p2";
    return null;
  }

  function playerName(state, playerId) {
    return (state.playerNames && state.playerNames[playerId]) || playerId || "Player";
  }

  function tankName(state, key) {
    return state.tanks && state.tanks[key] ? state.tanks[key].name : key.toUpperCase();
  }

  function aimFor(state, key) {
    var saved = state && state.aim && state.aim[key] ? state.aim[key] : {};
    return { angle: clamp(numberOr(saved.angle, 45), 5, 85), power: clamp(numberOr(saved.power, 82), 20, 100) };
  }

  function muzzleFor(tank, key, angle) {
    var dir = key === "p1" ? 1 : -1;
    var rad = (angle * Math.PI) / 180;
    return {
      x: round1(tank.x + Math.cos(rad) * BARREL_LENGTH * dir),
      y: round1(tank.y + BARREL_ROOT_Y - Math.sin(rad) * BARREL_LENGTH),
    };
  }

  function tankCenter(tank) {
    return { x: tank.x, y: tank.y - 14 };
  }

  function segmentNearPoint(ax, ay, bx, by, px, py) {
    var vx = bx - ax;
    var vy = by - ay;
    var wx = px - ax;
    var wy = py - ay;
    var c2 = vx * vx + vy * vy;
    var t = c2 <= 0 ? 0 : clamp((vx * wx + vy * wy) / c2, 0, 1);
    var cx = ax + vx * t;
    var cy = ay + vy * t;
    var dx = px - cx;
    var dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function tankCollisionAt(state, actor, ax, ay, bx, by, elapsed) {
    var key, tank, center, dist, grace;
    grace = elapsed < 0.18;
    for (key in state.tanks) {
      if (key === actor && grace) continue;
      tank = state.tanks[key];
      center = tankCenter(tank);
      if (Math.max(Math.abs(bx - center.x), Math.abs(by - center.y)) > 96) continue;
      dist = segmentNearPoint(ax, ay, bx, by, center.x, center.y);
      if (dist <= Math.max(TANK_HIT_W * 0.43, TANK_HIT_H * 0.58)) return { key: key, tank: tank, center: center, dist: dist };
    }
    return null;
  }

  function tankNearImpact(tank, x, y, radius) {
    var center = tankCenter(tank);
    var dx = center.x - x;
    var dy = center.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  }

  function tankBodyDistance(tank, x, y) {
    var center = tankCenter(tank);
    var dx = Math.max(0, Math.abs(x - center.x) - TANK_HIT_W * 0.48);
    var dy = Math.max(0, Math.abs(y - center.y) - TANK_HIT_H * 0.48);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function simulateArc(state, key, angle, power, weaponDef) {
    var tank = state.tanks[key];
    var dir = key === "p1" ? 1 : -1;
    var start = muzzleFor(tank, key, angle);
    var rad = (angle * Math.PI) / 180;
    var vx = Math.cos(rad) * (power * 6.3 + 90) * dir;
    var vy = -Math.sin(rad) * (power * 5.6 + 60);
    var x = start.x;
    var y = start.y;
    var prevX = x;
    var prevY = y;
    var t = 0;
    var dt = 0.025;
    var steps = 0;
    var trajectory = [{ x: round1(x), y: round1(y), t: 0 }];
    var bounces = 0;
    var mat = "";
    var hit;
    while (steps < 420) {
      prevX = x;
      prevY = y;
      x += vx * dt + state.wind * 0.5 * dt;
      y += vy * dt;
      vy += GRAVITY * dt;
      t += dt;
      steps += 1;
      trajectory.push({ x: round1(x), y: round1(y), t: round3(t) });
      if (x < 0 || x > WORLD_W || y > WORLD_H + 80) break;
      hit = tankCollisionAt(state, key, prevX, prevY, x, y, t);
      if (hit) {
        x = hit.center.x;
        y = hit.center.y;
        trajectory.push({ x: round1(x), y: round1(y), t: round3(t), hitTank: hit.key });
        return { start: start, impact: { x: round1(x), y: round1(y), material: "tank", hitTank: hit.key, direct: true }, trajectory: trajectory, time: round1(t) };
      }
      mat = materialAt(state.terrainGrid, x, y);
      if (SOLID[mat]) {
        if (mat === "bouncy" && bounces < 2 && weaponDef.archetype !== "digger") {
          bounces += 1;
          vy = -Math.abs(vy) * 0.64;
          vx *= 0.82;
          y -= 14;
          trajectory.push({ x: round1(x), y: round1(y), t: round3(t), bounce: bounces });
          continue;
        }
        break;
      }
    }
    trajectory.push({ x: round1(x), y: round1(y), t: round3(t) });
    return { start: start, impact: { x: clamp(x, 0, WORLD_W), y: clamp(y, 0, WORLD_H), material: mat || "air" }, trajectory: trajectory, time: round1(t) };
  }

  function simulateDirect(state, key, angle, weaponDef) {
    var tank = state.tanks[key];
    var dir = key === "p1" ? 1 : -1;
    var start = muzzleFor(tank, key, angle);
    var rad = (angle * Math.PI) / 180;
    var vx = Math.cos(rad) * dir;
    var vy = -Math.sin(rad);
    var x = start.x;
    var y = start.y;
    var t = 0;
    var dt = 0.006;
    var trajectory = [{ x: round1(x), y: round1(y), t: 0 }];
    var steps, hit, pierces;
    pierces = !!(weaponDef && (weaponDef.pierceTerrain || weaponDef.archetype === "laser" || weaponDef.archetype === "torpedo"));
    for (steps = 0; steps < 260; steps++) {
      var prevX = x;
      var prevY = y;
      x += vx * 10;
      y += vy * 10;
      t += dt;
      hit = tankCollisionAt(state, key, prevX, prevY, x, y, t);
      if (hit) {
        x = hit.center.x;
        y = hit.center.y;
        trajectory.push({ x: round1(x), y: round1(y), t: round3(t), hitTank: hit.key });
        return { start: start, impact: { x: round1(x), y: round1(y), material: "tank", hitTank: hit.key, direct: true }, trajectory: trajectory, time: Math.max(0.12, round1(t)) };
      }
      if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) break;
      if (solidAt(state.terrainGrid, x, y) && !pierces) break;
      if (steps % 2 === 0) trajectory.push({ x: round1(x), y: round1(y), t: round3(t) });
    }
    trajectory.push({ x: round1(x), y: round1(y), t: round3(t) });
    return { start: start, impact: { x: clamp(x, 0, WORLD_W), y: clamp(y, 0, WORLD_H), material: materialAt(state.terrainGrid, x, y) || "air" }, trajectory: trajectory, time: Math.max(0.12, round1(t)) };
  }

  function sampleTrajectoryPoint(points, progress) {
    var endTime, targetTime, i, a, b, denom, frac;
    if (!points || !points.length) return { x: 0, y: 0, t: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y, t: points[0].t || 0 };
    endTime = points[points.length - 1].t || 0;
    targetTime = clamp(progress, 0, 1) * endTime;
    for (i = 0; i < points.length - 1; i++) {
      if ((points[i + 1].t || 0) >= targetTime) {
        a = points[i];
        b = points[i + 1];
        denom = Math.max(0.001, (b.t || 0) - (a.t || 0));
        frac = clamp((targetTime - (a.t || 0)) / denom, 0, 1);
        return {
          x: round1(a.x + (b.x - a.x) * frac),
          y: round1(a.y + (b.y - a.y) * frac),
          t: round3(targetTime),
        };
      }
    }
    return { x: points[points.length - 1].x, y: points[points.length - 1].y, t: endTime };
  }

  function velocityNearTrajectory(points, progress, dir) {
    var p, endTime, targetTime, i, a, b, dt, vx, vy, speed;
    p = points || [];
    if (p.length < 2) return { vx: dir * 430, vy: -220 };
    endTime = p[p.length - 1].t || 0;
    targetTime = clamp(progress, 0, 1) * endTime;
    for (i = 0; i < p.length - 1; i++) {
      if ((p[i + 1].t || 0) >= targetTime) break;
    }
    i = clamp(i, 0, p.length - 2);
    a = p[i];
    b = p[i + 1];
    dt = Math.max(0.001, (b.t || 0) - (a.t || 0));
    vx = (b.x - a.x) / dt;
    vy = (b.y - a.y) / dt;
    speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 180) return { vx: dir * 430, vy: -180 };
    return { vx: vx, vy: vy };
  }

  function rotateVelocity(vx, vy, radians) {
    var c = Math.cos(radians);
    var s = Math.sin(radians);
    return { vx: vx * c - vy * s, vy: vx * s + vy * c };
  }

  function simulateFragment(state, actor, start, vx, vy, weaponDef) {
    var x = start.x;
    var y = start.y;
    var prevX = x;
    var prevY = y;
    var t = 0;
    var dt = 0.022;
    var steps = 0;
    var bounces = 0;
    var mat = "";
    var hit;
    var trajectory = [{ x: round1(x), y: round1(y), t: 0 }];
    while (steps < 150) {
      prevX = x;
      prevY = y;
      x += vx * dt + state.wind * 0.34 * dt;
      y += vy * dt;
      vy += GRAVITY * dt;
      t += dt;
      steps += 1;
      if (steps % 2 === 0) trajectory.push({ x: round1(x), y: round1(y), t: round3(t) });
      if (x < 0 || x > WORLD_W || y > WORLD_H + 80) break;
      hit = tankCollisionAt(state, actor, prevX, prevY, x, y, t);
      if (hit) {
        x = hit.center.x;
        y = hit.center.y;
        trajectory.push({ x: round1(x), y: round1(y), t: round3(t), hitTank: hit.key });
        return { impact: { x: round1(x), y: round1(y), material: "tank", hitTank: hit.key, direct: true }, trajectory: trajectory, time: round1(t) };
      }
      mat = materialAt(state.terrainGrid, x, y);
      if (SOLID[mat]) {
        if (mat === "bouncy" && bounces < 1 && weaponDef.archetype !== "digger") {
          bounces += 1;
          vy = -Math.abs(vy) * 0.58;
          vx *= 0.78;
          y -= 10;
          trajectory.push({ x: round1(x), y: round1(y), t: round3(t), bounce: bounces });
          continue;
        }
        break;
      }
    }
    trajectory.push({ x: round1(x), y: round1(y), t: round3(t) });
    return { impact: { x: clamp(x, 0, WORLD_W), y: clamp(y, 0, WORLD_H), material: mat || "air" }, trajectory: trajectory, time: round1(t) };
  }

  var ProjectileSim = {
    arc: simulateArc,
    direct: simulateDirect,
    fragment: simulateFragment,
    forWeapon: function (state, key, angle, power, weaponDef) {
      if (weaponDef.projectile === "direct" || weaponDef.archetype === "laser") return simulateDirect(state, key, angle, weaponDef);
      return simulateArc(state, key, angle, power, weaponDef);
    },
  };

  function bowlFactorAt(grid, x, radius) {
    var center = topYAt(grid, x);
    var left = topYAt(grid, clamp(x - radius, 0, WORLD_W));
    var right = topYAt(grid, clamp(x + radius, 0, WORLD_W));
    var nearLeft = topYAt(grid, clamp(x - radius * 0.48, 0, WORLD_W));
    var nearRight = topYAt(grid, clamp(x + radius * 0.48, 0, WORLD_W));
    var wall = Math.max(0, center - left) + Math.max(0, center - right);
    var shoulder = Math.max(0, center - nearLeft) + Math.max(0, center - nearRight);
    return clamp((wall * 0.68 + shoulder * 0.32) / Math.max(18, radius * 0.72), 0, 1.8);
  }

  function emberCountFor(weaponDef) {
    if (weaponDef.count) return weaponDef.count;
    if (weaponDef.archetype === "lava") return 12;
    if (weaponDef.archetype === "flamethrower") return 12;
    return weaponDef.id === "fire_in_the_hole" ? 7 : 9;
  }

  function scoreImpact(impact, weaponDef, tanks, actor, scoreDelta, ticksOut) {
    var key, tank, center, d, reach, exposure, points, signedPoints, basePoints;
    basePoints = numberOr(impact.points, weaponImpactPoints(weaponDef));
    for (key in tanks) {
      tank = tanks[key];
      center = tankCenter(tank);
      if (impact.hitTank === key) {
        if (basePoints <= 0) continue;
        points = Math.max(1, Math.round(basePoints));
        signedPoints = key === actor ? -points : points;
        scoreDelta[actor] += signedPoints;
        if (ticksOut) ticksOut.push({ target: key, x: round1(tank.x), y: round1(tank.y), ticks: Math.max(3, Math.min(20, Math.ceil(points / 4))), points: signedPoints, kind: "direct" });
        continue;
      }
      if (basePoints <= 0) continue;
      if (weaponDef.directOnly) continue;
      d = Math.sqrt((center.x - impact.x) * (center.x - impact.x) + (center.y - impact.y) * (center.y - impact.y));
      reach = (impact.radius || weaponDef.radius || 30) + 26;
      if (d <= reach) {
        exposure = (reach - d) / reach;
        exposure = exposure * exposure;
        points = Math.max(1, Math.round(basePoints * exposure));
        signedPoints = key === actor ? -points : points;
        scoreDelta[actor] += signedPoints;
        if (ticksOut) ticksOut.push({ target: key, x: round1(tank.x), y: round1(tank.y), ticks: Math.max(2, Math.min(18, points)), points: signedPoints, kind: "impact" });
      }
    }
  }

  function hazardScore(hazard, tanks, actor, scoreDelta, ticksOut) {
    var key, tank, d, exposure, exposurePower, ticks, points, heat, cluster, reach, capKey, cap, spent, allowed, combo;
    if (!scoreDelta._hazardSpent) scoreDelta._hazardSpent = {};
    for (key in tanks) {
      tank = tanks[key];
      d = tankBodyDistance(tank, hazard.x, hazard.y);
      reach = hazard.r + 28;
      if (d <= reach) {
        exposure = (reach - d) / reach;
        heat = hazard.heat || 8;
        cluster = hazard.cluster || 0;
        exposure = exposure * (hazard.exposure || 1);
        combo = (hazard.exposure || 1) > 1.05 || cluster > 0.7;
        exposurePower = exposure * exposure;
        ticks = Math.max(1, Math.round(1 + exposure * 4.2 + heat * 0.1 + cluster * 2.6));
        points = Math.max(1, Math.round(ticks * heat * 0.022 * (0.28 + exposurePower * 0.86 + cluster * 0.34)));
        cap = combo ? (hazard.kind === "lava" ? 110 : 88) : (hazard.kind === "lava" ? 28 : 20);
        if (key === actor) cap = Math.round(cap * 0.65);
        capKey = actor + ":" + key + ":" + (hazard.kind || "fire");
        spent = scoreDelta._hazardSpent[capKey] || 0;
        allowed = Math.max(0, cap - spent);
        if (allowed <= 0) continue;
        points = Math.min(points, allowed);
        scoreDelta._hazardSpent[capKey] = spent + points;
        if (key === actor) scoreDelta[actor] -= points;
        else scoreDelta[actor] += points;
        ticksOut.push({ target: key, x: round1(hazard.x), y: round1(hazard.y), ticks: ticks, points: key === actor ? -points : points, heat: heat, cluster: cluster });
      }
    }
  }

  function applyAndTrack(result, change) {
    result.terrainGrid = change.grid;
    result.terrainOps.push(change.op);
  }

  function addImpact(result, impact, weaponDef, actor) {
    result.impacts.push(impact);
    scoreImpact(impact, weaponDef, result.tanks, actor, result.scoreDelta, result.scoreTicks);
  }

  var Scoring = {
    impact: scoreImpact,
    hazard: hazardScore,
  };

  function extinguishesMaterial(material) {
    return materialHas(material, "extinguishes");
  }

  function shouldExtinguishHazard(hazard, x, y, radius, material) {
    var dx, dy, reach;
    if (!hazard || !extinguishesMaterial(material)) return false;
    if (hazard.kind !== "fire" && hazard.kind !== "lava") return false;
    dx = hazard.x - x;
    dy = hazard.y - y;
    reach = radius * (material === "water" ? 2.3 : 0.95) + (hazard.r || 18) * (material === "water" ? 1.25 : 0.85);
    return Math.sqrt(dx * dx + dy * dy) <= reach;
  }

  function extinguishHazards(result, x, y, radius, material) {
    var i, hazard, next;
    if (!result || !extinguishesMaterial(material)) return 0;
    if (!result.extinguished) result.extinguished = [];
    next = [];
    for (i = 0; i < result.activeHazards.length; i++) {
      hazard = result.activeHazards[i];
      if (shouldExtinguishHazard(hazard, x, y, radius, material)) result.extinguished.push({ x: round1(hazard.x), y: round1(hazard.y), material: material, kind: hazard.kind });
      else next.push(hazard);
    }
    result.activeHazards = next;
    next = [];
    for (i = 0; i < result.newHazards.length; i++) {
      hazard = result.newHazards[i];
      if (shouldExtinguishHazard(hazard, x, y, radius, material)) result.extinguished.push({ x: round1(hazard.x), y: round1(hazard.y), material: material, kind: hazard.kind });
      else next.push(hazard);
    }
    result.newHazards = next;
    return result.extinguished.length;
  }

  function applyMaterialAndTrack(result, change, material, x, y, radius) {
    applyAndTrack(result, change);
    extinguishHazards(result, x, y, radius, material);
  }

  Terrain.apply = applyAndTrack;
  Terrain.applyMaterial = applyMaterialAndTrack;

  function makeWeaponContext(result, state, key, weaponDef, sim) {
    return { result: result, state: state, key: key, weaponDef: weaponDef, sim: sim, dir: key === "p1" ? 1 : -1, x: sim.impact.x, y: sim.impact.y, r: weaponDef.radius };
  }

  function enemyTank(ctx) {
    return ctx.result.tanks[otherKey(ctx.key)];
  }

  function trackTerrain(ctx, change) {
    Terrain.apply(ctx.result, change);
  }

  function trackMaterial(ctx, change, material, x, y, radius) {
    Terrain.applyMaterial(ctx.result, change, material, x, y, radius);
  }

  function addMaterialDisk(ctx, x, y, radius, material) {
    var change = Terrain.addDisk(ctx.result.terrainGrid, x, y, radius, material);
    trackMaterial(ctx, change, material, x, y, radius);
  }

  function addSettledMaterialDisk(ctx, x, y, radius, material) {
    var surfaceY = Terrain.topYAt(ctx.result.terrainGrid, x);
    var settledY = Math.min(y, surfaceY - radius * 0.42);
    addMaterialDisk(ctx, x, settledY, radius, material);
    return settledY;
  }

  function encaseTank(ctx, target, material, radius, lockTurns) {
    var center = tankCenter(target);
    var groundY = target.y + TANK_H / 2;
    var sideR = Math.max(radius * 0.96, 40);
    var capR = Math.max(radius * 0.86, 38);
    var footR = Math.max(radius * 0.9, 40);
    addMaterialDisk(ctx, target.x - TANK_HIT_W * 0.44, center.y + 4, sideR, material);
    addMaterialDisk(ctx, target.x + TANK_HIT_W * 0.44, center.y + 4, sideR, material);
    addMaterialDisk(ctx, target.x, groundY - 2, footR, material);
    addMaterialDisk(ctx, target.x, center.y - TANK_HIT_H * 0.72, capR, material);
    if (radius > 48) {
      addMaterialDisk(ctx, target.x - TANK_HIT_W * 0.12, center.y - TANK_HIT_H * 0.18, radius * 0.78, material);
      addMaterialDisk(ctx, target.x + TANK_HIT_W * 0.12, center.y - TANK_HIT_H * 0.18, radius * 0.78, material);
    }
    target.lockY = target.y;
    target.lockTurns = Math.max(target.lockTurns || 0, lockTurns || 2);
    target.buriedMaterial = material;
    target.buriedRadius = round1(radius);
  }

  function addMaterialRing(ctx, centerX, centerY, radius, material) {
    var blobs = 8;
    var i, a, px, py, change;
    for (i = 0; i < blobs; i++) {
      a = (Math.PI * 2 * i) / blobs;
      px = centerX + Math.cos(a) * radius * 0.72;
      py = centerY + Math.sin(a) * radius * 0.56;
      change = Terrain.addDisk(ctx.result.terrainGrid, px, py, radius * 0.34, material);
      trackMaterial(ctx, change, material, px, py, radius * 0.34);
    }
    change = Terrain.subtractDisk(ctx.result.terrainGrid, centerX, centerY, radius * 0.48, 2.4);
    trackTerrain(ctx, change);
  }

  function weaponImpact(ctx, impact) {
    addImpact(ctx.result, impact, ctx.weaponDef, ctx.key);
  }

  function prepareWeaponContext(ctx) {
    var target;
    if (ctx.weaponDef.archetype === "homing") {
      target = enemyTank(ctx);
      ctx.x = target.x + (hash01(ctx.state.turn, ctx.r, 3) - 0.5) * 26;
      ctx.y = target.y - 8;
    }
    if (ctx.sim.impact && ctx.sim.impact.hitTank) {
      addImpact(ctx.result, { x: round1(ctx.x), y: round1(ctx.y), radius: Math.max(10, ctx.r * 0.52), type: "direct", material: "tank", points: weaponImpactPoints(ctx.weaponDef), hitTank: ctx.sim.impact.hitTank }, ctx.weaponDef, ctx.key);
      if (ctx.weaponDef.archetype === "skipper" || ctx.weaponDef.directOnly) return false;
      ctx.weaponDef = copy(ctx.weaponDef);
      ctx.weaponDef.impactPoints = 0;
      ctx.weaponDef.points = 0;
    }
    return true;
  }

  function handleBlastWeapon(ctx) {
    var change = Terrain.subtractDisk(ctx.result.terrainGrid, ctx.x, ctx.y, ctx.r, ctx.weaponDef.archetype === "big_crater" ? 2 : 1);
    trackTerrain(ctx, change);
    weaponImpact(ctx, { x: round1(ctx.x), y: round1(ctx.y), radius: ctx.r, type: "crater", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleTerrainMoverWeapon(ctx) {
    var change = Terrain.subtractDisk(ctx.result.terrainGrid, ctx.x, ctx.y, ctx.r, 2.3);
    var mowChange;
    trackTerrain(ctx, change);
    mowChange = Terrain.mowBand(ctx.result.terrainGrid, ctx.x, ctx.r * 1.15, ctx.r * 0.45);
    trackTerrain(ctx, mowChange);
    weaponImpact(ctx, { x: round1(ctx.x), y: round1(ctx.y), radius: ctx.r * 1.12, type: "huge_crater", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleDirtballWeapon(ctx) {
    var material = ctx.weaponDef.material || "dirt";
    var target = enemyTank(ctx);
    var canTrap = material === "dirt" || material === "concrete";
    var trapped = canTrap && target && tankNearImpact(target, ctx.x, ctx.y, ctx.r + 104);
    var settledY;
    if (trapped) {
      encaseTank(ctx, target, material, ctx.r * 1.12, ctx.weaponDef.id === "big_dirtball" ? 3 : 2);
      weaponImpact(ctx, { x: round1(target.x), y: round1(tankCenter(target).y), radius: ctx.r * 1.32, type: "encase", material: material, points: 0, hitTank: otherKey(ctx.key) });
      return;
    }
    settledY = addSettledMaterialDisk(ctx, ctx.x, ctx.y - ctx.r * 0.25, ctx.r * 1.28, material);
    weaponImpact(ctx, { x: round1(ctx.x), y: round1(settledY), radius: ctx.r * 0.72, type: "dirt", material: material, points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleConcreteDonutWeapon(ctx) {
    var target = enemyTank(ctx);
    var material = ctx.weaponDef.material || "concrete";
    var centerX = ctx.x;
    var centerY = ctx.y;
    var trapped = false;
    if (target && tankNearImpact(target, ctx.x, ctx.y, ctx.r + 110)) {
      centerX = target.x;
      centerY = tankCenter(target).y + 2;
      trapped = true;
    }
    addMaterialRing(ctx, centerX, centerY, ctx.r * 1.52, material);
    if (trapped) {
      target.lockY = target.y;
      target.lockTurns = Math.max(target.lockTurns || 0, 2);
      target.buriedMaterial = material;
      target.buriedRadius = round1(ctx.r * 1.52);
    }
    weaponImpact(ctx, { x: round1(centerX), y: round1(centerY), radius: ctx.r * 1.32, type: "concrete_donut", material: material, points: 0, hitTank: trapped ? otherKey(ctx.key) : "" });
  }

  function handleCruballWeapon(ctx) {
    var material = ctx.weaponDef.material || "dirt";
    var count = Math.max(5, ctx.weaponDef.count || 7);
    var target = enemyTank(ctx);
    var startX = ctx.x;
    var i, ix, iy, r, step, nearTarget;
    step = Math.max(20, ctx.r * 0.58);
    nearTarget = target && Math.abs(target.x - startX) <= ctx.r * 6.6;
    for (i = 0; i < count; i++) {
      ix = clamp(startX + ctx.dir * i * step, 18, WORLD_W - 18);
      iy = Terrain.topYAt(ctx.result.terrainGrid, ix) - ctx.r * 0.12;
      r = ctx.r * (0.58 + hash01(i, ctx.state.turn, 24) * 0.24);
      addMaterialDisk(ctx, ix, iy, r, material);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: r * 0.5, type: "dirt", material: material, points: 0 });
    }
    if (nearTarget && tankNearImpact(target, ctx.x, ctx.y, ctx.r * 5.8)) {
      encaseTank(ctx, target, material, ctx.r * 1.02, 2);
      weaponImpact(ctx, { x: round1(target.x), y: round1(tankCenter(target).y), radius: ctx.r * 1.14, type: "encase", material: material, points: 0, hitTank: otherKey(ctx.key) });
    }
  }

  function handleWallWeapon(ctx) {
    var material = ctx.weaponDef.material || "dirt";
    var wallX = ctx.x + ctx.dir * 22;
    var baseY = Terrain.topYAt(ctx.result.terrainGrid, wallX);
    var wallWidth = Math.max(36, ctx.r * 0.78);
    var wallHeight = ctx.r * (ctx.weaponDef.id === "wall" ? 2.35 : ctx.weaponDef.id === "magic_wall" ? 2.65 : 2.85);
    var change = Terrain.addWall(ctx.result.terrainGrid, wallX, baseY, wallWidth, wallHeight, material);
    trackMaterial(ctx, change, material, wallX, baseY - wallHeight * 0.5, Math.max(wallWidth, wallHeight));
    weaponImpact(ctx, { x: round1(wallX), y: round1(baseY - wallHeight * 0.5), radius: Math.max(wallWidth, wallHeight) * 0.45, type: "wall", material: material, points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleDirtSlingerWeapon(ctx) {
    var count = ctx.weaponDef.count || 6;
    var material = ctx.weaponDef.material || "dirt";
    var i, off, ix, iy, settledY;
    for (i = 0; i < count; i++) {
      off = (i - (count - 1) / 2) * ctx.r * 0.52;
      ix = ctx.x + off + (hash01(i, ctx.state.turn, 1) - 0.5) * 18;
      iy = ctx.y - ctx.r * (0.2 + hash01(i, ctx.state.turn, 2) * 0.9);
      settledY = addSettledMaterialDisk(ctx, ix, iy, ctx.r * 0.72, material);
      weaponImpact(ctx, { x: round1(ix), y: round1(settledY), radius: ctx.r * 0.36, type: "dirt", material: material, points: 0 });
    }
  }

  function handleTunnelWeapon(ctx) {
    var isDigger = ctx.weaponDef.archetype === "digger";
    var isFlying = ctx.weaponDef.id === "flying_digger";
    var target = enemyTank(ctx);
    var endX = ctx.x + ctx.dir * ctx.r * (isFlying ? 4.4 : isDigger ? 0.72 : 3.2);
    var endY = ctx.y + ctx.r * (isFlying ? 3.9 : isDigger ? 5.2 : 2.1);
    var width = ctx.weaponDef.width || ctx.r * (isFlying ? 0.58 : isDigger ? 0.82 : 0.68);
    var change = Terrain.subtractLine(ctx.result.terrainGrid, ctx.x, ctx.y, endX, endY, width);
    var pocketChange, diggerChange;
    trackTerrain(ctx, change);
    if (isFlying) {
      change = Terrain.subtractLine(ctx.result.terrainGrid, ctx.x - ctx.dir * ctx.r * 1.35, ctx.y - ctx.r * 0.22, endX, endY + ctx.r * 0.62, width * 0.72);
      trackTerrain(ctx, change);
      pocketChange = Terrain.subtractDisk(ctx.result.terrainGrid, endX, endY + ctx.r * 0.28, ctx.r * 1.3, 2);
      trackTerrain(ctx, pocketChange);
      if (target && (tankNearImpact(target, ctx.x, ctx.y, ctx.r * 4.1) || tankNearImpact(target, endX, endY, ctx.r * 3.1))) {
        target.pitTurns = Math.max(target.pitTurns || 0, 2);
        target.pitRadius = Math.max(target.pitRadius || 0, ctx.r * 4.4);
      }
    } else if (isDigger) {
      diggerChange = Terrain.subtractDisk(ctx.result.terrainGrid, endX, endY, ctx.r * 1.08, 2);
      trackTerrain(ctx, diggerChange);
      if (target && tankNearImpact(target, ctx.x, ctx.y, ctx.r * 4.2)) {
        target.pitTurns = Math.max(target.pitTurns || 0, 2);
        target.pitRadius = Math.max(target.pitRadius || 0, ctx.r * 4.2);
      }
    }
    weaponImpact(ctx, { x: round1((ctx.x + endX) / 2), y: round1((ctx.y + endY) / 2), radius: ctx.r * (isDigger ? 1.4 : 1), type: "tunnel", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleDrillersWeapon(ctx) {
    var count = Math.max(4, ctx.weaponDef.count || 5);
    var target = enemyTank(ctx);
    var i, fan, length, endX, endY, width, change, hitPit;
    hitPit = false;
    for (i = 0; i < count; i++) {
      fan = (i - (count - 1) / 2) / Math.max(1, count - 1);
      length = ctx.r * (4.1 + hash01(i, ctx.state.turn, 31) * 1.15);
      endX = clamp(ctx.x + ctx.dir * length * (0.34 + Math.abs(fan) * 0.82), 0, WORLD_W);
      endY = clamp(ctx.y + ctx.r * (3.0 + Math.abs(fan) * 2.35), 0, WORLD_H);
      width = ctx.r * (0.56 + Math.abs(fan) * 0.2);
      change = Terrain.subtractLine(ctx.result.terrainGrid, ctx.x, ctx.y, endX, endY, width);
      trackTerrain(ctx, change);
      change = Terrain.subtractDisk(ctx.result.terrainGrid, endX, endY, ctx.r * (0.72 + Math.abs(fan) * 0.18), 1.9);
      trackTerrain(ctx, change);
      if (target && (tankNearImpact(target, ctx.x, ctx.y, ctx.r * 4.2) || tankNearImpact(target, endX, endY, ctx.r * 2.4))) hitPit = true;
      weaponImpact(ctx, { x: round1((ctx.x + endX) / 2), y: round1((ctx.y + endY) / 2), radius: width * 1.9, type: "tunnel", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
    }
    if (hitPit && target) {
      target.pitTurns = Math.max(target.pitTurns || 0, 2);
      target.pitRadius = Math.max(target.pitRadius || 0, ctx.r * 4.6);
    }
  }

  function handleLaserWeapon(ctx) {
    var endX = ctx.sim.impact.x;
    var endY = ctx.sim.impact.y;
    var target = enemyTank(ctx);
    if (ctx.weaponDef.id === "needle_bloom" && target) {
      endX = clamp(target.x + (hash01(ctx.state.turn, ctx.r, 62) - 0.5) * 28, 0, WORLD_W);
      endY = clamp(tankCenter(target).y + 4, 0, WORLD_H);
    }
    var change = Terrain.subtractLine(ctx.result.terrainGrid, ctx.sim.start.x, ctx.sim.start.y, endX, endY, ctx.r * 0.42);
    var i, a, length, bx, by;
    trackTerrain(ctx, change);
    if (ctx.weaponDef.id === "needle_bloom") {
      for (i = 0; i < 9; i++) {
        a = -Math.PI * 0.92 + (Math.PI * 1.84 * i) / 8;
        length = ctx.r * (3.1 + hash01(i, ctx.state.turn, 41) * 1.2);
        bx = clamp(endX + Math.cos(a) * length, 0, WORLD_W);
        by = clamp(endY + Math.sin(a) * length, 0, WORLD_H);
        change = Terrain.subtractLine(ctx.result.terrainGrid, endX, endY, bx, by, ctx.r * 0.24);
        trackTerrain(ctx, change);
      }
    }
    weaponImpact(ctx, { x: round1(endX), y: round1(endY), radius: ctx.r, type: ctx.weaponDef.id === "needle_bloom" ? "needle_bloom" : "laser", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleBunkerBusterWeapon(ctx) {
    var endX = ctx.sim.impact.x;
    var endY = ctx.sim.impact.y;
    var change = Terrain.subtractLine(ctx.result.terrainGrid, ctx.sim.start.x, ctx.sim.start.y, endX, endY, ctx.r * 0.28);
    var craterChange;
    trackTerrain(ctx, change);
    craterChange = Terrain.subtractDisk(ctx.result.terrainGrid, endX, endY, ctx.r, 1.8);
    trackTerrain(ctx, craterChange);
    weaponImpact(ctx, { x: round1(endX), y: round1(endY), radius: ctx.r, type: "bunker_buster", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleSplitterWeapon(ctx) {
    var count = ctx.weaponDef.count || 5;
    var splitProgress = 0.58;
    var splitStart = sampleTrajectoryPoint(ctx.sim.trajectory, splitProgress);
    var splitVelocity = velocityNearTrajectory(ctx.sim.trajectory, splitProgress, ctx.dir);
    var i, fan, rotated, child, fragment, ix, iy, craterR, change;
    for (i = 0; i < count; i++) {
      fan = (i - (count - 1) / 2) * (count <= 3 ? 0.24 : 0.17);
      rotated = rotateVelocity(splitVelocity.vx * 0.72, splitVelocity.vy * 0.62 - Math.abs(i - (count - 1) / 2) * 34, fan);
      child = simulateFragment(ctx.state, ctx.key, splitStart, rotated.vx, rotated.vy, ctx.weaponDef);
      fragment = { start: { x: splitStart.x, y: splitStart.y }, trajectory: child.trajectory, time: child.time, impact: child.impact };
      ctx.result.fragments.push(fragment);
      ix = child.impact.x;
      iy = child.impact.y;
      craterR = ctx.r * (count <= 3 ? 0.72 : 0.6);
      change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, craterR, 1);
      trackTerrain(ctx, change);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: craterR, type: "splitter", material: "air", points: weaponImpactPoints(ctx.weaponDef), hitTank: child.impact.hitTank, fragmentIndex: i });
    }
  }

  function handleChainWeapon(ctx) {
    var count = ctx.weaponDef.count || (ctx.weaponDef.archetype === "firecracker" ? 9 : 5);
    var i, off, ix, iy, change;
    for (i = 0; i < count; i++) {
      off = (i - (count - 1) / 2) * ctx.r * 0.72;
      ix = ctx.x + off * (ctx.weaponDef.archetype === "firecracker" ? ctx.dir : 1);
      iy = ctx.y + Math.sin(i * 1.7) * ctx.r * 0.38;
      change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, ctx.r * 0.72, 1);
      trackTerrain(ctx, change);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: ctx.r * 0.75, type: ctx.weaponDef.archetype, material: "air", points: weaponImpactPoints(ctx.weaponDef) });
    }
  }

  function handleJackhammerWeapon(ctx) {
    var count = Math.max(6, ctx.weaponDef.count || 7);
    var target = enemyTank(ctx);
    var i, ix, iy, lastX, lastY, r, change;
    lastX = ctx.x;
    lastY = ctx.y - ctx.r * 0.4;
    for (i = 0; i < count; i++) {
      ix = clamp(ctx.x + (hash01(i, ctx.state.turn, 34) - 0.5) * ctx.r * 0.42, 0, WORLD_W);
      iy = clamp(ctx.y + i * ctx.r * 0.68, 0, WORLD_H);
      r = ctx.r * (0.88 - Math.min(0.18, i * 0.018));
      change = Terrain.subtractLine(ctx.result.terrainGrid, lastX, lastY, ix, iy, ctx.r * 0.42);
      trackTerrain(ctx, change);
      change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, r, 1.7);
      trackTerrain(ctx, change);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: r * 0.9, type: "jackhammer", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
      lastX = ix;
      lastY = iy;
    }
    if (target && tankNearImpact(target, ctx.x, ctx.y, ctx.r * 4.0)) {
      target.pitTurns = Math.max(target.pitTurns || 0, 2);
      target.pitRadius = Math.max(target.pitRadius || 0, ctx.r * 3.8);
    }
  }

  function handleRainWeapon(ctx) {
    var count = ctx.weaponDef.count || 8;
    var i, off, ix, iy, change;
    for (i = 0; i < count; i++) {
      off = (i - (count - 1) / 2) * ctx.r * 0.8;
      ix = ctx.x + off;
      iy = Terrain.topYAt(ctx.result.terrainGrid, ix) + 4;
      change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, ctx.r * 0.62, 1);
      trackTerrain(ctx, change);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: ctx.r * 0.68, type: "rain", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
    }
  }

  function handleCarpetWeapon(ctx) {
    var count = Math.max(8, ctx.weaponDef.count || 10);
    var startX = ctx.x - ctx.dir * ctx.r * count * 0.44;
    var i, ix, iy, r, change;
    change = Terrain.mowBand(ctx.result.terrainGrid, ctx.x, ctx.r * count * 0.52, ctx.r * 0.36);
    trackTerrain(ctx, change);
    for (i = 0; i < count; i++) {
      ix = clamp(startX + ctx.dir * i * ctx.r * 0.9, 0, WORLD_W);
      iy = Terrain.topYAt(ctx.result.terrainGrid, ix) + ctx.r * (0.1 + (i % 2) * 0.18);
      r = ctx.r * (0.82 + hash01(i, ctx.state.turn, 44) * 0.18);
      change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, r, 1.35);
      trackTerrain(ctx, change);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: r * 0.86, type: "carpet", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
    }
  }

  function handleHomingWeapon(ctx) {
    var target = enemyTank(ctx);
    var strikeX = clamp(ctx.x, 0, WORLD_W);
    var groundY = Terrain.topYAt(ctx.result.terrainGrid, strikeX);
    var change, i, off, ix, iy, r;
    if (target) strikeX = clamp(target.x + (hash01(ctx.state.turn, ctx.r, 73) - 0.5) * 34, 0, WORLD_W);
    groundY = Terrain.topYAt(ctx.result.terrainGrid, strikeX);
    change = Terrain.subtractLine(ctx.result.terrainGrid, strikeX, 0, strikeX, groundY + ctx.r * 1.2, ctx.r * 0.3);
    trackTerrain(ctx, change);
    change = Terrain.subtractDisk(ctx.result.terrainGrid, strikeX, groundY, ctx.r * 1.22, 1.8);
    trackTerrain(ctx, change);
    weaponImpact(ctx, { x: round1(strikeX), y: round1(groundY), radius: ctx.r * 1.16, type: "dive_bomb", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
    for (i = 0; i < 2; i++) {
      off = (i === 0 ? -1 : 1) * ctx.r * 1.15;
      ix = clamp(strikeX + off, 0, WORLD_W);
      iy = Terrain.topYAt(ctx.result.terrainGrid, ix) + ctx.r * 0.18;
      r = ctx.r * 0.56;
      change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, r, 1.2);
      trackTerrain(ctx, change);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: r * 0.8, type: "dive_splinter", material: "air", points: Math.round(weaponImpactPoints(ctx.weaponDef) * 0.36) });
    }
  }

  function handleRollingWeapon(ctx) {
    var count = ctx.weaponDef.count || 6;
    var i, ix, iy, target, change, waterR, directLineEndX, directLineEndY, contactReach;
    if (ctx.weaponDef.archetype === "torpedo" && ctx.weaponDef.projectile === "direct") count = Math.max(5, count);
    for (i = 0; i < count; i++) {
      if (ctx.weaponDef.archetype === "torpedo" && ctx.weaponDef.projectile === "direct") {
        directLineEndX = ctx.sim.impact.x;
        directLineEndY = ctx.sim.impact.y;
        ix = clamp(ctx.sim.start.x + (directLineEndX - ctx.sim.start.x) * ((i + 1) / count), 0, WORLD_W);
        iy = clamp(ctx.sim.start.y + (directLineEndY - ctx.sim.start.y) * ((i + 1) / count), 0, WORLD_H);
      } else {
        ix = clamp(ctx.x + ctx.dir * i * ctx.r * 0.72, 0, WORLD_W);
        iy = Terrain.topYAt(ctx.result.terrainGrid, ix) + (ctx.weaponDef.archetype === "torpedo" ? ctx.r * 0.35 : 0);
      }
      target = enemyTank(ctx);
      contactReach = ctx.r + (ctx.weaponDef.directOnly ? 52 : 44);
      if (tankNearImpact(target, ix, iy, contactReach)) {
        ix = target.x;
        iy = tankCenter(target).y;
        change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, ctx.r * 0.52, 1);
        trackTerrain(ctx, change);
        if (ctx.weaponDef.archetype === "torpedo") {
          waterR = ctx.r * 0.48;
          change = Terrain.addDisk(ctx.result.terrainGrid, ix, iy + ctx.r * 0.32, waterR, "water");
          trackMaterial(ctx, change, "water", ix, iy + ctx.r * 0.32, waterR);
        }
        weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: ctx.r * 0.62, type: "direct", material: "tank", points: weaponImpactPoints(ctx.weaponDef), hitTank: otherKey(ctx.key) });
        break;
      }
      change = Terrain.subtractDisk(ctx.result.terrainGrid, ix, iy, ctx.r * (ctx.weaponDef.archetype === "torpedo" ? 0.52 : 0.62), 1);
      trackTerrain(ctx, change);
      if (ctx.weaponDef.archetype === "torpedo") {
        waterR = ctx.r * 0.42;
        change = Terrain.addDisk(ctx.result.terrainGrid, ix, iy + ctx.r * 0.28, waterR, "water");
        trackMaterial(ctx, change, "water", ix, iy + ctx.r * 0.28, waterR);
      }
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: ctx.r * 0.64, type: ctx.weaponDef.archetype, material: ctx.weaponDef.archetype === "torpedo" ? "water" : "air", points: weaponImpactPoints(ctx.weaponDef) });
    }
  }

  function handleLiquidWeapon(ctx) {
    var material = ctx.weaponDef.material || "water";
    var count, i, off, ix, iy, waterR, change, target;
    change = Terrain.subtractDisk(ctx.result.terrainGrid, ctx.x, ctx.y, ctx.r * 0.72, 1);
    trackTerrain(ctx, change);
    count = material === "water" ? Math.max(4, ctx.weaponDef.count || 5) : 1;
    for (i = 0; i < count; i++) {
      off = count <= 1 ? 0 : (i - (count - 1) / 2) * ctx.r * (material === "water" ? 1 : 0.38);
      ix = clamp(ctx.x + off, 0, WORLD_W);
      iy = ctx.y + ctx.r * (0.32 + hash01(i, ctx.state.turn, 18) * 0.28);
      waterR = ctx.r * (material === "water" ? 0.55 + hash01(i, ctx.state.turn, 19) * 0.18 : 0.72);
      change = Terrain.addDisk(ctx.result.terrainGrid, ix, iy, waterR, material);
      trackMaterial(ctx, change, material, ix, iy, waterR);
    }
    target = enemyTank(ctx);
    if (materialHas(material, "pinsTank") && target && tankNearImpact(target, ctx.x, ctx.y, ctx.r + 62)) {
      target.lockY = target.y;
      target.lockTurns = Math.max(target.lockTurns || 0, 1);
    }
    weaponImpact(ctx, { x: round1(ctx.x), y: round1(ctx.y), radius: ctx.r, type: "liquid", material: material, points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleFireWeapon(ctx) {
    var change = Terrain.subtractDisk(ctx.result.terrainGrid, ctx.x, ctx.y, ctx.r * (ctx.weaponDef.archetype === "lava" ? 0.38 : 0.46), 1);
    var bowl, count, spread, heat, i, off, ix, iy, surfaceY, scorchMat, cluster, hazard, capY, target, trapped, pooled, flatHeat, pitHeat;
    trackTerrain(ctx, change);
    bowl = bowlFactorAt(ctx.result.terrainGrid, ctx.x, ctx.r * 2.1);
    target = enemyTank(ctx);
    trapped = target && (target.lockTurns > 0 || target.pitTurns > 0) && tankNearImpact(target, ctx.x, ctx.y, Math.max(ctx.r * 3.2, target.pitRadius || 0));
    pooled = trapped || (bowl > 0.82 && !(ctx.sim.impact && ctx.sim.impact.hitTank));
    count = emberCountFor(ctx.weaponDef);
    spread = ctx.r * (ctx.weaponDef.archetype === "flamethrower" ? 2.55 : 2.1) * (pooled ? 0.2 : 1.85);
    flatHeat = (ctx.weaponDef.heat || 8) * (ctx.weaponDef.archetype === "lava" ? 0.52 : 0.44);
    pitHeat = (ctx.weaponDef.heat || 8) * (ctx.weaponDef.archetype === "lava" ? 1.24 : 1.12);
    heat = pooled ? pitHeat : flatHeat;
    for (i = 0; i < count; i++) {
      off = count <= 1 ? 0 : (i - (count - 1) / 2) / ((count - 1) / 2);
      if (trapped) {
        ix = target.x + off * spread + (hash01(i, ctx.state.turn, 11) - 0.5) * ctx.r * 0.12;
      } else if (ctx.weaponDef.archetype === "flamethrower" && !pooled) {
        ix = ctx.x + ctx.dir * (i + 0.4) * (spread / count);
      } else if (ctx.weaponDef.archetype === "flamethrower") {
        ix = ctx.x + off * spread * 0.62 + (hash01(i, ctx.state.turn, 11) - 0.5) * ctx.r * 0.1;
      } else {
        ix = ctx.x + off * spread + (hash01(i, ctx.state.turn, 11) - 0.5) * ctx.r * (pooled ? 0.1 : 0.82);
      }
      ix = clamp(ix, 18, WORLD_W - 18);
      surfaceY = Terrain.topYAt(ctx.result.terrainGrid, ix);
      if (trapped) iy = clamp(tankCenter(target).y + Math.sin(i * 1.3) * ctx.r * 0.22, 0, WORLD_H - 4);
      else iy = clamp(Math.max(surfaceY - 3, ctx.y + Math.sin(i * 1.3) * ctx.r * 0.08), 0, WORLD_H - 4);
      scorchMat = ctx.weaponDef.archetype === "lava" ? "lava" : "scorch";
      change = Terrain.addDisk(ctx.result.terrainGrid, ix, iy + ctx.r * 0.18, ctx.r * (ctx.weaponDef.archetype === "lava" ? (pooled ? 0.31 : 0.18) : (pooled ? 0.25 : 0.14)), scorchMat);
      trackTerrain(ctx, change);
      cluster = pooled ? Math.max(0.95, bowl * 1.45 + (trapped ? 0.55 : 0)) : Math.max(0, 0.04 - Math.abs(off) * 0.04);
      hazard = { id: "hazard-" + ctx.state.turn + "-" + i, x: round1(ix), y: round1(iy), r: round1(ctx.r * (ctx.weaponDef.archetype === "lava" ? (pooled ? 0.66 : 0.28) : ctx.weaponDef.archetype === "flamethrower" ? (pooled ? 0.5 : 0.22) : (pooled ? 0.56 : 0.24))), heat: round1(heat * (1 + cluster * 0.22)), turns: 2, kind: ctx.weaponDef.archetype === "lava" ? "lava" : "fire", owner: ctx.key, cluster: round1(cluster), exposure: pooled ? (trapped ? 1.72 : 1.42) : 0.24 };
      ctx.result.newHazards.push(hazard);
      Scoring.hazard(hazard, ctx.result.tanks, ctx.key, ctx.result.scoreDelta, ctx.result.burnTicks);
      weaponImpact(ctx, { x: round1(ix), y: round1(iy), radius: hazard.r, type: hazard.kind, material: hazard.kind, points: 0 });
    }
    if (ctx.weaponDef.dropDirt) {
      capY = Terrain.topYAt(ctx.result.terrainGrid, ctx.x) - ctx.r * 0.18;
      change = Terrain.addDisk(ctx.result.terrainGrid, ctx.x + ctx.dir * ctx.r * 0.24, capY, ctx.r * 0.38, "dirt");
      trackTerrain(ctx, change);
    }
  }

  function handleMowerWeapon(ctx) {
    var change = Terrain.mowBand(ctx.result.terrainGrid, ctx.x, ctx.r * 2.25, ctx.r * 1.15);
    var key, tank, center, lineChange, tankChange;
    trackTerrain(ctx, change);
    lineChange = Terrain.subtractLine(ctx.result.terrainGrid, ctx.x - ctx.r * 1.75, Terrain.topYAt(ctx.result.terrainGrid, ctx.x - ctx.r * 1.75) + ctx.r * 0.12, ctx.x + ctx.r * 1.75, Terrain.topYAt(ctx.result.terrainGrid, ctx.x + ctx.r * 1.75) + ctx.r * 0.12, ctx.r * 0.42);
    trackTerrain(ctx, lineChange);
    for (key in ctx.result.tanks) {
      tank = ctx.result.tanks[key];
      center = tankCenter(tank);
      if (tankNearImpact(tank, ctx.x, ctx.y, ctx.r * 2.25)) {
        tankChange = Terrain.subtractDisk(ctx.result.terrainGrid, center.x, center.y - 6, ctx.r * 0.86, 2);
        trackTerrain(ctx, tankChange);
        releaseTank(tank);
      }
    }
    extinguishHazards(ctx.result, ctx.x, ctx.y, ctx.r * 1.7, "dirt");
    weaponImpact(ctx, { x: round1(ctx.x), y: round1(ctx.y), radius: ctx.r * 1.35, type: "mower", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
  }

  function handleDefaultWeapon(ctx) {
    var change = Terrain.subtractDisk(ctx.result.terrainGrid, ctx.x, ctx.y, ctx.r, 1);
    trackTerrain(ctx, change);
    weaponImpact(ctx, { x: round1(ctx.x), y: round1(ctx.y), radius: ctx.r, type: "crater", material: "air", points: weaponImpactPoints(ctx.weaponDef) });
  }

  var WeaponHandlers = {
    blast: handleBlastWeapon,
    big_crater: handleBlastWeapon,
    crater_maker: handleTerrainMoverWeapon,
    earth_mover: handleTerrainMoverWeapon,
    dirtball: handleDirtballWeapon,
    cruball: handleCruballWeapon,
    wall: handleWallWeapon,
    dirt_slinger: handleDirtSlingerWeapon,
    concrete_donut: handleConcreteDonutWeapon,
    digger: handleTunnelWeapon,
    tunnel: handleTunnelWeapon,
    drillers: handleDrillersWeapon,
    laser: handleLaserWeapon,
    bunker_buster: handleBunkerBusterWeapon,
    splitter: handleSplitterWeapon,
    jackhammer: handleJackhammerWeapon,
    chain: handleChainWeapon,
    firecracker: handleChainWeapon,
    rain: handleRainWeapon,
    carpet: handleCarpetWeapon,
    homing: handleHomingWeapon,
    roller: handleRollingWeapon,
    skipper: handleRollingWeapon,
    torpedo: handleRollingWeapon,
    liquid: handleLiquidWeapon,
    fire: handleFireWeapon,
    lava: handleFireWeapon,
    flamethrower: handleFireWeapon,
    mower: handleMowerWeapon,
    default: handleDefaultWeapon,
  };

  function resolveTerrainWeapon(result, state, key, weaponDef, sim) {
    var ctx = makeWeaponContext(result, state, key, weaponDef, sim);
    var handler;
    if (!prepareWeaponContext(ctx)) return;
    handler = WeaponHandlers[ctx.weaponDef.archetype] || WeaponHandlers.default;
    handler(ctx);
  }

  function applyExistingHazards(result, key) {
    var next = [];
    var i, h, scoringHazard;
    for (i = 0; i < result.activeHazards.length; i++) {
      h = copy(result.activeHazards[i]);
      scoringHazard = copy(h);
      scoringHazard.heat = Math.max(1, (scoringHazard.heat || 1) * 0.42);
      scoringHazard.exposure = (scoringHazard.exposure || 1) * 0.72;
      scoringHazard.cluster = (scoringHazard.cluster || 0) * 0.7;
      hazardScore(scoringHazard, result.tanks, h.owner || key, result.scoreDelta, result.burnTicks);
      h.turns -= 1;
      h.heat = Math.max(1, h.heat - 2);
      if (h.turns > 0) next.push(h);
    }
    result.activeHazards = next;
  }

  var HazardSystem = {
    applyExisting: applyExistingHazards,
    extinguish: extinguishHazards,
    canExtinguish: extinguishesMaterial,
  };

  function moveTankForShot(state, key, move) {
    var next = copy(state);
    var fuel = next.moveFuel && next.moveFuel[key] !== undefined ? next.moveFuel[key] : START_MOVE_FUEL;
    var allowed = clamp(numberOr(move, 0), -MAX_TURN_MOVE, MAX_TURN_MOVE);
    if (next.tanks[key].lockTurns > 0) {
      allowed = 0;
      next.tanks[key].lockTurns -= 1;
      if (next.tanks[key].lockTurns <= 0) {
        releaseTank(next.tanks[key]);
      }
    }
    if (next.tanks[key].pitTurns > 0) {
      next.tanks[key].pitTurns -= 1;
      if (next.tanks[key].pitTurns <= 0) {
        delete next.tanks[key].pitTurns;
        delete next.tanks[key].pitRadius;
      }
    }
    var spent = Math.min(Math.abs(allowed), fuel);
    var signed = allowed < 0 ? -spent : spent;
    next.tanks[key].x = clamp(next.tanks[key].x + signed, 80, WORLD_W - 80);
    next.moveFuel[key] = Math.max(0, fuel - spent);
    settleTank(next.tanks[key], next.terrainGrid);
    return { state: next, move: signed, spent: spent };
  }

  var TankSystem = {
    settle: settleTank,
    settleAll: settleTanks,
    moveForShot: moveTankForShot,
  };

  function resolveShot(state, key, decision) {
    var weaponId = typeof decision.weapon === "string" ? decision.weapon : availableInventory(state, key)[0];
    var weaponDef = WeaponCatalog.fallback(weaponId);
    var savedAim = aimFor(state, key);
    var angle = clamp(numberOr(decision.angle, savedAim.angle), 5, 85);
    var power = clamp(numberOr(decision.power, savedAim.power), 20, 100);
    var moved = TankSystem.moveForShot(state, key, decision.move);
    var shotState = moved.state;
    var sim = ProjectileSim.forWeapon(shotState, key, angle, power, weaponDef);
    var result = {
      terrainGrid: copy(shotState.terrainGrid),
      tanks: copy(shotState.tanks),
      activeHazards: shotState.activeHazards ? copy(shotState.activeHazards) : [],
      newHazards: [],
      terrainOps: [],
      impacts: [],
      fragments: [],
      burnTicks: [],
      scoreTicks: [],
      extinguished: [],
      scoreDelta: { p1: 0, p2: 0 },
    };
    HazardSystem.applyExisting(result, key);
    resolveTerrainWeapon(result, shotState, key, weaponDef, sim);
    TankSystem.settleAll(result.tanks, result.terrainGrid);
    delete result.scoreDelta._hazardSpent;
    return {
      shotId: "shot-" + state.turn + "-" + key + "-" + weaponDef.id,
      actor: key,
      actorId: state.tanks[key].id,
      target: otherKey(key),
      weapon: weaponDef.id,
      weaponName: weaponDef.name,
      archetype: weaponDef.archetype,
      angle: angle,
      power: power,
      move: moved.move,
      moveSpent: moved.spent,
      wind: state.wind,
      start: sim.start,
      impact: sim.impact,
      trajectory: sim.trajectory,
      simTime: sim.time,
      impacts: result.impacts,
      fragments: result.fragments,
      terrainOps: result.terrainOps,
      burnTicks: result.burnTicks,
      scoreTicks: result.scoreTicks,
      terrainGrid: result.terrainGrid,
      tanks: result.tanks,
      activeHazards: result.activeHazards.concat(result.newHazards),
      extinguished: result.extinguished,
      scoreDelta: result.scoreDelta,
      note: typeof decision.note === "string" ? decision.note.slice(0, 140) : "",
      timeline: ShotTimeline.build(sim, result.impacts, result.terrainOps, result.burnTicks, result.scoreTicks, weaponDef, result.fragments, result.extinguished),
    };
  }

  function buildTimeline(sim, impacts, ops, burns, scoreTicks, weaponDef, fragments, extinguished) {
    var events = [];
    var groupedScores = [];
    var scoreByTarget = {};
    var i, flight, duration, impactStep, burnStep, burn, key, score, scoreDuration, splitAt, fragmentFlights, fragFlight, maxFragmentEnd, impactAt, quenched;
    flight = weaponDef.projectile === "direct" || weaponDef.archetype === "laser" ? 0.16 : clamp(0.52 + (sim.time || 0.4) * 0.28, 0.7, 1.55);
    splitAt = 0;
    fragmentFlights = [];
    maxFragmentEnd = flight;
    if (fragments && fragments.length) {
      splitAt = round1(flight * 0.58);
      for (i = 0; i < fragments.length; i++) {
        fragFlight = round1(clamp(0.24 + (fragments[i].time || 0.35) * 0.24, 0.32, 0.92));
        fragmentFlights[i] = fragFlight;
        maxFragmentEnd = Math.max(maxFragmentEnd, splitAt + fragFlight);
      }
      flight = round1(maxFragmentEnd);
    }
    impactStep = weaponDef.archetype === "flamethrower" ? 0.035 : 0.055;
    burnStep = 0.055;
    events.push({ at: 0, type: "launch", x: round1(sim.start.x), y: round1(sim.start.y), archetype: weaponDef.archetype });
    if (fragments && fragments.length) {
      events.push({ at: splitAt, type: "split", x: round1(fragments[0].start.x), y: round1(fragments[0].start.y), r: 18, archetype: weaponDef.archetype });
    } else {
      events.push({ at: round1(flight), type: "impact", x: round1(sim.impact.x), y: round1(sim.impact.y), archetype: weaponDef.archetype });
    }
    for (i = 0; i < impacts.length; i++) {
      impactAt = impacts[i].fragmentIndex !== undefined && fragmentFlights[impacts[i].fragmentIndex] !== undefined ? splitAt + fragmentFlights[impacts[i].fragmentIndex] : flight + 0.02 + i * impactStep;
      events.push({ at: round1(impactAt), type: impacts[i].type, x: impacts[i].x, y: impacts[i].y, r: impacts[i].radius, mat: impacts[i].material });
    }
    for (i = 0; i < (extinguished || []).length; i++) {
      quenched = extinguished[i];
      events.push({ at: round1(flight + 0.12 + i * 0.025), type: "extinguish", x: quenched.x, y: quenched.y, r: 18, mat: quenched.material || "water" });
    }

    function addScore(entry, lasting) {
      var target = entry.target || "unknown";
      var points = entry.points || 0;
      if (!points) return;
      if (!scoreByTarget[target]) {
        scoreByTarget[target] = { target: target, x: entry.x, y: entry.y, ticks: 0, points: 0, lasting: false, heat: 0 };
        groupedScores.push(scoreByTarget[target]);
      }
      scoreByTarget[target].points += points;
      scoreByTarget[target].ticks += Math.max(1, entry.ticks || Math.abs(points));
      scoreByTarget[target].lasting = scoreByTarget[target].lasting || !!lasting;
      scoreByTarget[target].heat = Math.max(scoreByTarget[target].heat || 0, entry.heat || 0);
      scoreByTarget[target].x = entry.x;
      scoreByTarget[target].y = entry.y;
    }

    for (i = 0; i < (scoreTicks || []).length; i++) addScore(scoreTicks[i], false);
    for (i = 0; i < burns.length; i++) {
      burn = burns[i];
      events.push({ at: round1(flight + 0.2 + i * burnStep), type: "burn", target: burn.target, x: burn.x, y: burn.y, ticks: burn.ticks, heat: burn.heat });
      addScore(burn, true);
    }
    scoreDuration = 0;
    for (i = 0; i < groupedScores.length; i++) {
      score = groupedScores[i];
      score.duration = score.lasting ? 2.15 : 1.05;
      scoreDuration = Math.max(scoreDuration, score.duration);
      events.push({ at: round1(flight + (score.lasting ? 0.28 : 0.12) + i * 0.08), type: "score", target: score.target, x: score.x, y: score.y, ticks: Math.max(3, Math.min(score.lasting ? 48 : 20, score.ticks || Math.abs(score.points))), points: score.points, duration: score.duration, lasting: score.lasting, heat: score.heat });
    }
    duration = Math.min(3.05, Math.max(flight + 0.42, flight + impacts.length * impactStep + burns.length * burnStep + 0.36, flight + 0.34 + scoreDuration));
    return { duration: round1(duration), flight: round1(flight), splitAt: splitAt, splitProgress: fragments && fragments.length ? 0.58 : 1, fragmentFlights: fragmentFlights, events: events, opCount: ops.length };
  }

  var ShotTimeline = {
    build: buildTimeline,
  };

  function historyLine(state, shot) {
    var delta = shot.scoreDelta[shot.actor] || 0;
    return tankName(state, shot.actor) + " fired " + shot.weaponName + " for " + (delta >= 0 ? "+" : "") + delta + " points.";
  }

  function makeDraftPool(ctx) {
    var configured = ctx && ctx.config && ctx.config.draftWeapons;
    var pool = [];
    var ids = [];
    var i, id, j, swap, random;
    if (configured && configured.length >= DRAFT_POOL_SIZE) {
      for (i = 0; i < DRAFT_POOL_SIZE; i++) {
        id = configured[i];
        if (WeaponCatalog.get(id)) ids.push(id);
      }
    }
    if (ids.length < DRAFT_POOL_SIZE) {
      ids = [];
      for (i = 0; i < WeaponCatalog.all().length; i++) ids.push(WeaponCatalog.all()[i].id);
      random = ctx && ctx.random ? ctx.random : null;
      for (i = ids.length - 1; i > 0; i--) {
        j = Math.floor(randomNext(random) * (i + 1));
        swap = ids[i];
        ids[i] = ids[j];
        ids[j] = swap;
      }
    }
    for (i = 0; i < DRAFT_POOL_SIZE; i++) pool.push({ slot: i, weapon: ids[i], owner: null, pick: null, loadoutSlot: null });
    return pool;
  }

  function loadoutsFromPool(pool) {
    var out = { p1: [], p2: [] };
    var i, item;
    for (i = 0; i < pool.length; i++) {
      item = pool[i];
      if (item.owner && out[item.owner] && out[item.owner].length < LOADOUT_SIZE) out[item.owner].push(item.weapon);
    }
    return out;
  }

  function draftPickCount(state) {
    var i, count;
    count = 0;
    if (!state || !state.draftPool) return count;
    for (i = 0; i < state.draftPool.length; i++) if (state.draftPool[i].owner) count += 1;
    return count;
  }

  function isDraftComplete(state) {
    return draftPickCount(state) >= DRAFT_POOL_SIZE && state.loadouts && state.loadouts.p1.length === LOADOUT_SIZE && state.loadouts.p2.length === LOADOUT_SIZE;
  }

  function autoAssignDraft(state) {
    var next = copy(state);
    var i, key, item;
    next.loadouts = { p1: [], p2: [] };
    for (i = 0; i < next.draftPool.length; i++) {
      key = i % 2 === 0 ? "p1" : "p2";
      item = next.draftPool[i];
      item.owner = key;
      item.pick = i + 1;
      item.loadoutSlot = next.loadouts[key].length + 1;
      next.loadouts[key].push(item.weapon);
    }
    return next;
  }

  function startBattle(state, decision) {
    var next;
    if (!state || state.phase !== "draft") return state;
    next = state;
    if (!isDraftComplete(next) && decision && decision.pick === DRAFT_POOL_SIZE) next = autoAssignDraft(next);
    if (!isDraftComplete(next)) return state;
    if (decision && decision.pick !== undefined && decision.pick !== draftPickCount(next) && decision.pick !== DRAFT_POOL_SIZE) return state;
    next = copy(next);
    next.phase = "battle";
    next.currentIndex = 0;
    next.wind = windFor(0, next.terrainKey);
    next.history = ["Weapons drafted. Battle begins."];
    return next;
  }

  function pickDraftWeapon(state, key, decision) {
    var slot = typeof decision.slot === "number" ? decision.slot : -1;
    var next, item, i;
    if (!state || state.phase !== "draft") return state;
    if (state.loadouts[key].length >= LOADOUT_SIZE) return state;
    if (slot < 0 || slot >= state.draftPool.length || state.draftPool[slot].owner || (decision.weapon && state.draftPool[slot].weapon !== decision.weapon)) {
      slot = -1;
      for (i = 0; i < state.draftPool.length; i++) {
        if (!state.draftPool[i].owner) {
          slot = i;
          break;
        }
      }
    }
    if (slot < 0) return state;
    next = copy(state);
    item = next.draftPool[slot];
    if (item.owner) return state;
    item.owner = key;
    item.pick = draftPickCount(next);
    item.loadoutSlot = next.loadouts[key].length + 1;
    next.loadouts[key].push(item.weapon);
    next.history = next.history.slice(Math.max(0, next.history.length - 7));
    next.history.push(tankName(next, key) + " drafted " + ((WeaponCatalog.get(item.weapon) && WeaponCatalog.get(item.weapon).name) || item.weapon) + ".");
    if (isDraftComplete(next)) return startBattle(next, { pick: DRAFT_POOL_SIZE });
    next.currentIndex = (next.currentIndex + 1) % 2;
    return next;
  }

  function randomAllDraft(state, key) {
    var next;
    if (!state || state.phase !== "draft") return state;
    if (key !== "p1" || draftPickCount(state) !== 0) return state;
    next = autoAssignDraft(state);
    next.history = next.history.slice(Math.max(0, next.history.length - 7));
    next.history.push(tankName(next, key) + " randomized all weapons.");
    return startBattle(next, { pick: DRAFT_POOL_SIZE });
  }

  function weaponInLoadout(state, key, id) {
    return !!(state.loadouts && state.loadouts[key] && state.loadouts[key].indexOf(id) >= 0);
  }

  function weaponUsed(state, key, id) {
    return !!(state.usedWeapons && state.usedWeapons[key] && state.usedWeapons[key].indexOf(id) >= 0);
  }

  function availableInventory(state, key) {
    var ids = state.loadouts && state.loadouts[key] ? state.loadouts[key] : [];
    var out = [];
    var i;
    for (i = 0; i < ids.length; i++) if (!weaponUsed(state, key, ids[i])) out.push(ids[i]);
    return out;
  }

  function publicTank(tank) {
    return { id: tank.id, name: tank.name, x: round1(tank.x), y: round1(tank.y), slope: round3(tank.slope || 0), color: tank.color, moveFuel: tank.moveFuel || 0, trappedTurns: tank.lockTurns || 0, pitTurns: tank.pitTurns || 0, buriedMaterial: tank.buriedMaterial || "", buriedRadius: round1(tank.buriedRadius || 0) };
  }

  function publicWeapons() {
    var out = {};
    var i, w;
    var list = WeaponCatalog.all();
    for (i = 0; i < list.length; i++) {
      w = list[i];
      out[w.id] = { id: w.id, name: w.name, archetype: w.archetype, points: w.points, impactPoints: w.impactPoints, maxImpactScore: w.maxImpactScore, scoreMode: w.scoreMode, scoreLabel: w.scoreLabel, pieceCount: w.pieceCount, radius: w.radius, tags: w.tags, material: w.material, description: w.description };
    }
    return out;
  }

  function terrainTopArray(grid) {
    var out = [];
    var i;
    for (i = 0; i < GRID_W; i++) out.push(topYAt(grid, i * CELL));
    return out;
  }

  function shotOptionsFor(state, key) {
    var inventory = availableInventory(state, key);
    var aim = aimFor(state, key);
    var options = [];
    var i, id, w;
    for (i = 0; i < inventory.length; i++) {
      id = inventory[i];
      w = WeaponCatalog.get(id);
      options.push({
        decision: { type: "fire", weapon: id, move: 0, angle: aim.angle, power: aim.power, note: "Use " + (w ? w.name : id) + "." },
        label: (w ? w.name : id) + " - " + (w ? w.archetype : "weapon"),
        required: true,
        schema: {
          fields: {
            weapon: { kind: "enum", values: inventory.slice() },
            move: { kind: "number", min: -Math.min(MAX_TURN_MOVE, state.moveFuel[key] || 0), max: Math.min(MAX_TURN_MOVE, state.moveFuel[key] || 0) },
            angle: { kind: "number", min: 5, max: 85 },
            power: { kind: "number", min: 20, max: 100 },
            note: { kind: "string", freeText: true, minLength: 0, maxLength: 140 },
          },
        },
      });
    }
    return options;
  }

  function draftOptionsFor(state, key) {
    var options = [];
    var i, item, w;
    if (key === "p1" && draftPickCount(state) === 0) {
      options.push({
        decision: { type: "draft_random_all" },
        label: "Random All - deal ten weapons to each tank",
        required: true,
        schema: { fields: {} },
      });
    }
    for (i = 0; i < state.draftPool.length; i++) {
      item = state.draftPool[i];
      if (item.owner) continue;
      w = WeaponCatalog.get(item.weapon);
      options.push({
        decision: { type: "draft_pick", slot: item.slot, weapon: item.weapon },
        label: (w ? w.name : item.weapon) + " - " + (w ? w.archetype : "weapon"),
        required: true,
        schema: {
          fields: {
            slot: { kind: "number", min: 0, max: DRAFT_POOL_SIZE - 1 },
            weapon: { kind: "enum", values: [item.weapon] },
          },
        },
      });
    }
    return options;
  }

  function chatOpportunities() {
    return [
      {
        id: "chat:room",
        kind: "chat",
        prompt: "Chat in the room.",
        decision: { type: "none" },
        chat: { channels: ["room"], defaultChannel: "room", canSend: true, memberships: [] },
        submitPolicy: "multiple",
      },
    ];
  }

  function decisionOf(action) {
    return action && action.decision ? action.decision : action;
  }

  return {
    rules: { visibility: "public", spectator: "god-view", seats: { eliminated: "player-view", disconnected: "player-view" } },

    setup: function (ctx) {
      var sourcePlayers = ctx && ctx.players ? ctx.players : [{ id: "p1", name: "Player 1" }, { id: "p2", name: "Player 2" }];
      var players = [sourcePlayers[0].id, sourcePlayers[1].id];
      var playerNames = {};
      var generated = generateTerrain(ctx || {});
      var draftPool = makeDraftPool(ctx || {});
      var loadouts = loadoutsFromPool(draftPool);
      var tanks;
      playerNames[players[0]] = sourcePlayers[0].name || players[0];
      playerNames[players[1]] = sourcePlayers[1].name || players[1];
      tanks = {
        p1: { id: players[0], name: playerNames[players[0]], x: 220, y: 0, color: "#d91e18" },
        p2: { id: players[1], name: playerNames[players[1]], x: 1380, y: 0, color: "#f2a51a" },
      };
      settleTanks(tanks, generated.grid);
      tanks.p1.moveFuel = START_MOVE_FUEL;
      tanks.p2.moveFuel = START_MOVE_FUEL;
      return {
        phase: "draft",
        players: players,
        playerNames: playerNames,
        currentIndex: 0,
        turn: 0,
        wind: windFor(0, generated.key),
        terrainKey: generated.key,
        terrainGrid: generated.grid,
        terrain: terrainTopArray(generated.grid),
        tanks: tanks,
        scores: { p1: 0, p2: 0 },
        draftPool: draftPool,
        loadouts: loadouts,
        usedWeapons: { p1: [], p2: [] },
        moveFuel: { p1: START_MOVE_FUEL, p2: START_MOVE_FUEL },
        aim: { p1: { angle: 45, power: 82 }, p2: { angle: 45, power: 82 } },
        activeHazards: [],
        history: [],
        lastShot: null,
        winner: null,
        draw: false,
      };
    },

    apply: function (state, actorId, action) {
      var decision = decisionOf(action);
      var key = keyForPlayer(state, actorId);
      var expected = PLAYER_KEYS[state.currentIndex || 0];
      var next, shot, i, p1Score, p2Score, inventory;
      if (!decision) return state;
      if (actorId === "__system__") {
        if (decision.type === "start_battle") return startBattle(state, decision);
        return state;
      }
      if (!key || key !== expected) return state;
      if (state.winner || state.draw || state.phase === "gameOver") return state;
      if (state.phase === "draft") {
        if (decision.type === "draft_random_all") return randomAllDraft(state, key);
        if (decision.type === "draft_pick") return pickDraftWeapon(state, key, decision);
        return state;
      }
      if (state.phase !== "battle" || decision.type !== "fire") return state;
      if (!weaponInLoadout(state, key, decision.weapon) || weaponUsed(state, key, decision.weapon)) {
        inventory = availableInventory(state, key);
        if (!inventory.length) return state;
        decision = copy(decision);
        decision.weapon = inventory[0];
      }
      next = copy(state);
      shot = resolveShot(next, key, decision);
      next.terrainGrid = shot.terrainGrid;
      next.terrain = terrainTopArray(next.terrainGrid);
      next.tanks = shot.tanks;
      next.moveFuel[key] = Math.max(0, (next.moveFuel[key] || 0) - Math.abs(shot.moveSpent || 0));
      next.tanks.p1.moveFuel = next.moveFuel.p1;
      next.tanks.p2.moveFuel = next.moveFuel.p2;
      next.activeHazards = shot.activeHazards;
      next.scores.p1 += shot.scoreDelta.p1 || 0;
      next.scores.p2 += shot.scoreDelta.p2 || 0;
      next.aim[key] = { angle: shot.angle, power: shot.power };
      next.usedWeapons[key] = next.usedWeapons[key].concat([shot.weapon]);
      next.lastShot = {
        shotId: shot.shotId,
        actor: shot.actor,
        actorId: shot.actorId,
        target: shot.target,
        weapon: shot.weapon,
        weaponName: shot.weaponName,
        archetype: shot.archetype,
        angle: shot.angle,
        power: shot.power,
        move: shot.move,
        wind: shot.wind,
        start: shot.start,
        impact: shot.impact,
        trajectory: shot.trajectory,
        simTime: shot.simTime,
        impacts: shot.impacts,
        fragments: shot.fragments,
        terrainOps: shot.terrainOps,
        burnTicks: shot.burnTicks,
        extinguished: shot.extinguished,
        scoreDelta: shot.scoreDelta,
        score: { delta: shot.scoreDelta, p1: next.scores.p1, p2: next.scores.p2 },
        timeline: shot.timeline,
        note: shot.note,
      };
      next.history = next.history.slice(Math.max(0, next.history.length - 7));
      next.history.push(historyLine(next, shot));
      next.turn += 1;
      if (next.turn >= MAX_TURNS || availableInventory(next, "p1").length + availableInventory(next, "p2").length === 0) {
        p1Score = next.scores.p1 || 0;
        p2Score = next.scores.p2 || 0;
        if (p1Score === p2Score) next.draw = true;
        else next.winner = p1Score > p2Score ? next.tanks.p1.id : next.tanks.p2.id;
        next.phase = "gameOver";
      } else {
        for (i = 0; i < PLAYER_KEYS.length; i++) {
          next.currentIndex = (next.currentIndex + 1) % 2;
          if (availableInventory(next, PLAYER_KEYS[next.currentIndex]).length > 0) break;
        }
        next.wind = windFor(next.turn, next.terrainKey);
        next.phase = "battle";
      }
      return next;
    },

    project: function (state, viewerId) {
      var currentKey = PLAYER_KEYS[state.currentIndex || 0];
      var currentPlayer = state.tanks[currentKey].id;
      var viewerKey = keyForPlayer(state, viewerId);
      var view = {
        slug: "arc-tanks-deluxe",
        title: "Arc Tanks Deluxe",
        phase: state.phase,
        turnNumber: state.turn,
        maxTurns: MAX_TURNS,
        currentPlayer: currentPlayer,
        currentPlayerName: playerName(state, currentPlayer),
        currentKey: currentKey,
        wind: state.wind,
        world: publicWorld(),
        terrainGrid: copy(state.terrainGrid),
        terrain: state.terrain ? state.terrain.slice() : terrainTopArray(state.terrainGrid),
        activeHazards: state.activeHazards ? copy(state.activeHazards) : [],
        scores: copy(state.scores),
        draftPool: copy(state.draftPool),
        loadouts: copy(state.loadouts),
        usedWeapons: copy(state.usedWeapons),
        moveFuel: copy(state.moveFuel),
        aim: { p1: aimFor(state, "p1"), p2: aimFor(state, "p2") },
        draft: { picksMade: draftPickCount(state), picksTotal: DRAFT_POOL_SIZE, loadoutSize: LOADOUT_SIZE, complete: isDraftComplete(state), auto: false, nextPickKey: state.phase === "draft" ? currentKey : null },
        inventory: { p1: availableInventory(state, "p1"), p2: availableInventory(state, "p2") },
        tanks: { p1: publicTank(state.tanks.p1), p2: publicTank(state.tanks.p2) },
        weapons: publicWeapons(),
        weaponCount: WeaponCatalog.count(),
        allWeaponsUnlocked: true,
        lastShot: state.lastShot ? copy(state.lastShot) : null,
        history: state.history.slice(Math.max(0, state.history.length - 6)),
        winner: state.winner,
        winnerName: state.winner ? playerName(state, state.winner) : null,
        draw: !!state.draw,
      };
      if (viewerKey) view.yourKey = viewerKey;
      return { view: view, agentView: this.agentView(state, viewerId) };
    },

    agentView: function (state, viewerId) {
      var key = keyForPlayer(state, viewerId) || PLAYER_KEYS[state.currentIndex || 0];
      var currentKey = PLAYER_KEYS[state.currentIndex || 0];
      var lines = [];
      lines.push("Arc Tanks Deluxe. You are " + tankName(state, key) + " (" + key + "). Current turn: " + tankName(state, currentKey) + ".");
      lines.push("Score: " + tankName(state, "p1") + " " + state.scores.p1 + "; " + tankName(state, "p2") + " " + state.scores.p2 + ". Wind " + state.wind + ". Aim " + aimFor(state, key).angle + "/" + aimFor(state, key).power + ". Move fuel " + state.moveFuel[key] + ".");
      if (state.phase === "draft") {
        lines.push("Weapon shop: twenty random unlocked weapons are available. P1 may Random All immediately, or players can alternate picks until each side has ten weapons.");
        lines.push("Your drafted weapons: " + (state.loadouts[key].length ? state.loadouts[key].join(", ") : "none yet") + ".");
        lines.push('Legal JSON on your draft turn: {"type":"draft_random_all"} or {"type":"draft_pick","slot":0,"weapon":"single_shot"}.');
        return lines.join("\n");
      }
      lines.push('Legal JSON: {"type":"fire","weapon":"single_shot","move":0,"angle":45,"power":82,"note":"brief plan"}. Angle and power persist. There is no trajectory preview.');
      lines.push("Unused weapons: " + availableInventory(state, key).join(", ") + ".");
      if (state.lastShot) lines.push("Last shot: " + state.history[state.history.length - 1]);
      return lines.join("\n");
    },

    opportunities: function (state, actorId) {
      var key = keyForPlayer(state, actorId);
      var currentKey = PLAYER_KEYS[state.currentIndex || 0];
      var options;
      if (state.winner || state.draw || state.phase === "gameOver") return [];
      if (actorId === "__system__") {
        if (state.phase === "draft" && isDraftComplete(state)) {
          return [{ id: "weapon-select", kind: "phase", prompt: "Show drafted weapon loadouts before battle.", decision: { type: "none" }, deadline: { id: "weapon-select:" + draftPickCount(state), timeoutMs: SELECT_MS, onExpire: { type: "start_battle", pick: draftPickCount(state) } }, submitPolicy: "once" }];
        }
        return [];
      }
      if (!key) return [];
      if (state.phase === "draft") {
        if (key !== currentKey) return chatOpportunities();
        options = draftOptionsFor(state, key);
        if (!options.length) return chatOpportunities();
        return [{ id: "draft-pick", kind: "turn", prompt: tankName(state, key) + ", pick one weapon for your ten-weapon loadout.", decision: { type: "choose", options: options }, deadline: { id: "draft:" + draftPickCount(state), timeoutMs: TURN_MS, onExpire: options[0].decision }, chat: { channels: ["room"], defaultChannel: "room", canSend: true, memberships: [] } }];
      }
      if (key !== currentKey) return chatOpportunities();
      options = shotOptionsFor(state, key);
      if (!options.length) return chatOpportunities();
      return [{ id: "fire", kind: "turn", prompt: tankName(state, key) + ", choose weapon, move, angle, and power.", decision: { type: "choose", options: options }, deadline: { id: "fire:" + state.turn, timeoutMs: TURN_MS, onExpire: options[0].decision }, chat: { channels: ["room"], defaultChannel: "room", canSend: true, memberships: [] } }];
    },

    validate: function (state, actorId, action) {
      var decision = decisionOf(action);
      var key = keyForPlayer(state, actorId);
      var currentKey = PLAYER_KEYS[state.currentIndex || 0];
      if (actorId === "__system__") {
        if (state.phase === "draft" && decision && decision.type === "start_battle" && (decision.pick === draftPickCount(state) || decision.pick === DRAFT_POOL_SIZE)) return { ok: true };
        return { ok: false, error: "No system action is available.", code: "bad_system" };
      }
      if (!key || key !== currentKey) return { ok: false, error: "It is not your turn.", code: "not_turn" };
      if (state.phase === "draft") {
        if (decision && decision.type === "draft_random_all") {
          if (key === "p1" && draftPickCount(state) === 0) return { ok: true };
          return { ok: false, error: "Random All is only available to Player 1 before any weapons are picked.", code: "random_all_unavailable" };
        }
        if (!decision || decision.type !== "draft_pick") return { ok: false, error: "Pick one weapon from the shop.", code: "bad_draft_action" };
        if (typeof decision.slot !== "number" || !state.draftPool[decision.slot] || state.draftPool[decision.slot].owner) return { ok: false, error: "That weapon has already been picked.", code: "draft_unavailable" };
        if (decision.weapon && state.draftPool[decision.slot].weapon !== decision.weapon) return { ok: false, error: "Draft slot and weapon do not match.", code: "draft_mismatch" };
        return { ok: true };
      }
      if (!decision || decision.type !== "fire") return { ok: false, error: "Submit a fire action.", code: "bad_action" };
      if (decision.weapon && !WeaponCatalog.get(decision.weapon)) return { ok: false, error: "Unknown weapon id.", code: "bad_weapon" };
      if (!weaponInLoadout(state, key, decision.weapon) || weaponUsed(state, key, decision.weapon)) return { ok: false, error: "Weapon is not available in your drafted loadout.", code: "weapon_unavailable" };
      return { ok: true };
    },

    outcome: function (state) {
      if (state.phase !== "gameOver") return null;
      if (state.draw) return { type: "draw", playerIds: [], summary: "The duel ends tied on points." };
      if (state.winner) return { type: "winners", playerIds: [state.winner], summary: playerName(state, state.winner) + " wins Arc Tanks Deluxe on points after " + state.turn + " shots." };
      return null;
    },

    constants: {
      world: publicWorld(),
      maxTurns: MAX_TURNS,
      shotsPerPlayer: SHOTS_PER_PLAYER,
      loadoutSize: LOADOUT_SIZE,
      draftPoolSize: DRAFT_POOL_SIZE,
      weaponIds: WeaponCatalog.all().map(function (w) { return w.id; }),
      weapons: WEAPONS_BY_ID,
      materials: PALETTE,
    },

    _test: {
      generateTerrain: generateTerrain,
      topYAt: topYAt,
      materialAt: materialAt,
      subtractDisk: subtractDisk,
      addDisk: addDisk,
      subtractLine: subtractLine,
      resolveShot: resolveShot,
      weaponCount: function () { return WeaponCatalog.count(); },
    },
  };
})();

if (typeof module !== "undefined") {
  module.exports = GameLogic;
  module.exports.GameLogic = GameLogic;
}
