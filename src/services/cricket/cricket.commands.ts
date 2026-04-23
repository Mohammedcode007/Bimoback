// // src/services/cricket/cricket.commands.ts

// export type CricketParsedCommand =
//   | { action: "start"; playersRequired: number }
//   | { action: "join"; gameId: string }
//   | { action: "hit"; gameId: string }
//   | { action: "top" }
//   | { action: "mygame" }
//   | { action: "help" };

// export function parseCricketCommand(text?: string): CricketParsedCommand | null {
//   const raw = String(text || "").trim();
//   if (!raw) return null;

//   const parts = raw.split(/\s+/);
//   if (parts[0]?.toLowerCase() !== "!cricket") return null;

//   const sub = (parts[1] || "").toLowerCase();

//   if (sub === "start") {
//     const playersRequired = Number(parts[2] || 2);
//     return { action: "start", playersRequired };
//   }

//   if (sub === "join") {
//     const gameId = String(parts[2] || "").trim();
//     if (!gameId) return null;
//     return { action: "join", gameId };
//   }

//   if (sub === "hit") {
//     const gameId = String(parts[2] || "").trim();
//     if (!gameId) return null;
//     return { action: "hit", gameId };
//   }

//   if (sub === "top") {
//     return { action: "top" };
//   }

//   if (sub === "mygame") {
//     return { action: "mygame" };
//   }

//   return { action: "help" };
// }

// src/services/cricket/cricket.commands.ts
// src/services/cricket/cricket.commands.ts

import {
  CRICKET_DEFAULT_OVERS,
  CRICKET_FFA_MAX_PLAYERS,
  CRICKET_FFA_MIN_PLAYERS,
  CRICKET_MAX_OVERS,
  CRICKET_MIN_OVERS,
  CRICKET_SOLO_PLAYERS,
  CRICKET_TEAM_MAX_PLAYERS,
  CRICKET_TEAM_MIN_PLAYERS,
} from "./cricket.constants";
import type { CricketGameMode } from "./cricket.types";

export type CricketParsedCommand =
  | {
      action: "start";
      mode: CricketGameMode;
      playersRequired: number;
      overs: number;
    }
  | { action: "join"; gameId: string }
  | {
      action: "play";
      gameId: string;
      choice: 1 | 2 | 3 | 4 | 5 | 6;
    }
  | { action: "top" }
  | { action: "topruns" }
  | { action: "topsixes" }
  | { action: "topsr" }
  | { action: "mygame" }
  | { action: "leavegame" }
  | { action: "help" };

function toSafeInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeMode(raw?: string): CricketGameMode | null {
  const v = String(raw || "").trim().toLowerCase();

  if (v === "solo") return "solo";
  if (v === "ffa") return "ffa";
  if (v === "team") return "team";

  return null;
}

function normalizeStartArgs(parts: string[]) {
  const mode = normalizeMode(parts[2] || "ffa") || "ffa";

  let playersRequired = toSafeInt(parts[3], 2);
  let overs = toSafeInt(parts[4], CRICKET_DEFAULT_OVERS);

  overs = clamp(overs, CRICKET_MIN_OVERS, CRICKET_MAX_OVERS);

  if (mode === "solo") {
    playersRequired = CRICKET_SOLO_PLAYERS;
  } else if (mode === "team") {
    playersRequired = clamp(
      playersRequired,
      CRICKET_TEAM_MIN_PLAYERS,
      CRICKET_TEAM_MAX_PLAYERS
    );

    if (playersRequired % 2 !== 0) {
      throw new Error("Team mode requires an even number of players");
    }
  } else {
    playersRequired = clamp(
      playersRequired,
      CRICKET_FFA_MIN_PLAYERS,
      CRICKET_FFA_MAX_PLAYERS
    );
  }

  return {
    mode,
    playersRequired,
    overs,
  };
}

export function parseCricketCommand(text?: string): CricketParsedCommand | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const parts = raw.split(/\s+/);
  if (parts[0]?.toLowerCase() !== "!cricket") return null;

  const sub = String(parts[1] || "").trim().toLowerCase();

  if (sub === "start") {
    const { mode, playersRequired, overs } = normalizeStartArgs(parts);

    return {
      action: "start",
      mode,
      playersRequired,
      overs,
    };
  }

  if (sub === "join") {
    const gameId = String(parts[2] || "").trim();
    if (!gameId) return null;

    return { action: "join", gameId };
  }

  if (sub === "play") {
    const gameId = String(parts[2] || "").trim();
    const choiceNum = Number(parts[3] || 0);

    if (!gameId) return null;

    if (![1, 2, 3, 4, 5, 6].includes(choiceNum)) {
      throw new Error("Choice must be a number from 1 to 6");
    }

    return {
      action: "play",
      gameId,
      choice: choiceNum as 1 | 2 | 3 | 4 | 5 | 6,
    };
  }

  if (sub === "top") {
    return { action: "top" };
  }

  if (sub === "topruns") {
    return { action: "topruns" };
  }

  if (sub === "topsixes") {
    return { action: "topsixes" };
  }

  if (sub === "topsr") {
    return { action: "topsr" };
  }

  if (sub === "mygame") {
    return { action: "mygame" };
  }

  if (sub === "leavegame") {
    return { action: "leavegame" };
  }

  return { action: "help" };
}