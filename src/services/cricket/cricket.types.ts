
// src/services/cricket/cricket.types.ts

export type CricketGameStatus =
  | "waiting"
  | "live"
  | "innings_break"
  | "finished"
  | "cancelled";

export type CricketGameMode =
  | "solo"
  | "ffa"
  | "team";

export type CricketActionType =
  | "join"
  | "leave"
  | "start"
  | "bat"
  | "skip"
  | "end"
  | "bot_turn"
  | "cancel";

export type CricketBallResult =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | "W";
export type CricketSide =
  | "teamA"
  | "teamB"
  | "soloPlayer"
  | "server"
  | null;

export interface CricketPlayerRef {
  userId: string;
  username: string;
  roomId: string;
  joinedAt: string;
  isBot?: boolean;
  team?: "teamA" | "teamB" | null;
}

export interface CricketPlayerScore {
  userId: string;
  username: string;
  team?: "teamA" | "teamB" | null;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  strikeRate: number;
}

export interface CricketBallEvent {
  ballNo: number;
  inningsNumber: 1 | 2;
  playerId: string;
  username: string;
  side: CricketSide;
  result: CricketBallResult;
  totalRunsAfterBall: number;
  wicketsAfterBall: number;
  overNumber: number;
  overBalls: number;
  batterChoice?: number;
  bowlerChoice?: number;
  at: string;
}

export interface CricketInningsState {
  inningsNumber: 1 | 2;
  battingSide: CricketSide;
  bowlingSide: CricketSide;
  strikerUserId: string | null;
  currentPlayerIndex: number;
  wickets: number;
  totalRuns: number;
  totalBalls: number;
  overBalls: number;
  overNumber: number;
  battingOrder: string[];
  playerScores: CricketPlayerScore[];
  timeline: CricketBallEvent[];
  isCompleted: boolean;
}

export interface CricketTeamState {
  teamA: string[];
  teamB: string[];
}

export interface CricketScoreboard {
  innings1?: CricketInningsState;
  innings2?: CricketInningsState;
  target?: number;
  winningSide?: CricketSide;
  winningTeamName?: string;
  bestPlayerUserId?: string;
  bestPlayerUsername?: string;
}

export interface CricketSoloConfig {
  serverUserId: "server";
  serverUsername: "Cricket Server";
  serverEnabled: boolean;
}

export interface CricketGame {
  gameId: string;

  mode: CricketGameMode;
  status: CricketGameStatus;

  hostUserId: string;
  hostUsername: string;
  createdFromRoomId: string;

  playersRequired: number;
  players: CricketPlayerRef[];

  teams?: CricketTeamState | null;
  solo?: CricketSoloConfig | null;

  overs: number;
  ballsPerOver: number;
  rounds?: number;

  currentInningsNumber: 1 | 2;
  currentTurnUserId: string | null;
  target?: number;

  createdAt: string;
  joinDeadlineAt: string;
  lastTurnAt?: string;
cancelledReason?: string;
  startedAt?: string;
  endedAt?: string;

  winnerUserId?: string;
  winnerUsername?: string;
  winnerSide?: CricketSide;
  announcementRoomIds: string[];

  broadcastRoomIds: string[];

  innings: CricketInningsState;
  scoreboard: CricketScoreboard;
}

export interface CricketStatsEntry {
  userId: string;
  username: string;

  wins: number;
  losses: number;
  draws: number;
  matches: number;

  totalRuns: number;
  totalBalls: number;
  fours: number;
  sixes: number;
  outs: number;

  bestScore: number;
  strikeRate: number;

  soloWins: number;
  teamWins: number;
  ffaWins: number;

  updatedAt: string;
}

export interface CricketStatsFile {
  leaderboard: CricketStatsEntry[];
}

export interface CricketGamesFile {
  games: CricketGame[];
}

export interface CricketLocksFile {
  activePlayerToGame: Record<string, string>;
}