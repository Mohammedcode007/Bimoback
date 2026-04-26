
// src/services/cricket/cricket.messages.ts

import type {
  CricketGame,
  CricketPlayerRef,
  CricketPlayerScore,
  CricketStatsEntry,
} from "./cricket.types";

function getCurrentPlayer(game: CricketGame) {
  const uid = String(
    game.currentTurnUserId || game.innings.strikerUserId || ""
  ).trim();

  if (!uid) return null;
  return game.players.find((p) => String(p.userId) === uid) || null;
}

function getSideLabel(side?: string | null) {
  if (side === "teamA") return "الفريق A";
  if (side === "teamB") return "الفريق B";
  if (side === "soloPlayer") return "اللاعب";
  if (side === "server") return "السيرفر";
  return "غير معروف";
}

function getModeLabel(mode?: string) {
  if (mode === "solo") return "منفرد ضد السيرفر";
  if (mode === "ffa") return "كل لاعب لنفسه";
  if (mode === "team") return "فريق ضد فريق";
  return "كريكت";
}

function formatScoreboardLines(scores: CricketPlayerScore[]) {
  return [...scores]
    .sort((a, b) => b.runs - a.runs)
    .map(
      (p, idx) =>
        `${idx + 1}- ${p.username}: ${p.runs} run / ${p.balls} ball | 4s:${p.fours} | 6s:${p.sixes}`
    )
    .join("\n");
}

function collectAllScores(game: CricketGame) {
  const all: CricketPlayerScore[] = [];

  const addScores = (scores?: CricketPlayerScore[]) => {
    if (!Array.isArray(scores)) return;

    for (const p of scores) {
      const found = all.find((x) => x.userId === p.userId);

      if (!found) {
        all.push({ ...p });
      } else {
        found.runs += Number(p.runs || 0);
        found.balls += Number(p.balls || 0);
        found.fours += Number(p.fours || 0);
        found.sixes += Number(p.sixes || 0);
        found.isOut = found.isOut || p.isOut;
        found.strikeRate =
          found.balls > 0
            ? Number(((found.runs / found.balls) * 100).toFixed(2))
            : 0;
      }
    }
  };

  addScores(game.scoreboard?.innings1?.playerScores);
  addScores(game.scoreboard?.innings2?.playerScores);

  if (!all.length) {
    addScores(game.innings?.playerScores);
  }

  return all;
}

export class CricketMessageBuilder {
  buildLobbyAnnouncement(game: CricketGame) {
    const modeLabel = getModeLabel(game.mode);
    const overs = Number(game.overs || 1);

    return `🏏 لعبة كريكت جديدة
النمط: ${modeLabel}
المضيف: ${game.hostUsername}
العدد المطلوب: ${game.playersRequired}
المنضمون: ${game.players.length}/${game.playersRequired}
عدد الـ overs: ${overs}

للانضمام:
!cricket join ${game.gameId}`;
  }

  buildJoinSuccess(game: CricketGame, username: string) {
    return `✅ انضم ${username} إلى لعبة الكريكت
اللاعبون الآن: ${game.players.length}/${game.playersRequired}`;
  }

  buildTeamsAssigned(game: CricketGame) {
    if (game.mode !== "team" || !game.teams) return "";

    const teamA = (game.teams.teamA || [])
      .map((id) => game.players.find((p) => p.userId === id)?.username || id)
      .join(" - ");

    const teamB = (game.teams.teamB || [])
      .map((id) => game.players.find((p) => p.userId === id)?.username || id)
      .join(" - ");

    return `🧩 تم تقسيم الفرق
الفريق A: ${teamA || "لا يوجد"}
الفريق B: ${teamB || "لا يوجد"}`;
  }

  buildGameStarted(game: CricketGame) {
    const current = getCurrentPlayer(game);
    const names = game.players.map((p) => p.username).join(" - ");
    const modeLabel = getModeLabel(game.mode);
    const inningsNo = game.currentInningsNumber || 1;
    const battingSide = getSideLabel(game.innings?.battingSide);

    let extra = "";
    if (game.mode === "team" && game.teams) {
      extra = `\n${this.buildTeamsAssigned(game)}\n`;
    }

    return `🚀 بدأت لعبة الكريكت
النمط: ${modeLabel}
اللاعبون: ${names}${extra}
Innings: ${inningsNo}
الطرف الضارب: ${battingSide}
الدور الأول: ${current?.username || "غير معروف"}

اختر رقمًا من 1 إلى 6 بالأمر:
!cricket play ${game.gameId} 4`;
  }

 buildBallResult(
  game: CricketGame,
  username: string,
  result: string | number,
  batterChoice?: number,
  bowlerChoice?: number
) {
  const innings = game.innings;
  const targetText =
    game.target && game.currentInningsNumber === 2
      ? `\nالهدف: ${game.target}`
      : "";

  const choicesText =
    typeof batterChoice === "number" && typeof bowlerChoice === "number"
      ? `\nاختيار ${username}: ${batterChoice}\nاختيار الخصم: ${bowlerChoice}`
      : "";

  const nextPlayerId = String(
    game.currentTurnUserId || game.innings?.strikerUserId || ""
  ).trim();

  const nextPlayer =
    game.players.find((p) => String(p.userId) === nextPlayerId)?.username ||
    "غير معروف";

  const nextTurnText =
    game.status === "live" ? `\nالدور الآن على: ${nextPlayer}` : "";

  return `🎯 ${username} لعب الكرة${choicesText}
النتيجة: ${result}
السكور: ${innings.totalRuns}/${innings.wickets}
الأوفر: ${innings.overNumber}.${innings.overBalls}${targetText}${nextTurnText}`;
}

  buildBotTurnResult(
    game: CricketGame,
    result: string | number,
    batterChoice?: number,
    bowlerChoice?: number
  ) {
    const innings = game.innings;
    const botName = game.solo?.serverUsername || "Cricket Server";

    const choicesText =
      typeof batterChoice === "number" && typeof bowlerChoice === "number"
        ? `\nاختيار ${botName}: ${batterChoice}\nاختيار الخصم: ${bowlerChoice}`
        : "";

    return `🤖 ${botName} لعب الكرة${choicesText}
النتيجة: ${result}
السكور: ${innings.totalRuns}/${innings.wickets}
الأوفر: ${innings.overNumber}.${innings.overBalls}`;
  }

  buildTurnPrompt(game: CricketGame) {
    const current = getCurrentPlayer(game);
    if (!current) return `⌛ لا يوجد لاعب حالي`;

    return `👉 الدور الآن على: ${current.username}
Innings: ${game.currentInningsNumber}
اختر رقمًا من 1 إلى 6:
!cricket play ${game.gameId} 4`;
  }

  buildInningsBreak(game: CricketGame) {
    const innings1 = game.scoreboard?.innings1;
    const target = game.scoreboard?.target || game.target;

    return `⏸ انتهت الجولة الأولى
النتيجة: ${innings1?.totalRuns || 0}/${innings1?.wickets || 0}
عدد الكرات: ${innings1?.totalBalls || 0}
الهدف للجولة الثانية: ${target || 0}`;
  }

  buildFinished(game: CricketGame) {
    const innings1 = game.scoreboard?.innings1;
    const innings2 = game.scoreboard?.innings2;
    const allScores = collectAllScores(game);
    const lines = formatScoreboardLines(allScores);

    const winnerText = game.winnerUsername
      ? game.winnerUsername
      : game.winnerSide
      ? getSideLabel(game.winnerSide)
      : "لا يوجد";

    let inningsText = "";
    if (innings1) {
      inningsText += `الجولة 1: ${innings1.totalRuns}/${innings1.wickets}\n`;
    }
    if (innings2) {
      inningsText += `الجولة 2: ${innings2.totalRuns}/${innings2.wickets}\n`;
    }

    return `🏆 انتهت لعبة الكريكت
النمط: ${getModeLabel(game.mode)}
الفائز: ${winnerText}
${inningsText ? `${inningsText}` : ""}النتائج:
${lines}`;
  }

  buildCancelled(game: CricketGame, reason?: string) {
    return `🛑 تم إلغاء لعبة الكريكت
المعرف: ${game.gameId}
${reason ? `السبب: ${reason}` : ""}`;
  }

  buildMyGame(game: CricketGame) {
    const current = getCurrentPlayer(game);

    return `🎮 مباراتك الحالية
المعرف: ${game.gameId}
النمط: ${getModeLabel(game.mode)}
الحالة: ${game.status}
Innings: ${game.currentInningsNumber}
الدور الحالي: ${current?.username || "غير معروف"}`;
  }

  buildTopWins(rows: CricketStatsEntry[]) {
    if (!rows.length) return "لا توجد إحصائيات حتى الآن";

    return `🥇 الأكثر فوزًا في الكريكت
${rows
  .slice(0, 10)
  .map((r, i) => `${i + 1}- ${r.username} | wins: ${r.wins} | matches: ${r.matches}`)
  .join("\n")}`;
  }

  buildTopRuns(rows: CricketStatsEntry[]) {
    if (!rows.length) return "لا توجد إحصائيات runs حتى الآن";

    return `🏏 الأعلى في عدد الـ runs
${rows
  .slice(0, 10)
  .map((r, i) => `${i + 1}- ${r.username} | runs: ${r.totalRuns} | best: ${r.bestScore}`)
  .join("\n")}`;
  }

  buildTopSixes(rows: CricketStatsEntry[]) {
    if (!rows.length) return "لا توجد إحصائيات sixes حتى الآن";

    return `💥 الأعلى في عدد الـ sixes
${rows
  .slice(0, 10)
  .map((r, i) => `${i + 1}- ${r.username} | sixes: ${r.sixes}`)
  .join("\n")}`;
  }

  buildTopStrikeRate(rows: CricketStatsEntry[]) {
    if (!rows.length) return "لا توجد إحصائيات strike rate حتى الآن";

    return `⚡ الأعلى في Strike Rate
${rows
  .slice(0, 10)
  .map((r, i) => `${i + 1}- ${r.username} | SR: ${r.strikeRate} | balls: ${r.totalBalls}`)
  .join("\n")}`;
  }

buildHelp() {
  return `أوامر الكريكت:
!cricket start solo 1 2
!cricket start ffa 4 2
!cricket start team 4 2

!cricket join GAME_ID
!cricket play GAME_ID 4

إنهاء اللعبة:
!cricket end
!cricket end GAME_ID
!cricket cancel GAME_ID

أوامر أخرى:
!cricket mygame
!cricket top
!cricket topruns
!cricket topsixes
!cricket topsr
!cricket leavegame`;
}
}

export const cricketMessageBuilder = new CricketMessageBuilder();