import type { Card } from "../../../../backend/src/game/wizard/models/card";
import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import { burnsWinner, FIRE_BURN } from "../../../../backend/src/game/wizard/modes/roles/master/colourWizards";
import { rolesName } from "../role-names";
import type { RoleAction } from "../../../../backend/src/game/wizard/modes/roles/roles";
import { playerOf, powerOn, rolePowerOn, rolesOfPlayers, type RoleOf } from "../../../../backend/src/game/wizard/modes/roles/rolePlay";
import { trickRolesIn } from "../../../../backend/src/game/wizard/modes/roles/master/trickRoles";
import { WizardRules } from "../../../../backend/src/game/wizard/services/wizardRules";
import { t, type MessageKey } from "../../../i18n";
import {
  announcedName,
  cardName,
  isSameTrick,
  suitName,
  type EventMessage,
} from "../../../visualizer/hud/announcements";

// Roles mode only. What the banners, the standing line, the log and the
// round's results say about the roles' powers, worked out from game state
// alone, as visualizer/hud/announcements.ts does for every mode; that file
// calls these. A game of another mode has no roles and no role actions, so
// all of it says nothing there.

const nameOf = (username: string, local: string) => (username === local ? t("ann.you") : announcedName(username));

const rules = new WizardRules();
const leadSuitOf = (state: PublicWizardGameState) =>
  rules.getLeadSuit(state.currentTrick.playedCards, state.trumpSuit, trickRolesIn(state));
const redShieldOf = (state: PublicWizardGameState) =>
  rules.redShield(state.currentTrick.playedCards, state.trumpSuit, trickRolesIn(state));

// A Yellow Wizard turned the lead: there was a lead suit, not yellow, and now
// yellow leads. After a Jester lead (or none yet) the first card only sets
// the lead suit, as in every game.
const turnedToAir = (previous: PublicWizardGameState, next: PublicWizardGameState): boolean => {
  const before = leadSuitOf(previous);
  return !!before && before !== "Yellow" && leadSuitOf(next) === "Yellow";
};

// Whether this card of the trick raised a Red Wizard's shield.
const raisesShield = (state: PublicWizardGameState, index: number): boolean => {
  const cards = state.currentTrick.playedCards;
  const roles = trickRolesIn(state);
  return !rules.redShield(cards.slice(0, index), state.trumpSuit, roles)
    && rules.redShield(cards.slice(0, index + 1), state.trumpSuit, roles);
};

// A card as the Roles log names it: a Wizard with its element, "Earth Wizard",
// as the colour Wizards' powers and bonuses go by it.
const logCardName = (card: Card): string =>
  card.value === 14 ? t("card.elementWizard", { suit: suitName(card.suit) }) : cardName(card);

const rolesIn = (state: PublicWizardGameState): RoleOf => rolesOfPlayers(state.players);

// The standing line while a Roles move of its own is waiting: a Fisher
// fishing, a Duke keeping or granting the trick. Null in any other phase.
export function roleStatus(state: PublicWizardGameState, local: string): string | null {
  const current = state.players[state.currentPlayerIndex]?.username;
  if (!current) return null;
  if (state.phase === "fishing") {
    return current === local ? t("ann.youFishing") : t("ann.fishing", { name: announcedName(current) });
  }
  if (state.phase === "granting") {
    return current === local ? t("ann.youGranting") : t("ann.granting", { name: announcedName(current) });
  }
  return null;
}

// While a Servant's 2 waits for the next card (modes/roles/servant.ts): who
// will give theirs. Null when no Servant is waiting.
export function servantWaiting(state: PublicWizardGameState, local: string): string | null {
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

// Whether a role's action brought you points or cost you. Your own power:
// by the points it moved, a gain for a steal, a catch or a block that
// bounced, either way for a market or a Priest's faith; nothing for a seed
// or a sheep given or armour forged. Someone else's: a card or points taken,
// a seed or a sheep handed you, a trade or faith with you. For a Smith's
// block, you are the attacker it stopped.
function touches(action: RoleAction, local: string): "gain" | "loss" | undefined {
  // The King's peace stopped your power.
  if (action.stopped) return action.stopped.includes(local) ? "loss" : undefined;
  if (action.by === local) {
    const points = action.points ?? 0;
    return points > 0 ? "gain" : points < 0 ? "loss" : undefined;
  }
  const trade = action.trades?.find((entry) => entry.player === local);
  // Points above 0 were paid to the Merchant or Priest.
  if (trade) return trade.points > 0 ? "loss" : trade.points < 0 ? "gain" : undefined;
  // Points below 0 went the other way: from the one who used the power to
  // the one it was on (a Duke's grant).
  if (action.on === local) return (action.points ?? 0) < 0 ? "gain" : "loss";
  return undefined;
}

// The master roles' moments, said as the card comes out: a Yellow Wizard
// just made yellow the lead suit; a Joker ignoring the suit led; a Red
// Wizard's red card on a red lead, so no trumps in this trick.
export function masterMessages(previous: PublicWizardGameState, next: PublicWizardGameState, local: string): EventMessage[] {
  const messages: EventMessage[] = [];
  const sameTrick =
    next.currentTrick.playedCards.length > previous.currentTrick.playedCards.length &&
    previous.currentTrick.playedCards.length > 0;

  // A Roles Yellow Wizard just made yellow the lead suit.
  const switcher = next.currentTrick.playedCards.at(-1);
  if (sameTrick && switcher && turnedToAir(previous, next)) {
    const by = switcher.playedBy ?? switcher.username;
    // The player who led loses points to it (backend colourWizards.ts AIR_TAKE).
    const lead = next.currentTrick.playedCards.find((played) => played.card.value !== 0);
    const from = lead ? lead.playedBy ?? lead.username : "";
    const text =
      by === local
        ? t("ann.youTurnLead", { from: announcedName(from) })
        : from === local
          ? t("ann.turnsLeadFromYou", { name: announcedName(by) })
          : t("ann.turnsLead", { name: announcedName(by), from: announcedName(from) });
    messages.push({
      text,
      username: by,
      role: true,
    });
  }

  // A Roles Joker played off the suit led, though holding it.
  const free = next.currentTrick.playedCards.at(-1);
  if (sameTrick && free?.freePlay) {
    const by = free.playedBy ?? free.username;
    messages.push({
      text: by === local ? t("ann.youPlayFree") : t("ann.playsFree", { name: announcedName(by) }),
      username: by,
      role: true,
    });
  }

  // A Roles Red Wizard's red card on a red lead: no trumps in this trick,
  // from the lead card itself when they led it.
  const shieldedBy = next.currentTrick.playedCards.at(-1);
  const freshTrick = !isSameTrick(previous, next) && next.currentTrick.playedCards.length === 1;
  if ((sameTrick || freshTrick) && shieldedBy && !(sameTrick && redShieldOf(previous)) && redShieldOf(next)) {
    const by = shieldedBy.playedBy ?? shieldedBy.username;
    // "No trumps" only while it matters: a trump is in the trick, or
    // someone is still to play.
    const cards = next.currentTrick.playedCards;
    const trumped = cards.some((played) => played.card.suit === next.trumpSuit && played.card.value >= 1 && played.card.value <= 13);
    const matters = trumped || cards.length < next.players.length;
    messages.push({
      text: matters
        ? by === local ? t("ann.youRedShield") : t("ann.redShield", { name: announcedName(by) })
        : by === local ? t("ann.youRedShieldPlain") : t("ann.redShieldPlain", { name: announcedName(by) }),
      username: by,
      role: true,
    });
  }

  // A higher red card beat the shield: its winner is burned.
  const winner = next.currentTrick.winnerUsername;
  if (winner && previous.currentTrick.winnerUsername !== winner && burnsWinner(next.currentTrick, next.trumpSuit, trickRolesIn(next), winnerOf(next, winner))) {
    messages.push({
      text: winner === local ? t("ann.youBurned", { points: String(FIRE_BURN) }) : t("ann.burns", { name: announcedName(winner), points: String(FIRE_BURN) }),
      username: winner,
      role: true,
    });
  }

  return messages;
}

const winnerOf = (state: PublicWizardGameState, username: string) =>
  state.players.find((player) => player.username === username) ?? { username, role: null, masterRole: null };

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
  gambler: ["ann.youBetWon", "ann.betWon", "ann.betWon"],
  duke: ["ann.youKeep", "ann.keeps", "ann.keeps"],
  prophet: ["ann.youForesee", "ann.foresees", "ann.foresees"],
  king: ["ann.yourTax", "ann.tax", "ann.tax"],
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
const AT_TRICK_END: RoleAction["role"][] = ["farmer", "shepherd", "merchant", "priest", "warrior", "gambler", "duke", "prophet", "king"];

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
    .join(" · ");
}

// The powers of a Roles game used since the last snapshot (modes/roles/).
// Those already there in the same trick are left out.
function newRoleActions(previous: PublicWizardGameState, next: PublicWizardGameState): RoleAction[] {
  const said = isSameTrick(previous, next) ? (previous.currentTrick.roleActions?.length ?? 0) : 0;

  return (next.currentTrick.roleActions ?? []).slice(said);
}

// A player's role in this state, if any.
const roleOfIn = (state: PublicWizardGameState, username: string) =>
  state.players.find((player) => player.username === username)?.role ?? undefined;

// A player as the log names them in a Roles game: "Lúthien (Farmer)".
function withRole(state: PublicWizardGameState, username: string): string {
  const player = state.players.find((entry) => entry.username === username);
  const roles = player ? rolesName(player) : "";
  return roles ? `${announcedName(username)} (${roles})` : announcedName(username);
}

// The log's lines for the cards played since the last snapshot, who played
// each and whether its role's power is on, and for a trick won, with the
// winner's role: "Lúthien (Farmer) wins the trick with Green 6".
export function playLogLines(previous: PublicWizardGameState, next: PublicWizardGameState): { text: string; trick?: boolean }[] {
  const lines: { text: string; trick?: boolean }[] = [];
  const playedCards = next.currentTrick.playedCards;
  const roleOf = rolesOfPlayers(next.players);
  const from = isSameTrick(previous, next) ? previous.currentTrick.playedCards.length : 0;

  playedCards.slice(from).forEach((played, offset) => {
    const by = played.playedBy ?? played.username;
    // A Red Wizard's card that raised the shield is marked as a power too.
    const power = rolePowerOn(playedCards, from + offset, next.trumpSuit, roleOf) || raisesShield(next, from + offset);
    // A Thief's 1 that leads has nothing before it to take; the power is
    // still on, so the log says why nothing is stolen.
    const leads = power && from + offset === 0 && roleOf(by) === "thief" ? ` ${t("log.thiefLeads")}` : "";
    const bet = played.bet ? ` ${t("log.bets")}` : played.lowered ? ` ${t("log.lowers")}` : played.lowered === false ? ` ${t("log.keepsBid")}` : played.freePlay ? ` ${t("log.playsFree")}` : "";
    lines.push({ text: t(power ? "log.playsPower" : "log.plays", { name: withRole(next, by), card: logCardName(played.card) }) + leads + bet });
  });

  const winner = next.currentTrick.winnerUsername;
  if (winner && previous.currentTrick.winnerUsername !== winner) {
    const won = playedCards.find((entry) => entry.username === winner);
    lines.push({
      text: t("log.winsTrick", { name: withRole(next, winner), card: won ? logCardName(won.card) : "" }),
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
  const roleOf = rolesOfPlayers(next.players);
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
  const switched = turnedToAir(previous, next);
  const shielded = !redShieldOf(previous) && redShieldOf(next);
  if (sameTrick && last && (switched || shielded || last.freePlay)) uses.push({ by: last.playedBy ?? last.username, hitYou: false });
  return uses;
}

// What to say about each of them: the Thief's steal, the Servant's service,
// the Fisher's catch, a Farmer's seeds and harvests, a Shepherd's sheep and
// payments, a Smith's armour, a Merchant's market and a Priest's faith.
// atTrickEnd: said after who won the trick, as it happens once it is won.
export function roleMessages(
  previous: PublicWizardGameState,
  next: PublicWizardGameState,
  local: string,
): (EventMessage & { atTrickEnd: boolean })[] {
  // A King's tax or tribute that took nothing is not told.
  const told = newRoleActions(previous, next).filter((action) => !(action.role === "king" && !action.stopped && (action.points ?? 0) === 0));
  return told.map((action) => {
    const card = cardName(action.card);
    const values = { name: announcedName(action.by), victim: announcedName(action.on), card, points: String(action.points ?? 0) };
    const about = { role: true, aboutYou: touches(action, local) };
    if (action.role === "merchant") {
      const trades = marketTrades(action, local);
      const text = action.by === local ? t("ann.yourMarket", { trades }) : t("ann.market", { ...values, trades });
      return { text, username: action.by, atTrickEnd: true, ...about };
    }
    if (action.role === "gambler") {
      const points = String(Math.abs(action.points ?? 0));
      const won = (action.points ?? 0) > 0;
      const text = action.lucky
        ? action.by === local ? t("ann.youLucky", { points }) : t("ann.lucky", { ...values, points })
        : won
        ? action.by === local ? t("ann.youBetWon", { points }) : t("ann.betWon", { ...values, points })
        : action.by === local
          ? t("ann.youBetLost", { ...values, points })
          : t("ann.betLost", { ...values, points });
      return { text, username: action.by, atTrickEnd: true, ...about };
    }
    if (action.role === "king" && action.stopped) {
      // The King's peace, told to everyone: whom it stopped, and that what
      // was done is undone.
      const stopped = action.stopped.map((username) => nameOf(username, local)).join(", ");
      const undone = next.currentTrick.roleActions?.some((entry) => entry.undone) ? ` ${t("ann.peaceUndone")}` : "";
      const who = action.stopped.length ? ` ${t("ann.peaceStopped", { names: stopped })}` : "";
      const text = (action.by === local ? t("ann.yourPeace") : t("ann.peace", values)) + who + undone;
      return { text, username: action.by, atTrickEnd: false, ...about };
    }
    if (action.role === "king" && action.card.suit === next.trumpSuit) {
      // The tribute for the King's peace, won with his trump 13, in a
      // market's words; the Priest pays none.
      const trades = marketTrades(action, local);
      const priest = next.players.some((player) => player.role === "priest" && player.username !== action.by);
      const text = (action.by === local ? t("ann.yourTribute", { trades }) : t("ann.tribute", { ...values, trades }))
        + (priest ? ` ${t("ann.tributePriest")}` : "");
      return { text, username: action.by, atTrickEnd: true, ...about };
    }
    if (action.role === "king") {
      // The King's tax, in a market's words, and the Priest let off.
      const trades = marketTrades(action, local);
      const priest = next.currentTrick.playedCards.some((played, index) =>
        roleOfIn(next, played.playedBy ?? played.username) === "priest" && rolePowerOn(next.currentTrick.playedCards, index, next.trumpSuit, rolesOfPlayers(next.players)));
      const text = (action.by === local ? t("ann.yourTax", { trades }) : t("ann.tax", { ...values, trades }))
        + (priest ? ` ${t("ann.taxPriest")}` : "");
      return { text, username: action.by, atTrickEnd: true, ...about };
    }
    if (action.role === "duke") {
      const points = String(Math.abs(action.points ?? 0));
      const text = action.by === action.on
        ? action.by === local ? t("ann.youKeep", { points }) : t("ann.keeps", { ...values, points })
        : action.by === local
          ? t("ann.youGrant", { ...values, points })
          : action.on === local
            ? t("ann.grantsYours", { ...values, points })
            : t("ann.grants", { ...values, points });
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
      // Faith received and alms given (their 8 won) are told apart.
      const faith = (action.trades ?? []).filter((trade) => trade.points >= 0);
      const alms = (action.trades ?? []).filter((trade) => trade.points < 0);
      const parts: string[] = [];
      if (faith.length) {
        const trades = marketTrades({ ...action, trades: faith }, local);
        parts.push(action.by === local ? t("ann.yourFaith", { trades }) : t("ann.faith", { ...values, trades }));
      }
      if (alms.length) {
        const trades = marketTrades({ ...action, trades: alms }, local);
        parts.push(action.by === local ? t("ann.yourAlms", { trades }) : t("ann.alms", { ...values, trades }));
      }
      const text = parts.join(" ");
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
  gambler: "ann.betLabel",
  duke: "ann.grantLabel",
  prophet: "role.prophet",
  king: "ann.taxLabel",
};

// The label of a role's line in the round's results (roundResults in
// visualizer/hud/announcements.ts): what the role's power brought this
// round.
export function roleBonusLabel(role: string, points: number): string {
  // Burned by the Power of Fire's shield (backend master/colourWizards.ts).
  if (role === "redWizard" && points < 0) return t("ann.burned");
  // The lead the Power of Air turned, and the points it took with it.
  if (role === "yellowWizard" && points < 0) return t("ann.leadTaken");
  // Points another player's power took are a loss of their own: robbed by
  // a Thief, a Servant's tip, a Fisher's catch, a Farmer's harvest, a
  // Shepherd's sheep.
  // A market is a market whoever gains: the Merchant, those paying him
  // and those he pays. The same for a Priest's faith and alms.
  return points < 0 || role === "merchant" || role === "priest" || role === "warrior" || role === "gambler"
    ? t(LOSS_LABELS[role as RoleAction["role"]])
    : t(`role.${role as RoleAction["role"]}`);
}
