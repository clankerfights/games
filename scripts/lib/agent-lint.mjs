const DEFAULT_OPTION_BUDGET = 24;
const WARN_ONLY_CODES = new Set(["RULES_FORMAT"]);
const INFO_ONLY_CODES = new Set(["FREETEXT_INVENTORY"]);

export function createAgentLintSession(manifest) {
  const findings = [];
  const seen = new Set();
  const game = safeToken(manifest.slug || manifest.name || "unknown-game");
  const config = readConfig(manifest);

  function add(code, detail, keyParts = []) {
    const key = [code, ...keyParts].map(String).join("\u0000");
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ code, game, detail });
  }

  checkRulesFormat(manifest, add);

  return {
    inspect(engine, players) {
      if (engine.getResult() !== null) return;
      const state = engine.getState();
      const phase = phaseLabel(state);
      const playerOpportunities = [];
      const actors = players
        .map((player) => ({ id: player.id, label: player.id, isPlayer: true }))
        .concat([{ id: "__system__", label: "__system__", isPlayer: false }]);

      for (const actor of actors) {
        const opportunities = engine.getOpportunities(actor.id);
        if (actor.isPlayer) {
          const player = players.find((entry) => entry.id === actor.id);
          playerOpportunities.push({ player, opportunities });
        }
        inspectOpportunities({
          add,
          actor,
          opportunities,
          phase,
          config,
        });
      }

      if (
        playerOpportunities.some((entry) =>
          hasActionableOpportunity(entry.opportunities),
        )
      ) {
        return;
      }

      for (const { player, opportunities } of playerOpportunities) {
        inspectWaitSignal({ add, player, opportunities, phase });
      }
    },

    findings() {
      return [...findings];
    },
  };
}

export function formatAgentLintFinding(finding, options = {}) {
  const severity =
    options.strict && shouldFailStrict(finding)
      ? ""
      : INFO_ONLY_CODES.has(finding.code)
        ? "INFO "
        : "WARN ";
  return `AGENT-LINT ${finding.code} ${finding.game} ${severity}${finding.detail}`;
}

export function strictAgentLintFailures(findings) {
  return findings
    .filter((finding) => shouldFailStrict(finding))
    .map((finding) => formatAgentLintFinding(finding, { strict: true }));
}

function shouldFailStrict(finding) {
  return !WARN_ONLY_CODES.has(finding.code) && !INFO_ONLY_CODES.has(finding.code);
}

function readConfig(manifest) {
  const config = {
    optionBudget: DEFAULT_OPTION_BUDGET,
    optionBudgetOverride: null,
  };
  if (
    !manifest.agentLint ||
    typeof manifest.agentLint !== "object" ||
    Array.isArray(manifest.agentLint)
  ) {
    if (manifest.agentLint !== undefined) {
      throw new Error("AGENT-LINT CONFIG manifest.agentLint must be an object");
    }
    return config;
  }

  if (Object.prototype.hasOwnProperty.call(manifest.agentLint, "optionBudget")) {
    const optionBudget = manifest.agentLint.optionBudget;
    const reason = manifest.agentLint.reason;
    if (!Number.isInteger(optionBudget) || optionBudget <= 0) {
      throw new Error(
        "AGENT-LINT CONFIG manifest.agentLint.optionBudget must be a positive integer",
      );
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new Error(
        "AGENT-LINT CONFIG manifest.agentLint.reason is required when optionBudget is set",
      );
    }
    config.optionBudget = optionBudget;
    config.optionBudgetOverride = {
      optionBudget,
      reason: oneLine(reason),
    };
  }

  return config;
}

function checkRulesFormat(manifest, add) {
  const rules = typeof manifest.rules === "string" ? manifest.rules : "";
  const lower = rules.toLowerCase();
  const checks = [
    { name: "goal", words: ["goal", "objective", "overview", "win", "wins"] },
    {
      name: "visible-state",
      words: ["visible", "visibility", "view", "state", "board", "hand"],
    },
    {
      name: "decisions",
      words: ["decision", "decisions", "action", "actions", "choose", "vote"],
    },
    {
      name: "phases",
      words: ["phase", "phases", "round", "rounds", "turn", "turns"],
    },
    {
      name: "outcome",
      words: ["outcome", "winner", "winners", "wins", "draw", "game over"],
    },
  ];
  const missing = checks
    .filter((check) => !check.words.some((word) => lower.includes(word)))
    .map((check) => check.name);
  if (missing.length === 0) return;
  add(
    "RULES_FORMAT",
    `manifest.rules missing heuristic coverage for ${missing.join(",")}`,
    ["rules-format", missing.join(",")],
  );
}

function inspectOpportunities({ add, actor, opportunities, phase, config }) {
  for (const opportunity of opportunities) {
    if (!opportunity || typeof opportunity !== "object") continue;
    const opportunityId = opportunity.id || "unknown";
    const decision = opportunity.decision;
    inspectFreeTextInventory({
      add,
      actor,
      opportunity,
      opportunityId,
      phase,
    });

    if (!decision || decision.type !== "choose") continue;
    const options = Array.isArray(decision.options) ? decision.options : [];
    if (options.length > config.optionBudget) {
      add(
        "OPTION_BUDGET",
        optionBudgetDetail({
          actor,
          opportunity,
          opportunityId,
          phase,
          optionCount: options.length,
          config,
        }),
        [
          actor.id,
          opportunityId,
          phase,
          "option-budget",
          options.length,
          config.optionBudget,
        ],
      );
    }

    inspectLabels({
      add,
      actor,
      opportunity,
      opportunityId,
      phase,
      options,
    });
  }
}

function optionBudgetDetail({
  actor,
  opportunity,
  opportunityId,
  phase,
  optionCount,
  config,
}) {
  const base = `actor=${actor.label} phase=${phase} opportunity=${opportunityId} kind=${opportunity.kind || "unknown"} options=${optionCount} budget=${config.optionBudget}`;
  if (!config.optionBudgetOverride) return base;
  return `${base} manifest.agentLint.optionBudget applied reason="${truncate(config.optionBudgetOverride.reason, 120)}"`;
}

function inspectLabels({ add, actor, opportunity, opportunityId, phase, options }) {
  let missing = 0;
  const labels = [];

  for (const option of options) {
    const label = optionLabel(option);
    if (typeof label !== "string" || label.trim().length === 0) {
      missing++;
      continue;
    }
    labels.push(oneLine(label));
  }

  if (missing > 0) {
    add(
      "LABEL_MISSING",
      `actor=${actor.label} phase=${phase} opportunity=${opportunityId} kind=${opportunity.kind || "unknown"} missingLabels=${missing}/${options.length}`,
      [actor.id, opportunityId, phase, "label-missing", missing, options.length],
    );
  }

  const duplicate = commonRepeatedSubstring(labels);
  if (duplicate) {
    add(
      "LABEL_CONTEXT_DUPLICATION",
      `actor=${actor.label} phase=${phase} opportunity=${opportunityId} kind=${opportunity.kind || "unknown"} labels=${labels.length} repeated="${truncate(duplicate.substring, 100)}" count=${duplicate.count}`,
      [
        actor.id,
        opportunityId,
        phase,
        "label-context",
        duplicate.substring,
        duplicate.count,
      ],
    );
  }
}

function optionLabel(option) {
  if (!option || typeof option !== "object" || Array.isArray(option)) {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(option, "label")) {
    return option.label;
  }
  return undefined;
}

function commonRepeatedSubstring(labels) {
  if (labels.length < 2) return null;
  const threshold = Math.floor(labels.length / 2) + 1;
  const counts = new Map();
  const minLength = 41;

  for (const label of labels) {
    if (label.length < minLength) continue;
    const windows = new Set();
    for (let i = 0; i <= label.length - minLength; i++) {
      windows.add(label.slice(i, i + minLength));
    }
    for (const window of windows) {
      counts.set(window, (counts.get(window) || 0) + 1);
    }
  }

  let best = null;
  for (const [substring, count] of counts) {
    if (count < threshold) continue;
    if (!best || count > best.count || substring.length > best.substring.length) {
      best = { substring, count };
    }
  }
  return best;
}

function inspectWaitSignal({ add, player, opportunities, phase }) {
  const hasActionable = hasActionableOpportunity(opportunities);
  const hasWait = opportunities.some((opportunity) => opportunity?.kind === "wait");
  if (hasActionable || hasWait) return;

  const kinds = opportunities
    .map((opportunity) => opportunity?.kind || "unknown")
    .join(",");
  add(
    "WAIT_SIGNAL_MISSING",
    `player=${player.id} phase=${phase} opportunities=${opportunities.length} kinds=${kinds || "empty"}`,
    [player.id, phase, "wait-signal", kinds || "empty"],
  );
}

function hasActionableOpportunity(opportunities) {
  return opportunities.some((opportunity) => {
    const type = opportunity?.decision?.type;
    return typeof type === "string" && type !== "none";
  });
}

function inspectFreeTextInventory({
  add,
  actor,
  opportunity,
  opportunityId,
  phase,
}) {
  const summaries = [];
  const decision = opportunity.decision;
  if (!decision || typeof decision !== "object") return;

  const decisionSchema = schemaSummary(decision.schema);
  if (decisionSchema) summaries.push(`decision.${decisionSchema}`);

  if (decision.type === "choose" && Array.isArray(decision.options)) {
    const optionSummaries = new Set();
    for (const option of decision.options) {
      const summary = schemaSummary(option?.schema);
      if (summary) optionSummaries.add(summary);
    }
    if (optionSummaries.size > 0)
      summaries.push(`option.${[...optionSummaries].join("+")}`);
  }

  if (summaries.length === 0) return;
  add(
    "FREETEXT_INVENTORY",
    `actor=${actor.label} phase=${phase} opportunity=${opportunityId} kind=${opportunity.kind || "unknown"} ${summaries.join(" ")}`,
    [actor.id, opportunityId, phase, "freetext", summaries.join("|")],
  );
}

function schemaSummary(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return null;
  const fields =
    schema.fields && typeof schema.fields === "object" && !Array.isArray(schema.fields)
      ? Object.entries(schema.fields)
      : schema.properties &&
          typeof schema.properties === "object" &&
          !Array.isArray(schema.properties)
        ? Object.entries(schema.properties)
        : [];

  if (fields.length === 0) return null;
  const names = fields.map(([name]) => name);
  const hasFreeText = fields.some(([, field]) => {
    if (!field || typeof field !== "object") return false;
    return (
      field.freeText === true ||
      field.kind === "string" ||
      field.type === "string" ||
      field.format === "textarea"
    );
  });
  const details = [];
  if (hasFreeText) details.push("freeText");
  if (fields.length > 1) details.push(`multiField(${names.join(",")})`);
  return details.length > 0 ? details.join(",") : null;
}

function phaseLabel(state) {
  if (!state || typeof state !== "object") return "unknown";
  if (state.phase !== undefined) return safeToken(String(state.phase));
  if (state.status !== undefined) return safeToken(String(state.status));
  return "unknown";
}

function safeToken(value) {
  return oneLine(value).replace(/\s+/g, "-");
}

function oneLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
