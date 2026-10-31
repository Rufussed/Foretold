import { displayName } from "../../utils/display-name";
import { gameWinners } from "./game-winner";
import type { PublicGamePlayer, PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import type { Card, Suit } from "../../../backend/src/game/wizard/models/card";
import { t, type MessageKey } from "../../i18n";
import type { RoleAction } from "../../../backend/src/game/wizard/modes/roles/roles";
import { rolePowerOn } from "../../../backend/src/game/wizard/modes/roles/rolePlay";
import { playerOf, powerOn, type RoleOf } from "../../../backend/src/game/wizard/modes/roles/rolePlay";
import { isSabotageGame } from "../../modes/sabotage/sabotage-game";
import { WizardRules } from "../../../backend/src/game/wizard/services/wizardRules";
import { trickRolesIn } from "../../../backend/src/game/wizard/modes/roles/master/trickRoles";
import {
  elementName,
  powerEvent,
  powerStatus,
  sabotageCardName,
} from "../../modes/sabotage/hud/sabotage-announcements";

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

// A Sabotage game names its suits as elements (modes/sabotage/hud/).
export const suitName = (suit: Suit): string => (isSabotageGame() ? elementName(suit) : t(`suit.${suit}`));

export function cardName(card: Card): string {
  if (isSabotageGame()) return sabotageCardName(card);
  if (card.value === 14) return t("card.wizard");
  if (card.value === 0) return t("card.jester");
  return t("card.suitValue", { suit: suitName(card.suit), value: String(card.value) });
}

// "A Wizard was turned up for trumps", or a Jester.
export const turnedUpMessage = (card: Card | null) =>
  t(card?.value === 14 ? "game.wizardTurnedUp" : isSabotageGame() ? "sabotage.foolTurnedUp" : "game.jesterTurnedUp");

// After the server refuses a card: the follow-suit rule, with the suit led.
// A Roles Yellow Wizard may have made yellow the lead suit.
export function followSuitMessage(state: PublicWizardGameState): string {
  const led = leadSuitOf(state);
  return led ? t("ann.followSuit", { suit: suitName(led) }) : t("ann.followSuitAny");
}

const rules = new WizardRules();
const leadSuitOf = (state: PublicWizardGameState) =>
  rules.getLeadSuit(state.currentTrick.playedCards, state.trumpSuit, trickRolesIn(state));
const redShieldOf = (state: PublicWizardGameState) =>
  rules.redShield(state.currentTrick.playedCards, state.trumpSuit, trickRolesIn(state));

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
    case "power":
      // A Sabotage trick won with a Seer, Trickster or Thief.
      return powerStatus(state, local);
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
  const sabotage = isSabotageGame();
  if (!card) return t(sabotage ? "sabotage.ann.noTrump" : "ann.noTrump");
  if (card.value === 14 || card.value === 0) return null;
  return state.trumpSuit
    ? t(sabotage ? "sabotage.ann.trumpIs" : "ann.trumpIs", { suit: suitName(state.trumpSuit) })
    : null;
}

// A one-off announcement, and the player it's about.
export interface EventMessage {
  text: string;
  username: string;
  // A player whose prediction this announcement is about (a Sabotage Seer or
  // Trickster changed it): the bottom-left list swaps in the new number as it
  // is read out.
  changes?: string;
  // A Trickster at work: someone else's prediction was changed, not the
  // player's own.
  byOther?: boolean;
  // Whose power changed it, for the Trickster's tesseract to fly from.
  source?: string;
  // A Roles power at work: shown at least as long as at the default pace,
  // however fast the game runs.
  role?: boolean;
  // A power that hit you or paid you, yours or someone else's: shown louder
  // and longer.
  aboutYou?: "gain" | "loss";
  // A trick won, which closes the trick in the log.
  trick?: boolean;
}

// Whether a role's action brought you points or cost you. Your own power:
// by the points it moved, a gain for a steal, a catch or a block that
// bounced, either way for a market or a Priest's faith; nothing for a seed
// or a sheep given or armour forged. Someone else's: a card or points taken,
// a seed or a sheep handed you, a trade or faith with you. For a Smith's
// block, you are the attacker it stopped.
function touches(action: RoleAction, local: string): "gain" | "loss" | undefined {
  if (action.by === local) {
    const points = action.points ?? 0;
    return points > 0 ? "gain" : points < 0 ? "loss" : undefined;
  }
  const trade = action.trades?.find((entry) => entry.player === local);
  // Points above 0 were paid to the Merchant or Priest.
  if (trade) return trade.points > 0 ? "loss" : trade.points < 0 ? "gain" : undefined;
  return action.on === local ? "loss" : undefined;
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

  // A Roles Yellow Wizard just made yellow the lead suit.
  const sameTrick =
    next.currentTrick.playedCards.length > previous.currentTrick.playedCards.length &&
    previous.currentTrick.playedCards.length > 0;
  const switcher = next.currentTrick.playedCards.at(-1);
  if (sameTrick && switcher && leadSuitOf(previous) !== "Yellow" && leadSuitOf(next) === "Yellow") {
    const by = switcher.playedBy ?? switcher.username;
    messages.push({
      text: by === local ? t("ann.youTurnLead") : t("ann.turnsLead", { name: announcedName(by) }),
      username: by,
      role: true,
    });
  }

  // A Roles Red Wizard's red card on a red lead: no trumps in this trick.
  const shieldedBy = next.currentTrick.playedCards.at(-1);
  if (sameTrick && shieldedBy && !redShieldOf(previous) && redShieldOf(next)) {
    const by = shieldedBy.playedBy ?? shieldedBy.username;
    messages.push({
      text: by === local ? t("ann.youRedShield") : t("ann.redShield", { name: announcedName(by) }),
      username: by,
      role: true,
    });
  }

  // A Sabotage power just used, or passed on.
  const power = powerEvent(previous, next, local);
  if (power) messages.push(power);

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
          ? t(isSabotageGame() ? "sabotage.ann.withFool" : "ann.withJester")
          : t("ann.withCard", { card: cardName(card) });
    messages.push({
      text: `${wins}${withCard}`,
      username: winner,
      trick: true,
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
type PaidText = "harvest" | "barren" | "collect" | "unpaid" | "block" | "blockFree";
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
  smith: ["ann.youForge", "ann.youForge", "ann.forges"],
  merchant: ["ann.yourMarket", "ann.market", "ann.market"],
  priest: ["ann.yourFaith", "ann.faith", "ann.faith"],
  warrior: ["ann.yourBattle", "ann.battle", "ann.battle"],
  block: ["ann.youBlock", "ann.blocksYours", "ann.blocks"],
  blockFree: ["ann.youBlockFree", "ann.blocksFreeYours", "ann.blocksFree"],
};

const PAID_TEXTS: Partial<Record<RoleAction["role"], [PaidText, PaidText]>> = {
  farmer: ["harvest", "barren"],
  shepherd: ["collect", "unpaid"],
  smith: ["block", "blockFree"],
};

const textsFor = (action: RoleAction) => {
  const paid = PAID_TEXTS[action.role];
  return ROLE_TEXTS[action.points === undefined || !paid ? action.role : action.points ? paid[0] : paid[1]];
};

// Seeds and sheep change hands, markets open and Priests are paid, once the
// trick is won.
const AT_TRICK_END: RoleAction["role"][] = ["farmer", "shepherd", "merchant", "priest", "warrior"];

// A Merchant's market in one line: who paid them and whom they paid, e.g.
// "+10 from Rufus, Anna · −5 to Carl".
function marketTrades(action: RoleAction, local: string): string {
  const trades = action.trades ?? [];
  const side = (paid: boolean, key: MessageKey, you: MessageKey): string => {
    const these = trades.filter((trade) => (trade.points < 0) !== paid);
    if (!these.length) return "";
    const points = Math.abs(these.reduce((sum, trade) => sum + trade.points, 0));
    // When not everyone paid the same - someone had less than the full
    // amount, and nobody pays below 0 - each name gets its own amount:
    // "+20 from Lyra 10, Lúthien 10, Oberon 0".
    const even = these.every((trade) => trade.points === these[0]!.points);
    const names = these
      .map((trade) => {
        const name = trade.player === local ? t(you) : announcedName(trade.player);
        return even ? name : `${name} ${Math.abs(trade.points)}`;
      })
      .join(", ");
    return t(key, { points: String(points), names });
  };
  return [side(true, "ann.marketFrom", "ann.marketFromYou"), side(false, "ann.marketTo", "ann.marketToYou")]
    .filter(Boolean)
    .join(" \u00b7 ");
}

// Whether the two snapshots show the same trick: the same while its first
// card is.
function isSameTrick(previous: PublicWizardGameState, next: PublicWizardGameState): boolean {
  const before = previous.currentTrick;
  const now = next.currentTrick;
  const first = (trick: typeof now) => trick.playedCards[0]?.card;
  return (
    previous.currentRound === next.currentRound &&
    before.playedCards.length <= now.playedCards.length &&
    first(before)?.value === first(now)?.value &&
    first(before)?.suit === first(now)?.suit
  );
}

// The powers of a Roles game used since the last snapshot (modes/roles/).
// Those already there in the same trick are left out.
function newRoleActions(previous: PublicWizardGameState, next: PublicWizardGameState): RoleAction[] {
  const said = isSameTrick(previous, next) ? (previous.currentTrick.roleActions?.length ?? 0) : 0;

  return (next.currentTrick.roleActions ?? []).slice(said);
}

// A player as the log names them in a Roles game: "Lúthien (Farmer)".
function withRole(state: PublicWizardGameState, username: string): string {
  const role = state.players.find((player) => player.username === username)?.role;
  return role ? `${announcedName(username)} (${t(`role.${role}`)})` : announcedName(username);
}

// The log's lines for the cards played since the last snapshot, who played
// each and whether its role's power is on, and for a trick won, with the
// winner's role: "Lúthien (Farmer) wins the trick with Green 6".
export function playLogLines(previous: PublicWizardGameState, next: PublicWizardGameState): { text: string; trick?: boolean }[] {
  const lines: { text: string; trick?: boolean }[] = [];
  const playedCards = next.currentTrick.playedCards;
  const roleOf = (username: string) => next.players.find((player) => player.username === username)?.role ?? undefined;
  const from = isSameTrick(previous, next) ? previous.currentTrick.playedCards.length : 0;

  playedCards.slice(from).forEach((played, offset) => {
    const by = played.playedBy ?? played.username;
    const power = rolePowerOn(playedCards, from + offset, next.trumpSuit, roleOf);
    lines.push({ text: t(power ? "log.playsPower" : "log.plays", { name: withRole(next, by), card: cardName(played.card) }) });
  });

  const winner = next.currentTrick.winnerUsername;
  if (winner && previous.currentTrick.winnerUsername !== winner) {
    const won = playedCards.find((entry) => entry.username === winner);
    lines.push({
      text: t("log.winsTrick", { name: withRole(next, winner), card: won ? cardName(won.card) : "" }),
      trick: true,
    });
  }

  return lines;
}

// Who used a role's power since the last snapshot, for their role label to
// light up: a role card just played with its power on, even one that only
// acts once the trick is complete (a Merchant's 7, a Priest's 8); every new
// action; a Yellow Wizard turning the lead and a Red Wizard's shield.
// hitYou: it took from you, though someone else used it.
export function roleUses(
  previous: PublicWizardGameState,
  next: PublicWizardGameState,
  local: string,
): { by: string; hitYou: boolean }[] {
  const playedCards = next.currentTrick.playedCards;
  const roleOf = (username: string) => next.players.find((player) => player.username === username)?.role ?? undefined;
  const from = isSameTrick(previous, next) ? previous.currentTrick.playedCards.length : 0;
  const uses = playedCards
    .slice(from)
    .flatMap((played, offset) =>
      rolePowerOn(playedCards, from + offset, next.trumpSuit, roleOf) ? [{ by: played.playedBy ?? played.username, hitYou: false }] : []);
  uses.push(...newRoleActions(previous, next).map((action) => ({ by: action.by, hitYou: action.by !== local && touches(action, local) === "loss" })));
  const sameTrick =
    next.currentTrick.playedCards.length > previous.currentTrick.playedCards.length &&
    previous.currentTrick.playedCards.length > 0;
  const last = next.currentTrick.playedCards.at(-1);
  const switched = leadSuitOf(previous) !== "Yellow" && leadSuitOf(next) === "Yellow";
  const shielded = !redShieldOf(previous) && redShieldOf(next);
  if (sameTrick && last && (switched || shielded)) uses.push({ by: last.playedBy ?? last.username, hitYou: false });
  return uses;
}

// What to say about each of them: the Thief's steal, the Servant's service,
// the Fisher's catch, a Farmer's seeds and harvests, a Shepherd's sheep and
// payments, a Smith's armour, a Merchant's market and a Priest's faith.
function roleMessages(
  previous: PublicWizardGameState,
  next: PublicWizardGameState,
  local: string,
): (EventMessage & { atTrickEnd: boolean })[] {
  return newRoleActions(previous, next).map((action) => {
    const card = cardName(action.card);
    const values = { name: announcedName(action.by), victim: announcedName(action.on), card, points: String(action.points ?? 0) };
    const about = { role: true, aboutYou: touches(action, local) };
    if (action.role === "merchant") {
      const trades = marketTrades(action, local);
      const text = action.by === local ? t("ann.yourMarket", { trades }) : t("ann.market", { ...values, trades });
      return { text, username: action.by, atTrickEnd: true, ...about };
    }
    if (action.role === "warrior") {
      const trades = marketTrades(action, local);
      const text = action.by === local ? t("ann.yourBattle", { trades }) : t("ann.battle", { ...values, trades });
      return { text, username: action.by, atTrickEnd: true, ...about };
    }
    if (action.role === "priest") {
      // The faith paid and the alms given, in a market's words:
      // "+10 from Rufus, Anna · −5 to Carl".
      const trades = marketTrades(action, local);
      const text = action.by === local ? t("ann.yourFaith", { trades }) : t("ann.faith", { ...values, trades });
      return { text, username: action.by, atTrickEnd: true, ...about };
    }
    const [youUse, usedOnYou, used] = textsFor(action);
    const text = action.by === local ? t(youUse, values) : action.on === local ? t(usedOnYou, values) : t(used, values);
    return { text, username: action.by, atTrickEnd: AT_TRICK_END.includes(action.role), ...about };
  });
}

const LOSS_LABELS: Record<RoleAction["role"], MessageKey> = {
  thief: "ann.stolen",
  servant: "ann.tipped",
  fisher: "ann.fished",
  farmer: "ann.harvested",
  shepherd: "ann.sheepPaid",
  smith: "ann.blocked",
  merchant: "ann.marketLabel",
  priest: "ann.faithLabel",
  warrior: "ann.battleLabel",
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
      // A market is a market whoever gains: the Merchant, those paying him
      // and those he pays. The same for a Priest's faith and alms.
      const label = points < 0 || role === "merchant" || role === "priest" || role === "warrior"
        ? t(LOSS_LABELS[role as RoleAction["role"]])
        : t(`role.${role as RoleAction["role"]}`);
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
