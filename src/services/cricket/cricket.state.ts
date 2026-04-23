// // src/services/cricket/cricket.state.ts

// import {
//   CRICKET_GAMES_FILE,
//   CRICKET_LOCKS_FILE,
// } from "./cricket.constants";
// import { cricketJsonStore } from "./cricket.json-store";
// import type { CricketGame, CricketGamesFile, CricketLocksFile } from "./cricket.types";

// const defaultGamesFile: CricketGamesFile = { games: [] };
// const defaultLocksFile: CricketLocksFile = { activePlayerToGame: {} };

// export class CricketStateRepository {
//   getGamesFile(): CricketGamesFile {
//     return cricketJsonStore.read<CricketGamesFile>(CRICKET_GAMES_FILE, defaultGamesFile);
//   }

//   saveGamesFile(data: CricketGamesFile) {
//     cricketJsonStore.write(CRICKET_GAMES_FILE, data);
//   }

//   getLocksFile(): CricketLocksFile {
//     return cricketJsonStore.read<CricketLocksFile>(CRICKET_LOCKS_FILE, defaultLocksFile);
//   }

//   saveLocksFile(data: CricketLocksFile) {
//     cricketJsonStore.write(CRICKET_LOCKS_FILE, data);
//   }

//   listGames(): CricketGame[] {
//     return this.getGamesFile().games;
//   }

//   saveGames(games: CricketGame[]) {
//     this.saveGamesFile({ games });
//   }

//   findGameById(gameId: string): CricketGame | null {
//     return this.listGames().find((g) => g.gameId === gameId) || null;
//   }

//   upsertGame(game: CricketGame) {
//     const games = this.listGames();
//     const idx = games.findIndex((g) => g.gameId === game.gameId);

//     if (idx >= 0) {
//       games[idx] = game;
//     } else {
//       games.push(game);
//     }

//     this.saveGames(games);
//   }

//   removeGame(gameId: string) {
//     const games = this.listGames().filter((g) => g.gameId !== gameId);
//     this.saveGames(games);
//   }

//   getPlayerLockedGame(userId: string): string | null {
//     const locks = this.getLocksFile();
//     return locks.activePlayerToGame[userId] || null;
//   }

//   lockPlayer(userId: string, gameId: string) {
//     const locks = this.getLocksFile();
//     locks.activePlayerToGame[userId] = gameId;
//     this.saveLocksFile(locks);
//   }

//   unlockPlayer(userId: string) {
//     const locks = this.getLocksFile();
//     delete locks.activePlayerToGame[userId];
//     this.saveLocksFile(locks);
//   }

//   unlockPlayers(userIds: string[]) {
//     const locks = this.getLocksFile();
//     for (const userId of userIds) {
//       delete locks.activePlayerToGame[userId];
//     }
//     this.saveLocksFile(locks);
//   }
// }

// export const cricketStateRepository = new CricketStateRepository();

// src/services/cricket/cricket.state.ts

import {
  CRICKET_GAMES_FILE,
  CRICKET_LOCKS_FILE,
} from "./cricket.constants";
import { cricketJsonStore } from "./cricket.json-store";
import type {
  CricketGame,
  CricketGamesFile,
  CricketLocksFile,
} from "./cricket.types";

const defaultGamesFile: CricketGamesFile = { games: [] };
const defaultLocksFile: CricketLocksFile = { activePlayerToGame: {} };

function isGameActive(game?: CricketGame | null) {
  if (!game) return false;
  return game.status === "waiting" || game.status === "live" || game.status === "innings_break";
}

export class CricketStateRepository {
  getGamesFile(): CricketGamesFile {
    return cricketJsonStore.read<CricketGamesFile>(
      CRICKET_GAMES_FILE,
      defaultGamesFile
    );
  }

  saveGamesFile(data: CricketGamesFile) {
    cricketJsonStore.write(CRICKET_GAMES_FILE, data);
  }

  getLocksFile(): CricketLocksFile {
    return cricketJsonStore.read<CricketLocksFile>(
      CRICKET_LOCKS_FILE,
      defaultLocksFile
    );
  }

  saveLocksFile(data: CricketLocksFile) {
    cricketJsonStore.write(CRICKET_LOCKS_FILE, data);
  }

  listGames(): CricketGame[] {
    return this.getGamesFile().games;
  }

  saveGames(games: CricketGame[]) {
    this.saveGamesFile({ games });
  }

  findGameById(gameId: string): CricketGame | null {
    return this.listGames().find((g) => g.gameId === gameId) || null;
  }

  findGamesByUserId(userId: string): CricketGame[] {
    return this.listGames().filter((game) =>
      Array.isArray(game.players) &&
      game.players.some((p) => String(p.userId) === String(userId))
    );
  }

  findActiveGameByUserId(userId: string): CricketGame | null {
    return (
      this.listGames().find((game) => {
        if (!isGameActive(game)) return false;
        return Array.isArray(game.players)
          ? game.players.some((p) => String(p.userId) === String(userId))
          : false;
      }) || null
    );
  }

  upsertGame(game: CricketGame) {
    const games = this.listGames();
    const idx = games.findIndex((g) => g.gameId === game.gameId);

    if (idx >= 0) {
      games[idx] = game;
    } else {
      games.push(game);
    }

    this.saveGames(games);
  }

  removeGame(gameId: string) {
    const games = this.listGames().filter((g) => g.gameId !== gameId);
    this.saveGames(games);

    const locks = this.getLocksFile();
    for (const userId of Object.keys(locks.activePlayerToGame)) {
      if (locks.activePlayerToGame[userId] === gameId) {
        delete locks.activePlayerToGame[userId];
      }
    }
    this.saveLocksFile(locks);
  }

  getPlayerLockedGame(userId: string): string | null {
    const locks = this.getLocksFile();
    const lockedGameId = locks.activePlayerToGame[userId] || null;

    if (!lockedGameId) return null;

    const game = this.findGameById(lockedGameId);

    // لو القفل يشير إلى لعبة غير موجودة أو منتهية، نفكّه تلقائيًا
    if (!isGameActive(game)) {
      this.unlockPlayer(userId);
      return null;
    }

    return lockedGameId;
  }

  lockPlayer(userId: string, gameId: string) {
    const locks = this.getLocksFile();
    locks.activePlayerToGame[userId] = gameId;
    this.saveLocksFile(locks);
  }

  lockPlayers(userIds: string[], gameId: string) {
    const locks = this.getLocksFile();
    for (const userId of userIds) {
      locks.activePlayerToGame[userId] = gameId;
    }
    this.saveLocksFile(locks);
  }

  unlockPlayer(userId: string) {
    const locks = this.getLocksFile();
    delete locks.activePlayerToGame[userId];
    this.saveLocksFile(locks);
  }

  unlockPlayers(userIds: string[]) {
    const locks = this.getLocksFile();
    for (const userId of userIds) {
      delete locks.activePlayerToGame[userId];
    }
    this.saveLocksFile(locks);
  }

  clearAllLocks() {
    this.saveLocksFile({ activePlayerToGame: {} });
  }

  cleanupStaleLocks() {
    const locks = this.getLocksFile();
    let changed = false;

    for (const userId of Object.keys(locks.activePlayerToGame)) {
      const gameId = locks.activePlayerToGame[userId];
      const game = this.findGameById(gameId);

      if (!isGameActive(game)) {
        delete locks.activePlayerToGame[userId];
        changed = true;
      }
    }

    if (changed) {
      this.saveLocksFile(locks);
    }
  }

  cleanupFinishedGames(maxFinishedToKeep = 50) {
    const games = this.listGames();

    const activeGames = games.filter((g) => isGameActive(g));
    const finishedGames = games
      .filter((g) => !isGameActive(g))
      .sort((a, b) => {
        const aTime = new Date(a.endedAt || a.createdAt).getTime();
        const bTime = new Date(b.endedAt || b.createdAt).getTime();
        return bTime - aTime;
      });

    const keptFinished = finishedGames.slice(0, Math.max(0, maxFinishedToKeep));
    this.saveGames([...activeGames, ...keptFinished]);

    this.cleanupStaleLocks();
  }
}

export const cricketStateRepository = new CricketStateRepository();