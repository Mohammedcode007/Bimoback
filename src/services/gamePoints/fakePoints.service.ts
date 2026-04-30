// src/services/gamePoints/fakePoints.service.ts
import fs from "fs/promises";
import path from "path";

export type FakePointReason =
  | "luck"
  | "million"
  | "investment"
  | "speculation"
  | "duel_slap"
  | "duel_hit"
  | "duel_box"
  | "manual"
  | string;

export type FakePointPlayerStats = {
  userId: string;
  username: string;

  points: number;

  wins: number;
  losses: number;
  neutral: number;

  millionWins: number;
  investmentWins: number;
  speculationWins: number;

  duelWins?: number;
  duelLosses?: number;

  totalWon?: number;
  totalLost?: number;

  updatedAt: string;
};

export type FakePointHistoryItem = {
  id: string;
  userId: string;
  username: string;
  roomId: string;
  amount: number;
  balanceAfter: number;
  reason: FakePointReason;
  meta?: any;
  createdAt: string;
};

export type FakePointRoomState = {
  roomId: string;
  players: Record<string, FakePointPlayerStats>;

  /**
   * نترك cooldowns هنا حتى لا نكسر لعبة سُــــــكَّــــــر الحالية.
   */
  cooldowns: Record<string, any>;

  /**
   * سجل آخر العمليات، اختياري لكنه مفيد للديباج.
   */
  history?: FakePointHistoryItem[];
};

export type FakePointDatabase = {
  version: number;
  rooms: Record<string, FakePointRoomState>;
};

const DATA_DIR = path.join(
  process.cwd(),
  "src",
  "public",
  "game-data",
  "sugar-luck"
);

const DATA_FILE = path.join(DATA_DIR, "sugar-luck.json");

const MAX_HISTORY_PER_ROOM = 200;

function nowIso() {
  return new Date().toISOString();
}

function createHistoryId() {
  return `fp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function ensureDb(): Promise<FakePointDatabase> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid fake points database");
    }

    parsed.version ||= 1;
    parsed.rooms ||= {};

    return parsed as FakePointDatabase;
  } catch {
    const initial: FakePointDatabase = {
      version: 1,
      rooms: {},
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function saveDb(db: FakePointDatabase) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const tmpFile = `${DATA_FILE}.tmp`;

  await fs.writeFile(tmpFile, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmpFile, DATA_FILE);
}

function getRoomState(db: FakePointDatabase, roomId: string): FakePointRoomState {
  if (!db.rooms[roomId]) {
    db.rooms[roomId] = {
      roomId,
      players: {},
      cooldowns: {},
      history: [],
    };
  }

  db.rooms[roomId].players ||= {};
  db.rooms[roomId].cooldowns ||= {};
  db.rooms[roomId].history ||= [];

  return db.rooms[roomId];
}

function getPlayer(
  roomState: FakePointRoomState,
  userId: string,
  username: string
): FakePointPlayerStats {
  if (!roomState.players[userId]) {
    roomState.players[userId] = {
      userId,
      username,
      points: 0,

      wins: 0,
      losses: 0,
      neutral: 0,

      millionWins: 0,
      investmentWins: 0,
      speculationWins: 0,

      duelWins: 0,
      duelLosses: 0,

      totalWon: 0,
      totalLost: 0,

      updatedAt: nowIso(),
    };
  }

  const player = roomState.players[userId];

  player.username = username || player.username;
  player.duelWins = Number(player.duelWins || 0);
  player.duelLosses = Number(player.duelLosses || 0);
  player.totalWon = Number(player.totalWon || 0);
  player.totalLost = Number(player.totalLost || 0);
  player.updatedAt = nowIso();

  return player;
}

function pushHistory(params: {
  roomState: FakePointRoomState;
  userId: string;
  username: string;
  roomId: string;
  amount: number;
  balanceAfter: number;
  reason: FakePointReason;
  meta?: any;
}) {
  params.roomState.history ||= [];

  params.roomState.history.unshift({
    id: createHistoryId(),
    userId: params.userId,
    username: params.username,
    roomId: params.roomId,
    amount: params.amount,
    balanceAfter: params.balanceAfter,
    reason: params.reason,
    meta: params.meta || null,
    createdAt: nowIso(),
  });

  if (params.roomState.history.length > MAX_HISTORY_PER_ROOM) {
    params.roomState.history = params.roomState.history.slice(0, MAX_HISTORY_PER_ROOM);
  }
}

/**
 * جلب لاعب من ملف النقاط.
 */
export async function getFakePointPlayer(params: {
  roomId: string;
  userId: string;
  username?: string;
}) {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const username = String(params.username || "Player");

  const db = await ensureDb();
  const roomState = getRoomState(db, roomId);
  const player = getPlayer(roomState, userId, username);

  await saveDb(db);

  return player;
}

/**
 * إضافة نقاط.
 */
export async function addFakePoints(params: {
  roomId: string;
  userId: string;
  username: string;
  amount: number;
  reason: FakePointReason;
  meta?: any;
}) {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const username = String(params.username || "Player");
  const amount = Math.max(0, Math.floor(Number(params.amount || 0)));

  const db = await ensureDb();
  const roomState = getRoomState(db, roomId);
  const player = getPlayer(roomState, userId, username);

  if (amount > 0) {
    player.points += amount;
    player.wins += 1;
    player.totalWon = Number(player.totalWon || 0) + amount;

    if (params.reason === "million") {
      player.millionWins += 1;
    }

    if (params.reason === "investment") {
      player.investmentWins += 1;
    }

    if (params.reason === "speculation") {
      player.speculationWins += 1;
    }

    if (String(params.reason).startsWith("duel_")) {
      player.duelWins = Number(player.duelWins || 0) + 1;
    }
  }

  player.updatedAt = nowIso();

  pushHistory({
    roomState,
    roomId,
    userId,
    username,
    amount,
    balanceAfter: player.points,
    reason: params.reason,
    meta: params.meta,
  });

  await saveDb(db);

  return {
    player,
    pointsChange: amount,
    balance: player.points,
  };
}

/**
 * خصم نقاط.
 */
export async function subtractFakePoints(params: {
  roomId: string;
  userId: string;
  username: string;
  amount: number;
  reason: FakePointReason;
  meta?: any;
}) {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const username = String(params.username || "Player");
  const amount = Math.max(0, Math.floor(Number(params.amount || 0)));

  const db = await ensureDb();
  const roomState = getRoomState(db, roomId);
  const player = getPlayer(roomState, userId, username);

  if (amount > 0) {
    player.points -= amount;
    player.losses += 1;
    player.totalLost = Number(player.totalLost || 0) + amount;

    if (String(params.reason).startsWith("duel_")) {
      player.duelLosses = Number(player.duelLosses || 0) + 1;
    }
  }

  player.updatedAt = nowIso();

  pushHistory({
    roomState,
    roomId,
    userId,
    username,
    amount: -amount,
    balanceAfter: player.points,
    reason: params.reason,
    meta: params.meta,
  });

  await saveDb(db);

  return {
    player,
    pointsChange: -amount,
    balance: player.points,
  };
}

/**
 * لا مكسب ولا خسارة.
 */
export async function neutralFakePoints(params: {
  roomId: string;
  userId: string;
  username: string;
  reason: FakePointReason;
  meta?: any;
}) {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const username = String(params.username || "Player");

  const db = await ensureDb();
  const roomState = getRoomState(db, roomId);
  const player = getPlayer(roomState, userId, username);

  player.neutral += 1;
  player.updatedAt = nowIso();

  pushHistory({
    roomState,
    roomId,
    userId,
    username,
    amount: 0,
    balanceAfter: player.points,
    reason: params.reason,
    meta: params.meta,
  });

  await saveDb(db);

  return {
    player,
    pointsChange: 0,
    balance: player.points,
  };
}

/**
 * تحديث فائز وخاسر في عملية واحدة.
 * مهم جدًا للألعاب الثنائية مثل كف/ضرب/بوكس.
 */
export async function applyFakePointDuelResult(params: {
  winner: {
    roomId: string;
    userId: string;
    username: string;
  };
  loser: {
    roomId: string;
    userId: string;
    username: string;
  };
  amount: number;
  reason: FakePointReason;
  meta?: any;
}) {
  const amount = Math.max(0, Math.floor(Number(params.amount || 0)));

  const db = await ensureDb();

  const winnerRoomState = getRoomState(db, String(params.winner.roomId));
  const loserRoomState = getRoomState(db, String(params.loser.roomId));

  const winner = getPlayer(
    winnerRoomState,
    String(params.winner.userId),
    String(params.winner.username || "Winner")
  );

  const loser = getPlayer(
    loserRoomState,
    String(params.loser.userId),
    String(params.loser.username || "Loser")
  );

  winner.points += amount;
  winner.wins += 1;
  winner.totalWon = Number(winner.totalWon || 0) + amount;
  winner.duelWins = Number(winner.duelWins || 0) + 1;
  winner.updatedAt = nowIso();

  loser.points -= amount;
  loser.losses += 1;
  loser.totalLost = Number(loser.totalLost || 0) + amount;
  loser.duelLosses = Number(loser.duelLosses || 0) + 1;
  loser.updatedAt = nowIso();

  pushHistory({
    roomState: winnerRoomState,
    roomId: String(params.winner.roomId),
    userId: String(params.winner.userId),
    username: String(params.winner.username),
    amount,
    balanceAfter: winner.points,
    reason: params.reason,
    meta: {
      ...(params.meta || {}),
      side: "winner",
      opponentUserId: String(params.loser.userId),
      opponentUsername: String(params.loser.username),
    },
  });

  pushHistory({
    roomState: loserRoomState,
    roomId: String(params.loser.roomId),
    userId: String(params.loser.userId),
    username: String(params.loser.username),
    amount: -amount,
    balanceAfter: loser.points,
    reason: params.reason,
    meta: {
      ...(params.meta || {}),
      side: "loser",
      opponentUserId: String(params.winner.userId),
      opponentUsername: String(params.winner.username),
    },
  });

  await saveDb(db);

  return {
    winner,
    loser,
    pointsChange: amount,
    winnerBalance: winner.points,
    loserBalance: loser.points,
  };
}

/**
 * قائمة أعلى 10 لاعبين في غرفة واحدة.
 */
export async function getFakePointsLeaderboard(params: {
  roomId: string;
  limit?: number;
}) {
  const roomId = String(params.roomId || "");
  const limit = Math.max(1, Math.min(50, Number(params.limit || 10)));

  const db = await ensureDb();
  const roomState = getRoomState(db, roomId);

  const players = Object.values(roomState.players || {})
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
    .slice(0, limit);

  return players;
}

/**
 * لو احتجت الوصول الخام لملف النقاط.
 */
export async function readFakePointsDb() {
  return ensureDb();
}