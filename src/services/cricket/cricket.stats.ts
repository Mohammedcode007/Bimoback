// // src/services/cricket/cricket.stats.ts

// import { CRICKET_STATS_FILE } from "./cricket.constants";
// import { cricketJsonStore } from "./cricket.json-store";
// import type {
//   CricketGame,
//   CricketStatsEntry,
//   CricketStatsFile,
// } from "./cricket.types";

// const defaultStatsFile: CricketStatsFile = {
//   leaderboard: [],
// };

// export class CricketStatsRepository {
//   getFile(): CricketStatsFile {
//     return cricketJsonStore.read<CricketStatsFile>(CRICKET_STATS_FILE, defaultStatsFile);
//   }

//   saveFile(data: CricketStatsFile) {
//     cricketJsonStore.write(CRICKET_STATS_FILE, data);
//   }

//   getLeaderboard(): CricketStatsEntry[] {
//     return this.getFile().leaderboard.sort((a, b) => {
//       if (b.wins !== a.wins) return b.wins - a.wins;
//       return b.totalRuns - a.totalRuns;
//     });
//   }

//   private ensureEntry(userId: string, username: string): CricketStatsEntry {
//     const file = this.getFile();
//     let found = file.leaderboard.find((x) => x.userId === userId);

//     if (!found) {
//       found = {
//         userId,
//         username,
//         wins: 0,
//         losses: 0,
//         matches: 0,
//         totalRuns: 0,
//         totalBalls: 0,
//         fours: 0,
//         sixes: 0,
//         outs: 0,
//         updatedAt: new Date().toISOString(),
//       };
//       file.leaderboard.push(found);
//       this.saveFile(file);
//     }

//     return found;
//   }

//   applyFinishedGame(game: CricketGame) {
//     const file = this.getFile();

//     for (const p of game.innings.playerScores) {
//       let row = file.leaderboard.find((x) => x.userId === p.userId);

//       if (!row) {
//         row = {
//           userId: p.userId,
//           username: p.username,
//           wins: 0,
//           losses: 0,
//           matches: 0,
//           totalRuns: 0,
//           totalBalls: 0,
//           fours: 0,
//           sixes: 0,
//           outs: 0,
//           updatedAt: new Date().toISOString(),
//         };
//         file.leaderboard.push(row);
//       }

//       row.username = p.username;
//       row.matches += 1;
//       row.totalRuns += p.runs;
//       row.totalBalls += p.balls;
//       row.fours += p.fours;
//       row.sixes += p.sixes;
//       if (p.isOut) row.outs += 1;

//       if (game.winnerUserId && game.winnerUserId === p.userId) {
//         row.wins += 1;
//       } else {
//         row.losses += 1;
//       }

//       row.updatedAt = new Date().toISOString();
//     }

//     this.saveFile(file);
//   }
// }

// export const cricketStatsRepository = new CricketStatsRepository();

// src/services/cricket/cricket.stats.ts

import { CRICKET_STATS_FILE } from "./cricket.constants";
import { cricketJsonStore } from "./cricket.json-store";
import type {
  CricketGame,
  CricketInningsState,
  CricketPlayerScore,
  CricketStatsEntry,
  CricketStatsFile,
} from "./cricket.types";

const defaultStatsFile: CricketStatsFile = {
  leaderboard: [],
};

function safeStrikeRate(runs: number, balls: number) {
  if (!balls || balls <= 0) return 0;
  return Number(((runs / balls) * 100).toFixed(2));
}

function collectAllPlayerScores(game: CricketGame): CricketPlayerScore[] {
  const out: CricketPlayerScore[] = [];

  const innings1 = game.scoreboard?.innings1;
  const innings2 = game.scoreboard?.innings2;

  if (innings1?.playerScores?.length) {
    out.push(...innings1.playerScores);
  }

  if (innings2?.playerScores?.length) {
    for (const p of innings2.playerScores) {
      const exists = out.find((x) => x.userId === p.userId);

      if (!exists) {
        out.push({ ...p });
      } else {
        exists.runs += p.runs;
        exists.balls += p.balls;
        exists.fours += p.fours;
        exists.sixes += p.sixes;
        exists.isOut = exists.isOut || p.isOut;
        exists.strikeRate = safeStrikeRate(exists.runs, exists.balls);
      }
    }
  }

  if (!out.length && game.innings?.playerScores?.length) {
    out.push(...game.innings.playerScores);
  }

  return out.map((p) => ({
    ...p,
    strikeRate: safeStrikeRate(Number(p.runs || 0), Number(p.balls || 0)),
  }));
}

export class CricketStatsRepository {
  getFile(): CricketStatsFile {
    return cricketJsonStore.read<CricketStatsFile>(
      CRICKET_STATS_FILE,
      defaultStatsFile
    );
  }

  saveFile(data: CricketStatsFile) {
    cricketJsonStore.write(CRICKET_STATS_FILE, data);
  }

  getLeaderboard(): CricketStatsEntry[] {
    return [...this.getFile().leaderboard].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns;
      return b.bestScore - a.bestScore;
    });
  }

  private ensureEntry(
    file: CricketStatsFile,
    userId: string,
    username: string
  ): CricketStatsEntry {
    let found = file.leaderboard.find((x) => x.userId === userId);

    if (!found) {
      found = {
        userId,
        username,

        wins: 0,
        losses: 0,
        draws: 0,
        matches: 0,

        totalRuns: 0,
        totalBalls: 0,
        fours: 0,
        sixes: 0,
        outs: 0,

        bestScore: 0,
        strikeRate: 0,

        soloWins: 0,
        teamWins: 0,
        ffaWins: 0,

        updatedAt: new Date().toISOString(),
      };

      file.leaderboard.push(found);
    }

    return found;
  }

  applyFinishedGame(game: CricketGame) {
    const file = this.getFile();
    const allScores = collectAllPlayerScores(game);

    for (const p of allScores) {
      if (!p?.userId) continue;
      if (p.userId === "server") continue;

      const row = this.ensureEntry(file, p.userId, p.username);

      row.username = p.username;
      row.matches += 1;

      row.totalRuns += Number(p.runs || 0);
      row.totalBalls += Number(p.balls || 0);
      row.fours += Number(p.fours || 0);
      row.sixes += Number(p.sixes || 0);

      if (p.isOut) {
        row.outs += 1;
      }

      if (Number(p.runs || 0) > row.bestScore) {
        row.bestScore = Number(p.runs || 0);
      }

      row.strikeRate = safeStrikeRate(row.totalRuns, row.totalBalls);

      const didWin =
        !!game.winnerUserId &&
        String(game.winnerUserId) === String(p.userId);

      const isDraw = !game.winnerUserId && game.status === "finished";

      if (isDraw) {
        row.draws += 1;
      } else if (didWin) {
        row.wins += 1;

        if (game.mode === "solo") row.soloWins += 1;
        if (game.mode === "team") row.teamWins += 1;
        if (game.mode === "ffa") row.ffaWins += 1;
      } else {
        row.losses += 1;
      }

      row.updatedAt = new Date().toISOString();
    }

    this.saveFile(file);
  }

  getTopWins(limit = 10) {
    return this.getLeaderboard().slice(0, limit);
  }

  getTopRuns(limit = 10) {
    return [...this.getFile().leaderboard]
      .sort((a, b) => {
        if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns;
        return b.bestScore - a.bestScore;
      })
      .slice(0, limit);
  }

  getTopSixes(limit = 10) {
    return [...this.getFile().leaderboard]
      .sort((a, b) => {
        if (b.sixes !== a.sixes) return b.sixes - a.sixes;
        return b.totalRuns - a.totalRuns;
      })
      .slice(0, limit);
  }

  getTopStrikeRate(limit = 10, minBalls = 6) {
    return [...this.getFile().leaderboard]
      .filter((x) => Number(x.totalBalls || 0) >= minBalls)
      .sort((a, b) => {
        if (b.strikeRate !== a.strikeRate) return b.strikeRate - a.strikeRate;
        return b.totalRuns - a.totalRuns;
      })
      .slice(0, limit);
  }
}

export const cricketStatsRepository = new CricketStatsRepository();