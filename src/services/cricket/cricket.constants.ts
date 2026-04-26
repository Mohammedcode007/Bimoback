
// src/services/cricket/cricket.constants.ts

import path from "path";

export const CRICKET_DATA_DIR = path.join(
  process.cwd(),
  "src",
  "public",
  "game-data",
  "cricket"
);

export const CRICKET_GAMES_FILE = path.join(CRICKET_DATA_DIR, "games.json");
export const CRICKET_STATS_FILE = path.join(CRICKET_DATA_DIR, "stats.json");
export const CRICKET_LOCKS_FILE = path.join(CRICKET_DATA_DIR, "locks.json");

export const CRICKET_MIN_PLAYERS = 1;
export const CRICKET_MAX_PLAYERS = 6;

export const CRICKET_MIN_OVERS = 1;
export const CRICKET_MAX_OVERS = 5;
export const CRICKET_DEFAULT_OVERS = 2;
export const CRICKET_BALLS_PER_OVER = 6;

export const CRICKET_JOIN_WINDOW_MS = 2 * 60 * 1000;

export const CRICKET_BOT_NAME = "cricket";
export const CRICKET_SERVER_USER_ID = "server";
export const CRICKET_SERVER_USERNAME = "Cricket Server";

export const CRICKET_ALLOWED_MODES = ["solo", "ffa", "team"] as const;

export const CRICKET_TEAM_MIN_PLAYERS = 2;
export const CRICKET_TEAM_MAX_PLAYERS = 6;

export const CRICKET_FFA_MIN_PLAYERS = 2;
export const CRICKET_FFA_MAX_PLAYERS = 6;

export const CRICKET_SOLO_PLAYERS = 1;
export const CRICKET_TURN_TIMEOUT_MS = 60 * 1000;
export const CRICKET_MAX_FINISHED_GAMES_TO_KEEP = 50;