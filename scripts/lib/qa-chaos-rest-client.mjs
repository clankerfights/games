export class QaChaosHttpError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "QaChaosHttpError";
    this.details = details;
  }
}

export function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`Invalid --base URL ${value}: ${error.message}`);
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function assertReachable(baseUrl) {
  const url = endpointUrl(baseUrl, "/api/games");
  await jsonRequest(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    context: `Reachability failed for ${url}`,
  });
}

export async function createRoom({
  baseUrl,
  gameId,
  hostName,
  maxPlayers,
  seatPolicy = "agents-only",
}) {
  const url = endpointUrl(baseUrl, `/api/games/${encodeURIComponent(gameId)}/rooms`);
  const body = await jsonRequest(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: hostName,
      maxPlayers,
      seatPolicy,
      allowSpectators: true,
    }),
    context: `Room creation failed for ${url}`,
  });
  const roomCode = extractRoomCode(body);
  const hostCredentials = extractCredentials(body, hostName);
  return { roomCode, hostCredentials, body };
}

export async function joinRoom({ baseUrl, roomCode, workerName }) {
  const url = endpointUrl(baseUrl, `/api/rooms/${encodeURIComponent(roomCode)}/join`);
  const body = await jsonRequest(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ name: workerName }),
    context: `Join failed for ${url} as ${workerName}`,
  });
  return { credentials: extractCredentials(body, workerName), body };
}

export async function startRoom({ baseUrl, roomCode, sessionToken }) {
  const url = endpointUrl(baseUrl, `/api/rooms/${encodeURIComponent(roomCode)}/start`);
  return jsonRequest(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    context: `Start failed for ${url}`,
  });
}

export async function pollRoom({ baseUrl, roomCode, sessionToken, cursor, timeoutMs }) {
  const url = endpointUrl(baseUrl, `/api/rooms/${encodeURIComponent(roomCode)}/poll`);
  url.searchParams.set("timeout_ms", String(timeoutMs));
  url.searchParams.set("wake", "attention");
  if (cursor) url.searchParams.set("cursor", cursor);
  return jsonRequest(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    context: `Poll failed for ${url}`,
  });
}

export function extractCursor(pollBody) {
  return firstString(pollBody, ["cursor", "nextCursor", "pollCursor"]);
}

export function fingerprintPoll(pollBody) {
  const version = firstDefined(pollBody, [
    "version",
    "stateVersion",
    "roomVersion",
    "sequence",
    "seq",
    "revision",
  ]);
  if (version !== undefined) return `version:${JSON.stringify(version)}`;
  return `body:${stableStringify(pollBody)}`;
}

export function isGameOverPoll(pollBody) {
  const status = firstString(pollBody, ["status", "phase", "state.status"]);
  if (status && /game[_-]?over|complete|completed|finished|ended/i.test(status)) {
    return true;
  }
  return Boolean(
    pollBody?.gameOver ||
      pollBody?.isGameOver ||
      pollBody?.RESULT ||
      pollBody?.result ||
      pollBody?.outcome,
  );
}

export function extractActionCount(pollBody) {
  const value = firstDefined(pollBody, [
    "state.turnNumber",
    "agentView.turnNumber",
    "turnNumber",
  ]);
  if (Number.isInteger(value)) return value;
  return null;
}

export function extractJoinedPlayerCount(pollBody) {
  for (const path of [
    "players",
    "room.players",
    "participants",
    "room.participants",
    "state.players",
    "agentView.players",
  ]) {
    const value = getPath(pollBody, path);
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
  }
  return null;
}

export function detectAutoplayedPlayers(pollBody) {
  return extractAutoPlayCountRows(pollBody).filter(
    (player) => player.autoPlayCount > 0,
  );
}

async function jsonRequest(url, options) {
  let response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });
  } catch (error) {
    throw new QaChaosHttpError(`${options.context}: ${error.message}`, {
      url: String(url),
      cause: error.message,
    });
  }

  const text = await response.text();
  const body = parseResponseBody(text);
  if (!response.ok) {
    throw new QaChaosHttpError(
      `${options.context}: HTTP ${response.status} ${response.statusText}: ${truncate(text, 500)}`,
      { url: String(url), status: response.status, body },
    );
  }
  return body;
}

function endpointUrl(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`);
}

function parseResponseBody(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractRoomCode(body) {
  const roomCode = firstString(body, [
    "roomCode",
    "code",
    "room.code",
    "room.roomCode",
    "room.joinCode",
    "joinCode",
  ]);
  if (!roomCode) {
    throw new Error(
      `Room creation response did not include a room code; keys: ${describeKeys(body)}`,
    );
  }
  return roomCode;
}

function extractCredentials(body, workerName) {
  const playerId = firstString(body, [
    "playerId",
    "player.id",
    "seat.playerId",
    "session.playerId",
    "participant.playerId",
  ]);
  const sessionToken = firstString(body, [
    "sessionToken",
    "token",
    "player.sessionToken",
    "seat.sessionToken",
    "session.token",
    "auth.sessionToken",
  ]);
  if (!playerId || !sessionToken) {
    throw new Error(
      `${workerName} credential response missing ${!playerId ? "playerId" : "sessionToken"}; keys: ${describeKeys(body)}`,
    );
  }
  return { playerId, sessionToken };
}

function firstString(object, paths) {
  const value = firstDefined(object, paths);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function firstDefined(object, paths) {
  for (const path of paths) {
    const value = getPath(object, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return current[key];
  }, object);
}

function extractAutoPlayCountRows(pollBody) {
  const players = getPath(pollBody, "state.players");
  if (Array.isArray(players)) {
    return players.flatMap((player, index) =>
      autoPlayCountRow(player, `state.players[${index}]`, index),
    );
  }
  if (players && typeof players === "object") {
    return Object.entries(players).flatMap(([key, player], index) =>
      autoPlayCountRow(player, `state.players.${key}`, index, key),
    );
  }
  return [];
}

function autoPlayCountRow(player, fallbackLabel, index, objectKey = null) {
  if (!player || typeof player !== "object") return [];
  const autoPlayCount = player.autoPlayCount;
  if (!Number.isInteger(autoPlayCount)) return [];
  const playerId = firstString(player, ["id", "playerId", "participantId"]) ?? objectKey;
  const name = firstString(player, ["name", "displayName", "label"]);
  const label = name && playerId ? `${name} (${playerId})` : name ?? playerId ?? fallbackLabel;
  return [{ index, playerId, name, label, autoPlayCount }];
}

function stableStringify(value) {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value) {
  if (Array.isArray(value)) return value.map(sortForStableStringify);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortForStableStringify(value[key])]),
  );
}

function describeKeys(value) {
  if (!value || typeof value !== "object") return typeof value;
  return Object.keys(value).sort().join(", ") || "(none)";
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
