import { readFileSync } from "node:fs";
import path from "node:path";

export const ADAPTERS = new Set(["claude", "codex", "mixed"]);
export const MODES = new Set(["smoke", "full", "weird"]);

export function readManifest(gameDir) {
  const manifestPath = path.join(gameDir, "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read ${manifestPath}: ${error.message}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`Expected ${manifestPath} to contain a JSON object`);
  }
  return manifest;
}

export function resolveGameIdentity(manifest, gameDir) {
  const gameId = manifest.id ?? manifest.slug;
  if (typeof gameId !== "string" || gameId.trim() === "") {
    throw new Error(`manifest.id or manifest.slug is required in ${gameDir}`);
  }
  return gameId.trim();
}

export function resolvePlayerCount(manifest, requestedPlayers, gameDir) {
  const minPlayers = integerField(manifest, "minPlayers", gameDir);
  const maxPlayers = integerField(manifest, "maxPlayers", gameDir);
  if (minPlayers < 1) {
    throw new Error(`manifest.minPlayers must be >= 1 in ${gameDir}`);
  }
  if (maxPlayers < minPlayers) {
    throw new Error(
      `manifest.maxPlayers (${maxPlayers}) must be >= minPlayers (${minPlayers}) in ${gameDir}`,
    );
  }

  const playerCount = requestedPlayers ?? minPlayers;
  if (!Number.isInteger(playerCount)) {
    throw new Error(`--players must be an integer`);
  }
  if (playerCount < minPlayers || playerCount > maxPlayers) {
    throw new Error(
      `--players ${playerCount} is outside manifest range ${minPlayers}-${maxPlayers}`,
    );
  }
  return { minPlayers, maxPlayers, playerCount };
}

export function buildRoster({ adapter, playerCount }) {
  if (!ADAPTERS.has(adapter)) {
    throw new Error(`Unsupported --adapter ${adapter}; expected claude, codex, or mixed`);
  }
  return Array.from({ length: playerCount }, (_, index) => {
    const seatIndex = index + 1;
    return {
      seatIndex,
      name: `REST-${seatIndex}`,
      role: seatIndex === 1 ? "host-seat" : "player-seat",
      adapter: resolveSeatAdapter(adapter, index),
    };
  });
}

export function resolveSeatAdapter(adapter, zeroBasedSeatIndex) {
  if (adapter === "mixed") return zeroBasedSeatIndex % 2 === 0 ? "claude" : "codex";
  return adapter;
}

function integerField(manifest, field, gameDir) {
  const value = manifest[field];
  if (!Number.isInteger(value)) {
    throw new Error(`manifest.${field} must be an integer in ${gameDir}`);
  }
  return value;
}
