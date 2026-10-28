import { displayName } from "../../utils/display-name";
import { gameWinners } from "./game-winner";
import type { PublicGamePlayer, PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import type { Card, Suit } from "../../../backend/src/game/wizard/models/card";
import { t, type MessageKey } from "../../i18n";
import type { RoleAction } from "../../../backend/src/game/wizard/modes/roles/roles";
import { playerOf, powerOn, type RoleOf } from "../../../backend/src/game/wizard/modes/roles/rolePlay";

// What the top-centre banner says, worked out from game state alone. No DOM
// and no timing: announcer.ts decides when each line shows.

export interface RoundResultLine {
  label: string;
  value: string; // signed, e.g. "+20" or "-10"
}

export interface RoundResult {
  username: string;
  // What was predicted against what was won: "Predicted 2 · Won 2".
  summary: string;
  // How the points came about, a label and a signed value each (a hit: the
  // bonus and the tricks; a miss: how far off, with no value of its own).
  lines: RoundResultLine[];
  // The same as plain text, one line each.
  text: string;
  // This round's points, and the running total once they're added.
  points: number;
  total: number;
}

// A bot's username ends in " NPC", which the banner leaves off.
export const announcedName = (username: string): string =>
  displayName(username).replace(/ NPC$/, "");

const nameOf = (username: string, local: string) => (username === local ? t("ann.you") : announcedName(username));

export const suitName = (suit: Suit): string => t(`suit.${suit}`);

export function cardName(card: Card): string {
  if (card.value === 14) return t("card.wizard");
  if (card.value === 0) return t("card.jester");
  return t("card.suitValue", { suit: suitName(card.suit), value: String(card.value) });
}

// "A Wizard was turned up for trumps", or a Jester.
export const turnedUpMessage = (card: Card | null) =>
  t(card?.value === 14 ? "game.wizardTurnedUp" : "game.jesterTurnedUp");

// After the server refuses a card: the follow-suit rule, with the suit led.
export function followSuitMessage(state: PublicWizardGameState): string {
  const led = state.currentTrick.playedCards.find(({ card }) => card.value !== 0)?.card.suit;
  return led ? t("ann.followSuit", { suit: suitName(led) }) : t("ann.followSuitAny");
}

// The player the standing line is about, whose colour its border takes: whoever's
// move it is. Null when it isn't about one player.
export function statusSubject(state: PublicWizardGameState): string | null {
  if (state.phase === "finished") return null;
  return state.players[state.currentPlayerIndex]?.username ?? null;
}

// The standing line for the current moment: whose move it is.
export function statusMessage(state: PublicWizardGameState, local: string): string | null {
  const current = state.players[state.currentPlayerIndex]?.username;
  switch (state.phase) {
    case "trump-selection": {
      if (!current) return null;
      const turnedUp = turnedUpMessage(state.trumpCard);
      return current === local
        ? t("ann.chooseTrump", { turnedUp })
        : t("ann.othersChoosing", { turnedUp, name: announcedName(current) });
    }
    case "predictions": {
      if (!current) return null;
      // Predictions go in dealing order: first, next, ..., last.
      const made = state.players.filter((player) => player.prediction !== null).length;
      const order = made === 0 ? "first" : made === state.players.length - 1 ? "last" : "next";
      const when = t(`ann.order.${order}`);
      return current === local
        ? t("ann.youPredictOrder", { order: when })
        : t("ann.predictsOrder", { name: announcedName(current), order: when });
    }
    case "playing":
      // A finished trick keeps its own announcement until the next one starts.
      if (!current || state.currentTrick.winnerUsername) return null;
      // The first card of each trick: that player leads.
      if (state.currentTrick.playedCards.length === 0) {
        return current === local ? t("ann.youLead") : t("ann.leads", { name: announcedName(current) });
      }
      return servantWaiting(state, local) ?? (current === local ? t("ann.yourTurn") : t("ann.turn", { name: announcedName(current) }));
    case "fishing":
      if (!current) return null;
      return current === local ? t("ann.youFishing") : t("ann.fishing", { name: announcedName(current) });
    case "finished": {
      const winners = gameWinners(state);
      const winner = winners[0];
      if (!winner) return t("ann.gameOver");
      if (winners.length > 1) {
        const names = winners.map((player) => nameOf(player.username, local));
        const listed = t("ann.and", { names: names.slice(0, -1).join(", "), last: names.at(-1)! });
        return t("ann.tie", { names: listed });
      }
      return winner.username === local
        ? t("ann.youWin")
        : t("ann.wins", { name: announcedName(winner.username) });
    }
  }
}

const rolesIn = (state: PublicWizardGameState): RoleOf => (username) =>
  state.players.find((player) => player.username === username)?.role ?? undefined;

// While a Servant's 2 waits for the next card (modes/roles/servant.ts): who
// will give theirs. Null when no Servant is waiting.
function servantWaiting(state: PublicWizardGameState, local: string): string | null {
  const playedCards = state.currentTrick.playedCards;
  const last = playedCards.length - 1;
  const next = state.players[state.currentPlayerIndex]?.username;
  const two = playedCards[last];
  if (!two || !next || !powerOn(playedCards, last, "servant", state.trumpSuit, rolesIn(state))) return null;
  const servant = playerOf(two);
  const values = { name: announcedName(servant), next: announcedName(next) };
  if (servant === local) return t("ann.youWaitServant", values);
  return next === local ? t("ann.waitsForYou", values) : t("ann.waitsServant", values);
}

// Said once a round's cards are dealt and the trump card is showing: which suit
// is trumps. A Wizard or Jester turned up has its own announcements (the
// choosing), so it says nothing here; the last round has no trump card at all.
export function trumpMessage(state: PublicWizardGameState): string | null {
  const card = state.trumpCard;
  if (!card) return t("ann.noTrump");
  if (card.value === 14 || card.value === 0) return null;
  return state.trumpSuit ? t("ann.trumpIs", { suit: suitName(state.trumpSuit) }) : null;
}

// A one-off announcement, and the player it's about.
export interface EventMessage {
  text: string;
  username: string;
}

// One-off events between two snapshots, in the order they happened: new
// predictions, then a trick being won.
export function eventMessages(previous: PublicWizardGameState, next: PublicWizardGameState, local: string): EventMessage[] {
  const messages: EventMessage[] = [];

  // A player left for good, by choice or after three missed turns: the
  // server plays their seat from now on.
  for (const player of next.players) {
    const before = previous.players.find((p) => p.username === player.username);
    if (player.quit && before && !before.quit) {
      messages.push({
        text: player.username === local ? t("ann.youQuit") : t("ann.quit", { name: announcedName(player.username) }),
        username: player.username,
      });
    }
  }

  if (previous.currentRound === next.currentRound) {
    for (const player of next.players) {
      const before = previous.players.find((p) => p.username === player.username);
      if (before?.prediction === null && player.prediction !== null) {
        const one = player.prediction === 1;
        const values = { name: announcedName(player.username), count: String(player.prediction) };
        messages.push({
          text:
            player.username === local
              ? t(one ? "ann.youPredictOne" : "ann.youPredictMany", values)
              : t(one ? "ann.predictsOne" : "ann.predictsMany", values),
          username: player.username,
        });
      }
    }
  }

  // A suit chosen for a Wizard or Jester. A bot can choose before any update
  // shows it choosing, so this also covers a new round arriving already chosen.
  const special = next.trumpCard && (next.trumpCard.value === 14 || next.trumpCard.value === 0);
  const newlyChosen = previous.currentRound !== next.currentRound || !previous.trumpSuit;
  if (special && next.trumpSuit && newlyChosen) {
    // The round's first player chooses.
    const chooser = next.players[next.startingPlayerIndex]?.username;
    if (chooser) {
      const suit = suitName(next.trumpSuit);
      messages.push({
        text: chooser === local ? t("ann.youChose", { suit }) : t("ann.chose", { name: announcedName(chooser), suit }),
        username: chooser,
      });
    }
  }

  // A Farmer's seeds and harvests, and a Shepherd's sheep, come once the
  // trick is won, so they are
  // said after who won it.
  const roleEvents = roleMessages(previous, next, local);
  messages.push(...roleEvents.filter((message) => !message.atTrickEnd));

  const winner = next.currentTrick.winnerUsername;
  if (winner && previous.currentTrick.winnerUsername !== winner) {
    const played = next.currentTrick.playedCards.find((entry) => entry.username === winner);
    const wins = winner === local ? t("ann.youWinTrick") : t("ann.winsTrick", { name: announcedName(winner) });
    const card = played?.card;
    const withCard = !card
      ? ""
      : card.value === 14
        ? t("ann.withWizard")
        : card.value === 0
          ? t("ann.withJester")
          : t("ann.withCard", { card: cardName(card) });
    messages.push({
      text: `${wins}${withCard}`,
      username: winner,
    });
  }

  messages.push(...roleEvents.filter((message) => message.atTrickEnd));

  return messages;
}

// What the banner says when a role's power is used: by you, on you, by and on
// others.
// A Farmer's action is a seed planted, or a harvest when it has points (a
// harvest of nothing when those are 0); a Shepherd's, a sheep given or a
// payment the same way.
type PaidText = "harvest" | "barren" | "collect" | "unpaid";
const ROLE_TEXTS: Record<RoleAction["role"] | PaidText, [MessageKey, MessageKey, MessageKey]> = {
  thief: ["ann.youSteal", "ann.stealsYours", "ann.steals"],
  servant: ["ann.youServe", "ann.servesYours", "ann.serves"],
  fisher: ["ann.youFish", "ann.fishesYours", "ann.fishes"],
  farmer: ["ann.youPlant", "ann.plantsYours", "ann.plants"],
  harvest: ["ann.youHarvest", "ann.harvestsYours", "ann.harvests"],
  barren: ["ann.youHarvestNothing", "ann.harvestsNothingYours", "ann.harvestsNothing"],
  shepherd: ["ann.youGiveSheep", "ann.givesSheepYours", "ann.givesSheep"],
  collect: ["ann.youCollect", "ann.collectsYours", "ann.collects"],
  unpaid: ["ann.youCollectNothing", "ann.collectsNothingYours", "ann.collectsNothing"],
};

const PAID_TEXTS: Partial<Record<RoleAction["role"], [PaidText, PaidText]>> = {
  farmer: ["harvest", "barren"],
  shepherd: ["collect", "unpaid"],
};

const textsFor = (action: RoleAction) => {
  const paid = PAID_TEXTS[action.role];
  return ROLE_TEXTS[action.points === undefined || !paid ? action.role : action.points ? paid[0] : paid[1]];
};

// Seeds and sheep change hands once the trick is won.
const AT_TRICK_END: RoleAction["role"][] = ["farmer", "shepherd"];

// The powers of a Roles game used since the last snapshot (modes/roles/):
// the Thief's steal, the Servant's service, the Fisher's catch, a Farmer's
// seeds and harvests, and a Shepherd's sheep and payments. Those already announced from the same trick are
// not said again; the trick is the same one while its first card is.
function roleMessages(
  previous: PublicWizardGameState,
  next: PublicWizardGameState,
  local: string,
): (EventMessage & { atTrickEnd: boolean })[] {
  const before = previous.currentTrick;
  const now = next.currentTrick;
  const first = (trick: typeof now) => trick.playedCards[0]?.card;
  const sameTrick =
    previous.currentRound === next.currentRound &&
    before.playedCards.length <= now.playedCards.length &&
    first(before)?.value === first(now)?.value &&
    first(before)?.suit === first(now)?.suit;
  const said = sameTrick ? (before.roleActions?.length ?? 0) : 0;

  return (now.roleActions ?? []).slice(said).map((action) => {
    const card = cardName(action.card);
    const values = { name: announcedName(action.by), victim: announcedName(action.on), card, points: String(action.points ?? 0) };
    const [youUse, usedOnYou, used] = textsFor(action);
    const text = action.by === local ? t(youUse, values) : action.on === local ? t(usedOnYou, values) : t(used, values);
    return { text, username: action.by, atTrickEnd: AT_TRICK_END.includes(action.role) };
  });
}

const LOSS_LABELS: Record<RoleAction["role"], MessageKey> = {
  thief: "ann.stolen",
  servant: "ann.tipped",
  fisher: "ann.fished",
  farmer: "ann.harvested",
  shepherd: "ann.sheepPaid",
};

// When a round has just been scored: a result per player, the round's best
// first and the rest in descending order. Empty otherwise.
export function roundResults(previous: PublicWizardGameState, next: PublicWizardGameState): RoundResult[] {
  const scored = next.players.filter((player) => {
    const before = previous.players.find((p) => p.username === player.username);
    return before && player.roundScores.length > before.roundScores.length;
  });
  if (!scored.length) return [];

  const last = (player: PublicGamePlayer) => player.roundScores[player.roundScores.length - 1]!;
  // Every value carries its sign, so the signs line up in a column.
  const signed = (points: number) => (points >= 0 ? `+${points}` : String(points));
  const ordered = [...scored].sort(
    (a, b) => last(b).score - last(a).score || a.username.localeCompare(b.username),
  );

  return ordered.map((player) => {
    const { prediction, tricksWon, score: predictionScore, roleBonuses } = last(player);
    const off = Math.abs(prediction - tricksWon);
    const lines: RoundResultLine[] =
      prediction === tricksWon
        ? [
            { label: t("ann.bonus"), value: "+20" },
            { label: t("ann.tricks"), value: signed(tricksWon * 10) },
          ]
        : [{ label: t("ann.offBy", { off: String(off) }), value: "" }];
    // A Roles game: what each role's power brought this round, e.g. the
    // Servant's bonus, on its own line and in the round's points.
    let score = predictionScore;
    for (const [role, points] of Object.entries(roleBonuses ?? {})) {
      if (!points) continue;
      // Points another player's power took are a loss of their own: robbed by
      // a Thief, a Servant's tip, a Fisher's catch, a Farmer's harvest, a
      // Shepherd's sheep.
      const label = points < 0 ? t(LOSS_LABELS[role as RoleAction["role"]]) : t(`role.${role as RoleAction["role"]}`);
      lines.push({ label, value: signed(points) });
      score += points;
    }
    const summary = t("ann.predictedWon", { prediction: String(prediction), won: String(tricksWon) });
    return {
      username: player.username,
      summary,
      lines,
      text: [summary, lines.map((line) => `${line.label} ${line.value}`.trim()).join(" \u00b7 "), signed(score)].join("\n"),
      points: score,
      total: player.score,
    };
  });
}
