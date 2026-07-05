(function() {
  var FALLBACK_WORLD_W = 1600;
  var FALLBACK_WORLD_H = 900;
  var FALLBACK_TANK_DRAW_SCALE = 1.28;
  var MATERIAL_COLORS = {
    dirt: "#187b22",
    bouncy: "#33d6ff",
    glue: "#77d8ff",
    concrete: "#8a8d91",
    water: "#1788ff",
    lava: "#ff4a12",
    scorch: "#2e1d17",
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function worldInfo(view) {
    var world = view && view.world ? view.world : {};
    var grid = view && view.terrainGrid ? view.terrainGrid : {};
    return {
      width: world.width || grid.width || FALLBACK_WORLD_W,
      height: world.height || grid.height || FALLBACK_WORLD_H,
      tankDrawScale: world.tankDrawScale || FALLBACK_TANK_DRAW_SCALE,
    };
  }

  function clearLayer(container) {
    var child;
    while (container.children.length > 0) {
      child = container.removeChildAt(0);
      if (child && child.destroy) child.destroy({ children: true, texture: true, textureSource: true });
    }
  }

  function hexNumber(value) {
    if (typeof value === "number") return value;
    return Number.parseInt(String(value || "#ffffff").replace("#", ""), 16);
  }

  function terrainCellColor(mat, col, row) {
    var base = MATERIAL_COLORS[mat] || "#187b22";
    var n = ArcTanksEffects.hash01(col, row, mat.length);
    if (mat === "dirt") {
      if (row < 60) return "#1c842e";
      if (row < 82) return "#125f24";
      return "#0d421b";
    }
    if (mat === "concrete") return n > 0.86 ? "#777d7b" : "#5f6865";
    if (mat === "bouncy") return n > 0.84 ? "#8ef7ff" : "#22c7f2";
    if (mat === "scorch") return n > 0.78 ? "#46261c" : base;
    return base;
  }

  function materialTint(mat) {
    return hexNumber(MATERIAL_COLORS[mat] || MATERIAL_COLORS.dirt);
  }

  function edgePalette(mat) {
    if (mat === "bouncy") return { top: "#c8fbff", mid: "#27d4ff", side: "#087a96" };
    if (mat === "glue") return { top: "#dcfbff", mid: "#71dfff", side: "#19799a" };
    if (mat === "concrete") return { top: "#c7c9c9", mid: "#858b8a", side: "#4e5554" };
    if (mat === "water") return { top: "#a8edff", mid: "#2da8ff", side: "#0c4d9c" };
    if (mat === "lava") return { top: "#ffe066", mid: "#ff6b1a", side: "#7f1600" };
    if (mat === "scorch") return { top: "#6a3a25", mid: "#3a2118", side: "#1c100d" };
    return { top: "#83d06a", mid: "#0c4c19", side: "#062f13" };
  }

  function hasCell(cells, x, y) {
    return !!(cells[y] && cells[y][x]);
  }

  function drawTerrainEdges(ctx, cells, cell, cols, rows) {
    var x, y, mat, px, py, colors;
    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        mat = cells[y][x];
        if (!mat) continue;
        px = x * cell;
        py = y * cell;
        colors = edgePalette(mat);
        if (!hasCell(cells, x, y - 1)) {
          ctx.fillStyle = colors.top;
          ctx.fillRect(px, py, cell, 2);
          ctx.fillStyle = colors.mid;
          ctx.fillRect(px, py + 2, cell, 2);
        }
        if (!hasCell(cells, x - 1, y)) {
          ctx.fillStyle = colors.side;
          ctx.fillRect(px, py + 1, 2, cell - 1);
        }
        if (!hasCell(cells, x + 1, y)) {
          ctx.fillStyle = colors.side;
          ctx.fillRect(px + cell - 2, py + 1, 2, cell - 1);
        }
        if (!hasCell(cells, x, y + 1)) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
          ctx.fillRect(px, py + cell - 2, cell, 2);
        }
      }
    }
  }

  function makeParticleTexture() {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    canvas.width = 16;
    canvas.height = 16;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, Math.PI * 2);
    ctx.fill();
    return PIXI.Texture.from(canvas);
  }

  function sampleTrajectory(points, progress) {
    var span, index, frac, a, b, angle, endTime, targetTime, i, denom;
    if (!points || !points.length) return { x: 0, y: 0, angle: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };
    endTime = points[points.length - 1].t;
    if (typeof endTime === "number" && endTime > 0) {
      targetTime = clamp(progress, 0, 1) * endTime;
      for (i = 0; i < points.length - 1; i++) {
        if (points[i + 1].t >= targetTime) {
          a = points[i];
          b = points[i + 1];
          denom = Math.max(0.001, (b.t || 0) - (a.t || 0));
          frac = clamp((targetTime - (a.t || 0)) / denom, 0, 1);
          angle = Math.atan2(b.y - a.y, b.x - a.x);
          return {
            x: a.x + (b.x - a.x) * frac,
            y: a.y + (b.y - a.y) * frac,
            angle: angle,
          };
        }
      }
    }
    span = clamp(progress, 0, 1) * (points.length - 1);
    index = Math.min(points.length - 2, Math.floor(span));
    frac = span - index;
    a = points[index];
    b = points[index + 1];
    angle = Math.atan2(b.y - a.y, b.x - a.x);
    return {
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
      angle: angle,
    };
  }

  function playbackFlight(shot) {
    var flight = shot && shot.timeline && shot.timeline.flight ? shot.timeline.flight : 0;
    var i, event;
    if (!flight && shot && shot.timeline && shot.timeline.events) {
      for (i = 0; i < shot.timeline.events.length; i++) {
        event = shot.timeline.events[i];
        if (event.type === "impact") flight = event.at || flight;
      }
    }
    return Math.max(0.18, flight || 0.45);
  }

  function projectileColor(shot) {
    if (!shot) return 0xffd166;
    if (shot.archetype === "fire" || shot.archetype === "flamethrower") return 0xff7a1f;
    if (shot.archetype === "lava") return 0xff2e00;
    if (shot.archetype === "liquid") return 0x43b8ff;
    if (shot.archetype === "dirtball" || shot.archetype === "dirt_slinger" || shot.archetype === "cruball") return 0x58b957;
    if (shot.archetype === "laser") return 0xa8f7ff;
    if (shot.archetype === "bunker_buster") return 0xfff0a3;
    if (shot.archetype === "drillers") return 0xd8c3a5;
    return 0xffd166;
  }

  function ordinal(value) {
    var n = Math.max(1, Math.floor(value));
    var mod = n % 100;
    if (mod >= 11 && mod <= 13) return n + "th";
    if (n % 10 === 1) return n + "st";
    if (n % 10 === 2) return n + "nd";
    if (n % 10 === 3) return n + "rd";
    return n + "th";
  }

  function copyTank(tank) {
    var out = {};
    var key;
    for (key in tank || {}) out[key] = tank[key];
    return out;
  }

  function copyAim(aim) {
    return { angle: aim && aim.angle !== undefined ? aim.angle : 45, power: aim && aim.power !== undefined ? aim.power : 82 };
  }

  function makeFlightView(previousView, finalView, shot) {
    var view = {};
    var key;
    if (!previousView || !finalView || !shot) return finalView;
    for (key in previousView) view[key] = previousView[key];
    view.tanks = { p1: copyTank(previousView.tanks && previousView.tanks.p1), p2: copyTank(previousView.tanks && previousView.tanks.p2) };
    view.aim = { p1: copyAim(previousView.aim && previousView.aim.p1), p2: copyAim(previousView.aim && previousView.aim.p2) };
    view.scores = previousView.scores ? { p1: previousView.scores.p1 || 0, p2: previousView.scores.p2 || 0 } : { p1: 0, p2: 0 };
    view.activeHazards = previousView.activeHazards ? previousView.activeHazards.slice() : [];
    if (finalView.tanks && finalView.tanks[shot.actor]) view.tanks[shot.actor] = copyTank(finalView.tanks[shot.actor]);
    if (shot.actor && view.aim[shot.actor]) view.aim[shot.actor] = { angle: shot.angle, power: shot.power };
    return view;
  }

  function ArcTanksRenderer(container) {
    this.container = container;
    this.app = null;
    this.ready = false;
    this.pending = null;
    this.previousBattleView = null;
    this.worldLayer = null;
    this.skyLayer = null;
    this.terrainLayer = null;
    this.tankLayer = null;
    this.fxLayer = null;
    this.effectLayer = null;
    this.projectileLayer = null;
    this.hudLayer = null;
    this.screenFxLayer = null;
    this.particleLayer = null;
    this.particleTexture = null;
    this.particles = [];
    this.effects = [];
    this.shotPlayback = null;
    this.hazardEmitClock = 0;
    this.hazardPulse = 0;
    this.tankBodies = {};
    this.lastTerrainVersion = -1;
    this.lastHazardKey = "";
    this.lastShotId = "";
    this.layout = { w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
  }

  ArcTanksRenderer.prototype.init = function() {
    var self = this;
    if (!window.PIXI) {
      document.getElementById("fallback").style.display = "grid";
      return;
    }
    this.app = new PIXI.Application();
    this.app
      .init({ resizeTo: window, backgroundAlpha: 0, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
      .then(function() {
        self.container.appendChild(self.app.canvas);
        self.skyLayer = new PIXI.Container();
        self.worldLayer = new PIXI.Container();
        self.terrainLayer = new PIXI.Container();
        self.tankLayer = new PIXI.Container();
        self.fxLayer = new PIXI.Container();
        self.effectLayer = new PIXI.Container();
        self.projectileLayer = new PIXI.Container();
        self.hudLayer = new PIXI.Container();
        self.screenFxLayer = new PIXI.Container();
        self.fxLayer.addChild(self.effectLayer, self.projectileLayer);
        self.worldLayer.addChild(self.terrainLayer, self.tankLayer, self.fxLayer);
        self.app.stage.addChild(self.skyLayer, self.worldLayer, self.hudLayer, self.screenFxLayer);
        self.particleTexture = makeParticleTexture();
        if (PIXI.ParticleContainer && PIXI.Particle) {
          self.particleLayer = new PIXI.ParticleContainer({
            texture: self.particleTexture,
            boundsArea: new PIXI.Rectangle(0, 0, FALLBACK_WORLD_W, FALLBACK_WORLD_H),
            dynamicProperties: { position: true, rotation: true, color: true, vertex: true },
          });
          self.fxLayer.addChild(self.particleLayer);
        }
        self.app.ticker.add(function(ticker) { self.tick(ticker.deltaMS / 1000); });
        window.addEventListener("resize", function() { self.layoutStage(self.pending); self.render(self.pending); });
        self.ready = true;
        window.__arcTanksRenderer = self;
        if (self.pending) self.render(self.pending);
        return undefined;
      });
  };

  ArcTanksRenderer.prototype.layoutStage = function(view) {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    var actionPanel = document.getElementById("action-panel");
    var bottom = 0;
    var topMargin = w < 560 ? 50 : 62;
    var availableH;
    var rect;
    var portrait;
    var visibleWorldW;
    var halfVisible;
    var centerX;
    var world = worldInfo(view);
    if (actionPanel && !actionPanel.hidden) {
      rect = actionPanel.getBoundingClientRect();
      bottom = rect.height;
    }
    availableH = Math.max(260, (window.innerHeight || h) - bottom - topMargin - 6);
    portrait = w < 640 && h > w * 1.15;
    if (this.particleLayer) this.particleLayer.boundsArea = new PIXI.Rectangle(0, 0, world.width, world.height);
    if (portrait) {
      visibleWorldW = world.width * 0.85;
      this.layout.scale = Math.max(w / world.width, Math.min(w / visibleWorldW, availableH / (world.height * 0.84)));
      halfVisible = (w / this.layout.scale) / 2;
      centerX = world.width / 2;
      if (view && view.tanks && view.tanks.p1 && view.tanks.p2) {
        centerX = (view.tanks.p1.x + view.tanks.p2.x) / 2;
      } else if (view && view.lastShot && view.lastShot.impact) {
        centerX = view.lastShot.impact.x || centerX;
      }
      centerX = clamp(centerX, halfVisible, world.width - halfVisible);
      this.layout.ox = w / 2 - centerX * this.layout.scale;
      this.layout.oy = (window.innerHeight || h) - bottom - world.height * this.layout.scale - 6;
      if (this.layout.oy < topMargin) this.layout.oy = topMargin;
    } else {
      this.layout.scale = w / world.width;
      if (this.layout.scale > availableH / (world.height * 0.71)) this.layout.scale = availableH / (world.height * 0.71);
      this.layout.ox = (w - world.width * this.layout.scale) / 2;
      this.layout.oy = (window.innerHeight || h) - bottom - world.height * this.layout.scale - 6;
      if (this.layout.oy > topMargin) this.layout.oy = topMargin;
    }
    this.layout.w = w;
    this.layout.h = window.innerHeight;
    if (this.worldLayer) {
      this.worldLayer.scale.set(this.layout.scale);
      this.worldLayer.position.set(this.layout.ox, this.layout.oy);
    }
  };

  ArcTanksRenderer.prototype.render = function(view) {
    var displayView, hazardKey, terrainVersion, newShot;
    if (!view) return;
    this.pending = view;
    if (!this.ready) return;
    this.layoutStage(view);
    this.drawSky();
    terrainVersion = view.terrainGrid ? view.terrainGrid.version : -1;
    hazardKey = JSON.stringify(view.activeHazards || []);
    newShot = view.lastShot && view.lastShot.shotId !== this.lastShotId;
    if (newShot) {
      this.lastShotId = view.lastShot.shotId;
      this.startShotPlayback(view.lastShot, this.previousBattleView, view);
    } else if (!this.shotPlayback || this.shotPlayback.terrainSwapped) {
      if (!this._terrainSprite || this.lastTerrainVersion !== terrainVersion || this.lastHazardKey !== hazardKey) {
        this.drawTerrain(view);
      }
    }
    displayView = this.shotPlayback && !this.shotPlayback.terrainSwapped ? this.shotPlayback.flightView || view : view;
    this.drawTanks(displayView);
    this.drawHud(displayView);
    if (view.phase === "battle") {
      if (!this.shotPlayback) this.previousBattleView = view;
    } else this.previousBattleView = null;
  };

  ArcTanksRenderer.prototype.drawSky = function() {
    var g;
    clearLayer(this.skyLayer);
    g = new PIXI.Graphics();
    g.rect(0, 0, this.layout.w, this.layout.h).fill("#05050c");
    g.rect(0, this.layout.h * 0.52, this.layout.w, this.layout.h * 0.48).fill("#150326");
    g.rect(0, this.layout.h * 0.68, this.layout.w, this.layout.h * 0.32).fill("#30044a");
    this.skyLayer.addChild(g);
  };

  ArcTanksRenderer.prototype.drawTerrain = function(view) {
    var grid = view.terrainGrid;
    var cell = grid ? grid.cellSize || 8 : 8;
    var canvas, ctx, x, y, i, entry, mat, tex, sprite, shade, dirtGrad, rows, cols, cells, renderScale, stripeY;
    clearLayer(this.terrainLayer);
    if (!grid || !grid.columns) return;
    rows = Math.ceil(grid.height / cell);
    cols = grid.columns.length;
    cells = [];
    for (y = 0; y < rows; y++) cells[y] = [];
    canvas = document.createElement("canvas");
    renderScale = 2;
    canvas.width = grid.width * renderScale;
    canvas.height = grid.height * renderScale;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, grid.width, grid.height);
    dirtGrad = ctx.createLinearGradient(0, grid.height * 0.42, 0, grid.height);
    dirtGrad.addColorStop(0, "#1d8730");
    dirtGrad.addColorStop(0.42, "#115f25");
    dirtGrad.addColorStop(1, "#073716");
    for (x = 0; x < grid.columns.length; x++) {
      for (i = 0; i < grid.columns[x].length; i++) {
        entry = grid.columns[x][i];
        mat = entry.mat || "dirt";
        for (y = entry.y; y < entry.y + entry.h && y < rows; y++) cells[y][x] = mat;
        if (mat === "dirt") {
          ctx.fillStyle = dirtGrad;
          ctx.fillRect(x * cell - 0.8, entry.y * cell - 0.8, cell + 1.6, entry.h * cell + 1.6);
        } else {
          ctx.fillStyle = terrainCellColor(mat, x, entry.y);
          ctx.fillRect(x * cell - 0.8, entry.y * cell - 0.8, cell + 1.6, entry.h * cell + 1.6);
        }
      }
    }
    ctx.globalCompositeOperation = "source-atop";
    for (stripeY = Math.round(grid.height * 0.42); stripeY < grid.height; stripeY += 42) {
      ctx.fillStyle = stripeY % 84 === 0 ? "rgba(132, 215, 88, 0.13)" : "rgba(5, 38, 16, 0.20)";
      ctx.fillRect(0, stripeY, grid.width, 13);
    }
    ctx.globalCompositeOperation = "source-over";
    drawTerrainEdges(ctx, cells, cell, cols, rows);
    tex = PIXI.Texture.from(canvas);
    sprite = new PIXI.Sprite(tex);
    sprite.width = grid.width;
    sprite.height = grid.height;
    sprite.roundPixels = true;
    this._terrainSprite = sprite;
    shade = new PIXI.Graphics();
    shade.rect(0, 0, grid.width, grid.height).fill({ color: 0x000000, alpha: 0.08 });
    this.terrainLayer.addChild(sprite, shade);
    if (view.activeHazards) this.drawHazards(view.activeHazards);
    this.lastTerrainVersion = grid.version;
    this.lastHazardKey = JSON.stringify(view.activeHazards || []);
  };

  ArcTanksRenderer.prototype.drawHazards = function(hazards) {
    var g, i, h, color;
    if (!hazards || !hazards.length) return;
    g = new PIXI.Graphics();
    for (i = 0; i < hazards.length; i++) {
      h = hazards[i];
      color = h.kind === "lava" ? 0xff3a00 : 0xff8a1f;
      g.circle(h.x, h.y, h.r).fill({ color: color, alpha: 0.22 });
      g.circle(h.x, h.y, h.r * 0.52).fill({ color: 0xffd166, alpha: 0.22 });
    }
    this.terrainLayer.addChild(g);
  };

  ArcTanksRenderer.prototype.drawTanks = function(view) {
    if (!view || !view.tanks) return;
    clearLayer(this.tankLayer);
    this.tankBodies = {};
    this.drawTank(view.tanks.p1, "p1", view);
    this.drawTank(view.tanks.p2, "p2", view);
  };

  ArcTanksRenderer.prototype.drawTank = function(tank, key, view) {
    var g = new PIXI.Container();
    var ring = new PIXI.Graphics();
    var body = new PIXI.Graphics();
    var turret = new PIXI.Graphics();
    var color = hexNumber(tank.color);
    var dir = key === "p1" ? 1 : -1;
    var visualScale = worldInfo(view).tankDrawScale;
    var aim = view.aim && view.aim[key] ? view.aim[key] : { angle: 45, power: 82 };
    var rad = ((this.shotPlayback && this.shotPlayback.shot.actor === key ? this.shotPlayback.shot.angle : aim.angle) * Math.PI) / 180;
    var recoil = this.shotPlayback && this.shotPlayback.shot.actor === key ? Math.max(0, 1 - this.shotPlayback.age / 0.28) * 9 : 0;
    var barrelRootY = -22;
    var barrelEndX = Math.cos(rad) * (46 - recoil) * dir;
    var barrelEndY = barrelRootY - Math.sin(rad) * 46;
    var isActive = this.shotPlayback ? this.shotPlayback.shot.actor === key : view.phase === "battle" && view.currentKey === key;
    var cover;
    var coverMat;
    var coverTint;
    var coverRadius;
    if (isActive) {
      ring.circle(0, -6, 33).stroke({ width: 2.4, color: 0xffd166, alpha: 0.72 });
      g.addChild(ring);
    }
    body.roundRect(-27, -13, 54, 18, 5).fill(0x121212).stroke({ width: 1.6, color: 0x000000, alpha: 0.95 });
    body.roundRect(-22, -22, 44, 18, 4).fill(color).stroke({ width: 1.6, color: 0x240000, alpha: 0.9 });
    body.rect(-25, 2, 50, 4).fill(0x2a2a2a);
    body.circle(-17, 5, 5).fill(0x070707).stroke({ width: 1, color: 0x555555 });
    body.circle(0, 6, 5).fill(0x070707).stroke({ width: 1, color: 0x555555 });
    body.circle(17, 5, 5).fill(0x070707).stroke({ width: 1, color: 0x555555 });
    body.rotation = tank.slope || 0;
    turret.circle(0, barrelRootY + 3, 8).fill(color).stroke({ width: 1.6, color: 0x160000, alpha: 0.95 });
    turret.moveTo(0, barrelRootY).lineTo(barrelEndX, barrelEndY).stroke({ width: 4.2, color: color, cap: "round" });
    turret.circle(barrelEndX, barrelEndY, 2.8).fill(0x1a0d02);
    g.addChild(body, turret);
    if (tank.trappedTurns > 0) {
      coverMat = tank.buriedMaterial || "dirt";
      coverTint = materialTint(coverMat);
      coverRadius = Math.max(30, tank.buriedRadius || 42);
      cover = new PIXI.Graphics();
      cover.ellipse(0, -7, coverRadius * 0.75, coverRadius * 0.48).fill({ color: coverTint, alpha: 0.92 }).stroke({ width: 2, color: 0x062f13, alpha: 0.65 });
      cover.circle(-24, -10, coverRadius * 0.34).fill({ color: coverTint, alpha: 0.95 });
      cover.circle(22, -11, coverRadius * 0.32).fill({ color: coverTint, alpha: 0.95 });
      cover.circle(1, -28, coverRadius * 0.27).fill({ color: coverTint, alpha: 0.9 });
      cover.rect(-34, 0, 68, 14).fill({ color: coverTint, alpha: 0.96 });
      cover.moveTo(0, barrelRootY).lineTo(barrelEndX, barrelEndY).stroke({ width: 2.4, color: 0x101010, alpha: 0.8, cap: "round" });
      g.addChild(cover);
    }
    g.x = tank.x - recoil * dir;
    g.y = tank.y;
    g.scale.set(visualScale);
    this.tankLayer.addChild(g);
    this.tankBodies[key] = { body: g, baseX: tank.x, dir: dir };
  };

  ArcTanksRenderer.prototype.drawHud = function(view) {
    var p1, p2, center, wind, status, volley, fontBig, fontSmall, p1Score, p2Score, p1Name, p2Name;
    clearLayer(this.hudLayer);
    fontBig = this.layout.w < 520 ? 14 : 19;
    fontSmall = this.layout.w < 520 ? 10 : 12;
    p1Score = (view.scores && view.scores.p1) || 0;
    p2Score = (view.scores && view.scores.p2) || 0;
    p1Name = view.tanks && view.tanks.p1 ? view.tanks.p1.name || "Player 1" : "Player 1";
    p2Name = view.tanks && view.tanks.p2 ? view.tanks.p2.name || "Player 2" : "Player 2";
    p1 = new PIXI.Text({ text: p1Name + "\n" + p1Score, style: { fontFamily: "Arial Black, Arial", fontSize: fontBig, fontWeight: "950", fill: "#69b7ff", align: "left", stroke: { color: "#000000", width: 4 } } });
    p1.anchor.set(0, 0);
    p1.x = 12;
    p1.y = 8;
    p2 = new PIXI.Text({ text: p2Name + "\n" + p2Score, style: { fontFamily: "Arial Black, Arial", fontSize: fontBig, fontWeight: "950", fill: "#ff6458", align: "right", stroke: { color: "#000000", width: 4 } } });
    p2.anchor.set(1, 0);
    p2.x = this.layout.w - 12;
    p2.y = 8;
    volley = Math.floor((view.turnNumber || 0) / 2) + 1;
    if (this.shotPlayback) status = this.shotPlayback.shot.weaponName;
    else if (view.phase === "draft") status = "Weapon Shop";
    else if (view.phase === "gameOver") status = view.draw ? "Draw" : (view.winnerName || "Winner") + " wins";
    else status = ordinal(volley) + " Volley";
    center = new PIXI.Text({ text: status, style: { fontFamily: "Arial Black, Arial", fontSize: fontBig, fontWeight: "950", fill: "#f7f3d2", align: "center", stroke: { color: "#000000", width: 4 } } });
    center.anchor.set(0.5, 0);
    center.x = this.layout.w / 2;
    center.y = 10;
    wind = new PIXI.Text({ text: view.phase === "gameOver" ? "Final Score" : "wind " + view.wind, style: { fontFamily: "Arial Black, Arial", fontSize: fontSmall, fontWeight: "900", fill: "#ffd166", stroke: { color: "#000000", width: 3 } } });
    wind.anchor.set(0.5, 0);
    wind.x = this.layout.w / 2;
    wind.y = center.y + fontBig + 5;
    this.hudLayer.addChild(p1, p2, center, wind);
  };

  ArcTanksRenderer.prototype.startShotPlayback = function(shot, previousView, finalView) {
    var events = shot.timeline && shot.timeline.events ? shot.timeline.events.slice() : [];
    var i;
    clearLayer(this.effectLayer);
    clearLayer(this.projectileLayer);
    this.effects = [];
    events.sort(function(a, b) { return (a.at || 0) - (b.at || 0); });
    for (i = 0; i < events.length; i++) events[i]._played = false;
    this.shotPlayback = {
      shot: shot,
      finalView: finalView,
      age: 0,
      duration: Math.max(playbackFlight(shot) + 0.34, shot.timeline && shot.timeline.duration ? shot.timeline.duration : 1.15),
      flight: playbackFlight(shot),
      terrainSwapped: false,
      previousView: previousView || null,
      flightView: makeFlightView(previousView, finalView, shot),
      events: events,
      projectile: shot.archetype === "laser" ? null : this.createProjectile(shot),
      fragmentProjectiles: this.createFragmentProjectiles(shot),
    };
    if (previousView && previousView.terrainGrid) {
      this.drawTerrain(previousView);
    } else {
      this.shotPlayback.terrainSwapped = true;
      this.drawTerrain(finalView);
    }
  };

  ArcTanksRenderer.prototype.createProjectile = function(shot) {
    var shell = new PIXI.Container();
    var body = new PIXI.Graphics();
    var color = projectileColor(shot);
    var visualScale = clamp(0.35 / Math.max(0.18, this.layout.scale || 1), 1, 1.85);
    body.circle(0, 0, 15).fill({ color: color, alpha: 0.18 });
    body.ellipse(0, 0, 15, 7).fill(color).stroke({ width: 2, color: 0x2b1600, alpha: 0.85 });
    body.circle(-10, 0, 4).fill({ color: 0xffffff, alpha: 0.3 });
    shell.addChild(body);
    shell.scale.set(visualScale);
    shell.x = shot.start.x;
    shell.y = shot.start.y;
    this.projectileLayer.addChild(shell);
    return shell;
  };

  ArcTanksRenderer.prototype.createFragmentProjectiles = function(shot) {
    var out = [];
    var fragments = shot.fragments || [];
    var i, shell;
    for (i = 0; i < fragments.length; i++) {
      shell = this.createProjectile(shot);
      shell.scale.set(shell.scale.x * 0.78, shell.scale.y * 0.78);
      shell.visible = false;
      out.push(shell);
    }
    return out;
  };

  ArcTanksRenderer.prototype.drawLaserFlash = function(shot) {
    var beam = new PIXI.Graphics();
    var start = shot.start || { x: 0, y: 0 };
    var end = shot.impact || sampleTrajectory(shot.trajectory, 1);
    beam.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 8, color: 0xa8f7ff, alpha: 0.72, cap: "round" });
    beam.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 3, color: 0xffffff, alpha: 0.95, cap: "round" });
    this.addTimedEffect(beam, 0.16, 0);
  };

  ArcTanksRenderer.prototype.advanceShotPlayback = function(dt) {
    var pb = this.shotPlayback;
    var shot, progress, sample, i, event, tankBody, recoil, fragments, fragmentFlights, splitAt, fragProgress, frag;
    if (!pb) return;
    shot = pb.shot;
    pb.age += dt;
    fragments = shot.fragments || [];
    fragmentFlights = shot.timeline && shot.timeline.fragmentFlights ? shot.timeline.fragmentFlights : [];
    splitAt = shot.timeline && shot.timeline.splitAt ? shot.timeline.splitAt : 0;
    progress = clamp(pb.age / pb.flight, 0, 1);
    if (pb.projectile) {
      if (fragments.length && splitAt > 0) progress = clamp(pb.age / splitAt, 0, 1) * (shot.timeline.splitProgress || 0.58);
      sample = sampleTrajectory(shot.trajectory, progress);
      pb.projectile.x = sample.x;
      pb.projectile.y = sample.y;
      pb.projectile.rotation = sample.angle;
      pb.projectile.visible = fragments.length && splitAt > 0 ? pb.age < splitAt : progress < 1;
    }
    for (i = 0; i < fragments.length; i++) {
      frag = fragments[i];
      if (!pb.fragmentProjectiles[i]) continue;
      if (pb.age < splitAt) {
        pb.fragmentProjectiles[i].visible = false;
        continue;
      }
      fragProgress = clamp((pb.age - splitAt) / Math.max(0.08, fragmentFlights[i] || 0.42), 0, 1);
      sample = sampleTrajectory(frag.trajectory, fragProgress);
      pb.fragmentProjectiles[i].x = sample.x;
      pb.fragmentProjectiles[i].y = sample.y;
      pb.fragmentProjectiles[i].rotation = sample.angle;
      pb.fragmentProjectiles[i].visible = fragProgress < 1;
    }
    if (!pb.terrainSwapped && pb.age >= pb.flight) {
      pb.terrainSwapped = true;
      this.drawTerrain(pb.finalView);
      this.drawTanks(pb.finalView);
      this.drawHud(pb.finalView);
    }
    for (i = 0; i < pb.events.length; i++) {
      event = pb.events[i];
      if (event._played || pb.age < (event.at || 0)) continue;
      event._played = true;
      this.spawnTimelineEvent(event, shot);
    }
    tankBody = this.tankBodies[shot.actor];
    if (tankBody && tankBody.body) {
      recoil = Math.max(0, 1 - pb.age / 0.28) * 9;
      tankBody.body.x = tankBody.baseX - recoil * tankBody.dir;
    }
    if (pb.age >= pb.duration) {
      clearLayer(this.projectileLayer);
      this.shotPlayback = null;
      if (this.pending) {
        this.drawTerrain(this.pending);
        this.drawTanks(this.pending);
        this.drawHud(this.pending);
        if (this.pending.phase === "battle") this.previousBattleView = this.pending;
      }
    }
  };

  ArcTanksRenderer.prototype.spawnTimelineEvent = function(event, shot) {
    var count, i, spec;
    if (event.type === "launch") return;
    if (event.type === "score") {
      this.drawDamageTicker(event, shot);
      return;
    }
    if (event.type === "impact" && shot.archetype === "laser") this.drawLaserFlash(shot);
    if (event.type !== "burn") this.drawImpactRing(event);
    count = event.type === "burn" ? 22 : 28;
    if (event.type === "impact") count = 18;
    if (event.r && event.r > 55) count = 52;
    if (shot.archetype === "laser" && event.type === "impact") count = 12;
    for (i = 0; i < count; i++) {
      spec = ArcTanksEffects.particleSpec(event, i + Math.floor((event.at || 0) * 100));
      this.addParticle(spec);
    }
  };

  ArcTanksRenderer.prototype.drawImpactRing = function(event) {
    var ring = new PIXI.Graphics();
    var color = ArcTanksEffects.colorFor(event.type === "burn" ? "fire" : event.type, 1);
    var radius = Math.max(10, event.r || 24);
    if (event.type === "laser") {
      ring.circle(event.x, event.y, Math.max(12, event.r || 18)).stroke({ width: 4, color: color, alpha: 0.95 });
    } else {
      ring.circle(event.x, event.y, radius).stroke({ width: 3, color: color, alpha: 0.74 });
      ring.circle(event.x, event.y, Math.max(5, radius * 0.45)).fill({ color: color, alpha: 0.2 });
    }
    this.addTimedEffect(ring, event.type === "burn" ? 0.36 : 0.48, event.type === "burn" ? 0.12 : 0.38);
  };

  ArcTanksRenderer.prototype.drawDamageTicker = function(event, shot) {
    var target = event.target && this.shotPlayback && this.shotPlayback.finalView && this.shotPlayback.finalView.tanks ? this.shotPlayback.finalView.tanks[event.target] : null;
    var points = Number(event.points) || 0;
    var positive = points >= 0;
    var fontSize = Math.round(event.lasting ? 34 : 38);
    var x = target ? target.x : event.x;
    var y = target ? target.y - Math.max(54, fontSize * 1.1) : event.y - 38;
    var pieces = Math.max(1, Math.min(event.lasting ? 9 : 5, Math.ceil(Math.max(1, event.ticks || Math.abs(points)) / (event.lasting ? 4 : 5))));
    var remaining = Math.abs(points);
    var i, amount, text, jitter;
    x = x * this.layout.scale + this.layout.ox;
    y = y * this.layout.scale + this.layout.oy;
    for (i = 0; i < pieces; i++) {
      amount = i === pieces - 1 ? remaining : Math.max(1, Math.round(Math.abs(points) / pieces));
      remaining = Math.max(0, remaining - amount);
      jitter = (ArcTanksEffects.hash01(i, x, y) - 0.5) * 42;
      text = new PIXI.Text({
        text: (positive ? "+" : "-") + amount,
        style: { fontFamily: "Arial Black, Arial", fontSize: fontSize, fontWeight: "950", fill: positive ? "#fff07a" : "#ff6b6b", stroke: { color: "#000000", width: Math.max(5, fontSize * 0.2) } },
      });
      text.anchor.set(0.5, 0.5);
      text.x = x + jitter;
      text.y = y - i * Math.max(7, fontSize * 0.34);
      this.addTimedEffect(text, (event.duration || (event.lasting ? 1.85 : 1.15)) + i * 0.09, 0.04, { kind: "damageFloat", screen: true, delay: i * (event.lasting ? 0.14 : 0.055), floatSpeed: 42 + i * 5 });
    }
  };

  ArcTanksRenderer.prototype.addTimedEffect = function(display, life, grow, meta) {
    var key;
    var effect;
    if (meta && meta.screen && this.screenFxLayer) this.screenFxLayer.addChild(display);
    else this.effectLayer.addChild(display);
    effect = {
      display: display,
      life: life,
      age: 0,
      grow: grow || 0,
      scaleX: display.scale.x,
      scaleY: display.scale.y,
      startY: display.y,
    };
    for (key in meta || {}) effect[key] = meta[key];
    this.effects.push(effect);
  };

  ArcTanksRenderer.prototype.addParticle = function(spec) {
    var particle;
    if (this.particleLayer && PIXI.Particle) {
      particle = new PIXI.Particle({ texture: this.particleTexture, x: spec.x, y: spec.y, scaleX: spec.size / 16, scaleY: spec.size / 16, anchorX: 0.5, anchorY: 0.5, tint: spec.color, alpha: 0.92 });
      this.particleLayer.addParticle(particle);
      spec.pixi = particle;
    } else {
      particle = new PIXI.Graphics().circle(0, 0, spec.size * 0.5).fill({ color: spec.color, alpha: 0.75 });
      particle.x = spec.x;
      particle.y = spec.y;
      this.fxLayer.addChild(particle);
      spec.pixi = particle;
    }
    this.particles.push(spec);
  };

  ArcTanksRenderer.prototype.emitHazardParticles = function(view, dt) {
    var hazards = view && view.activeHazards ? view.activeHazards : [];
    var i, j, h, seed, angle, dist, kind, color;
    if (!hazards.length) return;
    this.hazardEmitClock += dt;
    if (this.hazardEmitClock < 0.055) return;
    this.hazardEmitClock = 0;
    this.hazardPulse += 1;
    for (i = 0; i < hazards.length && i < 8; i++) {
      h = hazards[i];
      kind = h.kind === "lava" ? "lava" : "fire";
      for (j = 0; j < 2; j++) {
        seed = this.hazardPulse * 17 + i * 5 + j;
        angle = ArcTanksEffects.hash01(seed, h.x, h.y) * Math.PI * 2;
        dist = ArcTanksEffects.hash01(seed, h.r, 4) * (h.r || 24) * 0.72;
        color = ArcTanksEffects.colorFor(kind, seed);
        this.addParticle({
          x: h.x + Math.cos(angle) * dist,
          y: h.y + Math.sin(angle) * dist * 0.42,
          vx: (ArcTanksEffects.hash01(seed, 2, 8) - 0.5) * 34,
          vy: -70 - ArcTanksEffects.hash01(seed, 3, 9) * 70,
          life: 0.5 + ArcTanksEffects.hash01(seed, 4, 10) * 0.35,
          age: 0,
          size: 4 + ArcTanksEffects.hash01(seed, 5, 11) * 7,
          color: color,
          kind: kind,
        });
      }
    }
  };

  ArcTanksRenderer.prototype.tick = function(dt) {
    var nextParticles = [];
    var nextEffects = [];
    var hazardView, i, p, e, alpha, scale, absPoints, visiblePoints, tickProgress, liveAge, liveLife;
    dt = Math.min(0.05, dt || 0.016);
    if (this.shotPlayback) this.advanceShotPlayback(dt);
    hazardView = this.shotPlayback && !this.shotPlayback.terrainSwapped ? this.shotPlayback.previousView : this.pending;
    this.emitHazardParticles(hazardView, dt);
    for (i = 0; i < this.effects.length; i++) {
      e = this.effects[i];
      e.age += dt;
      if (e.age >= e.life) {
        if (e.display && e.display.parent) e.display.parent.removeChild(e.display).destroy({ children: true, texture: true, textureSource: true });
        continue;
      }
      if (e.delay && e.age < e.delay) {
        e.display.alpha = 0;
        nextEffects.push(e);
        continue;
      }
      liveAge = e.delay ? e.age - e.delay : e.age;
      liveLife = e.delay ? Math.max(0.05, e.life - e.delay) : e.life;
      alpha = clamp(1 - liveAge / liveLife, 0, 1);
      scale = 1 + e.grow * (liveAge / liveLife);
      if (e.kind === "damageTicker") {
        tickProgress = clamp(liveAge / Math.max(0.2, liveLife * 0.78), 0, 1);
        absPoints = Math.abs(e.points || 0);
        visiblePoints = tickProgress >= 1 ? absPoints : Math.max(1, Math.ceil(absPoints * Math.max(1, Math.ceil((e.ticks || 1) * tickProgress)) / Math.max(1, e.ticks || 1)));
        e.display.text = (e.points >= 0 ? "+" : "-") + visiblePoints;
        alpha = liveAge < liveLife * 0.76 ? 1 : clamp(1 - (liveAge - liveLife * 0.76) / (liveLife * 0.24), 0, 1);
        e.display.y = e.startY - liveAge * (e.floatSpeed || 80);
      } else if (e.kind === "damageFloat") {
        alpha = liveAge < liveLife * 0.68 ? 1 : clamp(1 - (liveAge - liveLife * 0.68) / (liveLife * 0.32), 0, 1);
        e.display.y = e.startY - liveAge * (e.floatSpeed || 70);
      }
      e.display.alpha = alpha;
      e.display.scale.set(e.scaleX * scale, e.scaleY * scale);
      if (e.display.text && e.kind !== "damageTicker" && e.kind !== "damageFloat") e.display.y = e.startY - e.age * 38;
      nextEffects.push(e);
    }
    this.effects = nextEffects;
    for (i = 0; i < this.particles.length; i++) {
      p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        if (p.pixi && this.particleLayer && this.particleLayer.removeParticle) this.particleLayer.removeParticle(p.pixi);
        else if (p.pixi && p.pixi.parent) p.pixi.parent.removeChild(p.pixi).destroy();
        continue;
      }
      p.vy += (p.kind === "fire" || p.kind === "lava" ? -12 : 180) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      alpha = clamp(1 - p.age / p.life, 0, 1);
      if (p.pixi) {
        p.pixi.x = p.x;
        p.pixi.y = p.y;
        p.pixi.alpha = alpha;
        p.pixi.rotation += dt * 3;
      }
      nextParticles.push(p);
    }
    this.particles = nextParticles;
  };

  window.ArcTanksRenderer = ArcTanksRenderer;
})();
