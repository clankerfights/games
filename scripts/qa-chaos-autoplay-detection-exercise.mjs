#!/usr/bin/env node
import { detectAutoplayedPlayers } from "./lib/qa-chaos-rest-client.mjs";

exerciseZeroCounts();
console.log("autoPlayCount zero poll: green");
exercisePositiveCount();
console.log("autoPlayCount positive poll: green");

function exerciseZeroCounts() {
  const poll = {
    state: {
      players: [
        { id: "p1", name: "REST-1", autoPlayCount: 0 },
        { id: "p2", name: "REST-2", autoPlayCount: 0 },
      ],
    },
  };
  const autoplayedPlayers = detectAutoplayedPlayers(poll);
  assert(autoplayedPlayers.length === 0, "zero autoPlayCount rows must not fail");
}

function exercisePositiveCount() {
  const poll = {
    state: {
      players: [
        { id: "p1", name: "REST-1", autoPlayCount: 0 },
        { id: "p2", name: "REST-2", autoPlayCount: 1 },
      ],
    },
  };
  const autoplayedPlayers = detectAutoplayedPlayers(poll);
  const failure = {
    code: "REST_TURN_AUTOPLAYED",
    evidence: { roomCode: "SYNTH", autoplayedPlayers },
  };

  assert(failure.code === "REST_TURN_AUTOPLAYED", "positive count should map to REST_TURN_AUTOPLAYED");
  assert(autoplayedPlayers.length === 1, "positive count should name one player");
  assert(autoplayedPlayers[0].playerId === "p2", "positive count should name player id p2");
  assert(autoplayedPlayers[0].name === "REST-2", "positive count should name REST-2");
  assert(autoplayedPlayers[0].autoPlayCount === 1, "positive count should preserve count 1");
  assert(!("poll" in failure.evidence), "autoplay failure evidence must not embed the full poll body");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
