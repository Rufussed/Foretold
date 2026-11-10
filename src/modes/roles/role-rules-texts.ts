import type { RoleId } from "../../../backend/src/game/wizard/modes/roles/roles";
import type { Language } from "../../i18n";

// Roles mode only. What every role and power does, as a rules card in fixed
// fields, the same order for all (role-rules.ts draws it): the card and
// where it must be played, when it acts, what it does, the points, its
// limits (every tie, Wizard, Jester, trump, armour and King's peace case)
// and one example. The role's story stays apart (role.X.story in en.ts).
// One entry per role with both languages side by side, so a translation can
// be read against its source. Must match the backend (modes/roles/).

export interface RoleRules {
  card: string;
  when: string;
  effect: string;
  points: string;
  limits: string[];
  example: string;
}

export const ROLE_RULES: Record<RoleId, Record<Language, RoleRules>> = {
  thief: {
    en: {
      card: "Your 1, in any suit.",
      when: "At once, as you play it.",
      effect: "Your 1 swaps places with a card already played: in the suit led or off suit, the card just before it; as a trump, any card before it, your choice (the nearest if you do not choose). That player gets your 1.",
      points: "In the suit led or as a trump, you take 10 points from that player, never more than they have. Off suit you still steal the card, but no points.",
      limits: [
        "Leading the trick with your 1: there is nothing to steal.",
        "You cannot take a Wizard, a Jester or a Servant's 2. In the suit led or off suit, if the card just before is one of these, the steal fails: it never reaches further back.",
        "A Smith in armour keeps their card: a piece is used up and you pay the Smith 5.",
        "The King's peace undoes the steal, points and all.",
      ],
      example: "Ana plays the fire 12, you play the fire 1: you take her 12, she gets your 1, and you take 10 points from her. With a water 1 (water not trumps) you still take her 12, but no points. Had she played a Wizard, nothing would happen.",
    },
    de: {
      card: "Deine 1, in jeder Farbe.",
      when: "Sofort, wenn du sie spielst.",
      effect: "Deine 1 tauscht den Platz mit einer schon gespielten Karte: in der angespielten Farbe oder in einer fremden Farbe mit der Karte direkt davor; als Trumpf mit einer beliebigen Karte davor, nach deiner Wahl (ohne Wahl die nächste). Dieser Spieler bekommt deine 1.",
      points: "In der angespielten Farbe oder als Trumpf nimmst du diesem Spieler 10 Punkte ab, nie mehr, als er hat. In einer fremden Farbe stiehlst du die Karte trotzdem, aber keine Punkte.",
      limits: [
        "Spielst du die 1 als erste Karte des Stichs aus, gibt es nichts zu stehlen.",
        "Einen Zauberer, einen Narren oder die 2 eines Dieners kannst du nicht nehmen. Ist in der angespielten oder einer fremden Farbe die Karte direkt davor eine davon, scheitert der Diebstahl: Er greift nie weiter zurück.",
        "Ein Schmied mit Rüstung behält seine Karte: Ein Teil wird verbraucht, und du zahlst dem Schmied 5.",
        "Der Frieden des Königs macht den Diebstahl rückgängig, samt Punkten.",
      ],
      example: "Ana spielt die Feuer-12, du die Feuer-1: Du nimmst ihre 12, sie bekommt deine 1, und du nimmst ihr 10 Punkte ab. Mit einer Wasser-1 (Wasser ist nicht Trumpf) nimmst du ihre 12 trotzdem, aber keine Punkte. Hätte sie einen Zauberer gespielt, geschähe nichts.",
    },
  },
  servant: {
    en: {
      card: "Your 2, in any suit.",
      when: "As the next player plays their card.",
      effect: "The next card played becomes yours; its player gets your 2.",
      points: "In the suit led or as a trump, that player tips you 10 points at once. Off suit you serve a stranger: no tip for the service. Either way they tip you 10 if you win the trick. Never more than they have.",
      limits: [
        "Nothing happens if your 2 is the last card of the trick.",
        "Nothing happens if the next card is a Wizard, a Jester, a Thief's 1 or another Servant's 2.",
        "A Smith in armour keeps their card: a piece is used up and you pay the Smith 5.",
        "The King's peace undoes the service, points and all.",
      ],
      example: "You play the fire 2, then Ben plays the fire 13: the 13 is yours, Ben gets your 2 and tips you 10. Win the trick and he tips you 10 more. With a water 2 (water not trumps) the 13 is still yours, but Ben tips you only if you win.",
    },
    de: {
      card: "Deine 2, in jeder Farbe.",
      when: "Wenn der nächste Spieler seine Karte spielt.",
      effect: "Die nächste gespielte Karte wird deine; ihr Spieler bekommt deine 2.",
      points: "In der angespielten Farbe oder als Trumpf gibt dir dieser Spieler sofort 10 Punkte Trinkgeld. In einer fremden Farbe dienst du einem Fremden: kein Trinkgeld für den Dienst. So oder so gibt er dir 10, wenn du den Stich gewinnst. Nie mehr, als er hat.",
      limits: [
        "Ist deine 2 die letzte Karte des Stichs, geschieht nichts.",
        "Ist die nächste Karte ein Zauberer, ein Narr, die 1 eines Diebs oder die 2 eines anderen Dieners, geschieht nichts.",
        "Ein Schmied mit Rüstung behält seine Karte: Ein Teil wird verbraucht, und du zahlst dem Schmied 5.",
        "Der Frieden des Königs macht den Dienst rückgängig, samt Punkten.",
      ],
      example: "Du spielst die Feuer-2, dann Ben die Feuer-13: Die 13 ist deine, Ben bekommt deine 2 und gibt dir 10. Gewinnst du den Stich, gibt er dir 10 mehr. Mit einer Wasser-2 (Wasser ist nicht Trumpf) ist die 13 trotzdem deine, aber Ben gibt dir nur etwas, wenn du gewinnst.",
    },
  },
  fisher: {
    en: {
      card: "Your 3, in the suit led or as a trump (any suit after a Wizard lead).",
      when: "When the trick is complete, before it is won.",
      effect: "Pick one card played after your 3 and swap it for the card you hold. You have 15 seconds; then a card is picked at random.",
      points: "That card's player pays you 10 points if it wins you the trick, 5 if it does not. Never more than they have.",
      limits: [
        "If no card was played after your 3, there is nothing to fish.",
        "You cannot fish a Wizard, a Jester or your own card.",
        "If a Thief or a Servant took your 3, you still fish, with whatever card you hold now.",
        "A Smith in armour keeps their card: a piece is used up, your catch is lost and you pay the Smith 5.",
        "The King's peace stops it.",
      ],
      example: "You play the fire 3, then Cid plays the fire 11: you fish the 11 and Cid gets your 3. If the 11 wins you the trick, Cid pays you 10.",
    },
    de: {
      card: "Deine 3, in der angespielten Farbe oder als Trumpf (nach einem Zauberer als erster Karte in jeder Farbe).",
      when: "Wenn der Stich vollständig ist, bevor er gewonnen wird.",
      effect: "Wähle eine Karte, die nach deiner 3 gespielt wurde, und tausche sie gegen die Karte, die du hältst. Du hast 15 Sekunden; danach wird zufällig gewählt.",
      points: "Der Spieler dieser Karte zahlt dir 10 Punkte, wenn sie dir den Stich bringt, sonst 5. Nie mehr, als er hat.",
      limits: [
        "Wurde nach deiner 3 keine Karte gespielt, gibt es nichts zu fischen.",
        "Einen Zauberer, einen Narren oder deine eigene Karte kannst du nicht fischen.",
        "Hat ein Dieb oder ein Diener deine 3 genommen, fischst du trotzdem, mit der Karte, die du jetzt hältst.",
        "Ein Schmied mit Rüstung behält seine Karte: Ein Teil wird verbraucht, dein Fang ist verloren, und du zahlst dem Schmied 5.",
        "Der Frieden des Königs hält sie auf.",
      ],
      example: "Du spielst die Feuer-3, dann Cid die Feuer-11: Du fischst die 11, Cid bekommt deine 3. Bringt dir die 11 den Stich, zahlt Cid dir 10.",
    },
  },
  farmer: {
    en: {
      card: "Your 4, in any suit.",
      when: "When the trick is won; the harvest at the end of the round.",
      effect: "Whoever wins the trick takes one of your seeds, two if your 4 is a trump. Seeds stay from round to round. When you make your prediction exactly, you harvest all your seeds at the end of the round.",
      points: "At the harvest, every holder pays you 5 points per seed of yours, never more than they have. If you miss your prediction, the seeds wait.",
      limits: [
        "If you win the trick yourself, no seed is planted.",
        "A player holds 4 seeds at most, of all Farmers together; a seed beyond that is lost, so a trump 4 may plant only one, or none.",
        "If a Thief or a Servant took your 4, it still plants, for whoever wins the trick.",
        "A Smith's armour blocks one seed per piece at the harvest, and you pay the Smith 5 per block.",
        "The King's peace stops the seed.",
      ],
      example: "Your earth 4 is in a trick Ana wins: she holds one of your seeds. You make your prediction: Ana pays you 5.",
    },
    de: {
      card: "Deine 4, in jeder Farbe.",
      when: "Wenn der Stich gewonnen wird; die Ernte am Ende der Runde.",
      effect: "Wer den Stich gewinnt, nimmt einen deiner Samen, zwei, wenn deine 4 Trumpf ist. Samen bleiben von Runde zu Runde. Triffst du deine Vorhersage genau, erntest du am Ende der Runde alle deine Samen.",
      points: "Bei der Ernte zahlt dir jeder Halter 5 Punkte pro Samen von dir, nie mehr, als er hat. Verfehlst du deine Vorhersage, warten die Samen.",
      limits: [
        "Gewinnst du den Stich selbst, wird kein Samen gesät.",
        "Ein Spieler hält höchstens 4 Samen, von allen Bauern zusammen; ein Samen darüber hinaus geht verloren, also sät eine Trumpf-4 vielleicht nur einen oder keinen.",
        "Hat ein Dieb oder ein Diener deine 4 genommen, sät sie trotzdem, für den, der den Stich gewinnt.",
        "Die Rüstung eines Schmieds blockt bei der Ernte einen Samen pro Teil, und du zahlst dem Schmied 5 pro Block.",
        "Der Frieden des Königs hält den Samen auf.",
      ],
      example: "Deine Erde-4 liegt in einem Stich, den Ana gewinnt: Sie hält einen deiner Samen. Du triffst deine Vorhersage: Ana zahlt dir 5.",
    },
  },
  shepherd: {
    en: {
      card: "Your 5, in any suit.",
      when: "When the trick is won.",
      effect: "Whoever wins the trick takes one of your 3 sheep. Sheep stay from round to round. When you win a trick with your own 5, all your sheep come home and are paid for. Your 5 counts 1 higher for each sheep out: +1, +2, at most +3, and it wins a tie (with 2 sheep out it beats a 7). Once the flock is home it is a plain 5 again.",
      points: "When you win with your 5, every holder pays you 20 points per sheep, never more than they have.",
      limits: [
        "If you win the trick yourself with another card, no sheep is given and nothing is collected.",
        "Only your own 5 collects: if a Thief takes it and wins, the Thief takes a sheep. A 5 someone took is a plain 5, with no +.",
        "A boosted 5 that loses still gives the winner a sheep, while you have one left.",
        "With all 3 sheep out, no more are given.",
        "A Smith's armour blocks one sheep per piece, and you pay the Smith 5 per block.",
        "The King's peace stops it.",
      ],
      example: "Ben wins a trick with your 5 in it: he holds one of your sheep. Now your 5 is a 6: you play it on a fire 6 and win the tie, so Ben pays you 20.",
    },
    de: {
      card: "Deine 5, in jeder Farbe.",
      when: "Wenn der Stich gewonnen wird.",
      effect: "Wer den Stich gewinnt, nimmt eines deiner 3 Schafe. Schafe bleiben von Runde zu Runde. Gewinnst du einen Stich mit deiner eigenen 5, kommen alle Schafe heim und werden bezahlt. Deine 5 zählt für jedes Schaf draußen 1 mehr: +1, +2, höchstens +3, und bei Gleichstand gewinnt sie (mit 2 Schafen draußen schlägt sie eine 7). Sind alle Schafe daheim, ist sie wieder eine einfache 5.",
      points: "Gewinnst du mit deiner 5, zahlt dir jeder Halter 20 Punkte pro Schaf, nie mehr, als er hat.",
      limits: [
        "Gewinnst du den Stich selbst mit einer anderen Karte, wird kein Schaf vergeben und nichts eingesammelt.",
        "Nur deine eigene 5 sammelt ein: Nimmt ein Dieb sie und gewinnt, bekommt der Dieb ein Schaf. Eine 5, die jemand genommen hat, ist eine einfache 5, ohne +.",
        "Verliert deine verstärkte 5, bekommt der Gewinner trotzdem ein Schaf, solange du eines übrig hast.",
        "Sind alle 3 Schafe draußen, werden keine weiteren vergeben.",
        "Die Rüstung eines Schmieds blockt ein Schaf pro Teil, und du zahlst dem Schmied 5 pro Block.",
        "Der Frieden des Königs hält sie auf.",
      ],
      example: "Ben gewinnt einen Stich mit deiner 5 darin: Er hält eines deiner Schafe. Jetzt ist deine 5 eine 6: Du spielst sie auf eine Feuer-6 und gewinnst den Gleichstand, also zahlt Ben dir 20.",
    },
  },
  smith: {
    en: {
      card: "Your 6, in the suit led or as a trump (any suit after a Wizard lead).",
      when: "At once, as you play it.",
      effect: "You forge a piece of armour, 3 at most, kept from round to round. Each piece blocks one power used against you and is used up.",
      points: "A block cancels the attack, and the attacker pays you 5 points, never more than they have. Against a Merchant, a Priest, a Warrior or the King's tax, you pay nothing and are paid 5 instead.",
      limits: [
        "It blocks a steal, a service or a catch of your card; one seed or one sheep you would pay for; a payment to a Merchant, a Priest or a Warrior; and the King's tax.",
        "Armour is used on the first attack, on its own: you cannot save it.",
        "It never blocks the King's tribute.",
        "The King's peace stops forging, and armour forged in that trick is taken back.",
      ],
      example: "You wear one piece and a Thief tries to take your card: the steal fails, the piece is used up, and the Thief pays you 5.",
    },
    de: {
      card: "Deine 6, in der angespielten Farbe oder als Trumpf (nach einem Zauberer als erster Karte in jeder Farbe).",
      when: "Sofort, wenn du sie spielst.",
      effect: "Du schmiedest ein Rüstungsteil, höchstens 3, die von Runde zu Runde bleiben. Jedes Teil blockt eine Kraft, die gegen dich wirkt, und wird dabei verbraucht.",
      points: "Ein Block hebt den Angriff auf, und der Angreifer zahlt dir 5 Punkte, nie mehr, als er hat. Gegen einen Händler, einen Priester, einen Krieger oder die Steuer des Königs zahlst du nichts und bekommst stattdessen 5.",
      limits: [
        "Sie blockt einen Diebstahl, einen Dienst oder einen Fang deiner Karte; einen Samen oder ein Schaf, für das du zahlen würdest; eine Zahlung an einen Händler, einen Priester oder einen Krieger; und die Steuer des Königs.",
        "Die Rüstung wird beim ersten Angriff von selbst verbraucht: Du kannst sie nicht aufsparen.",
        "Den Tribut des Königs blockt sie nie.",
        "Der Frieden des Königs hält das Schmieden auf, und eine in diesem Stich geschmiedete Rüstung geht wieder.",
      ],
      example: "Du trägst ein Teil, und ein Dieb will deine Karte nehmen: Der Diebstahl scheitert, das Teil wird verbraucht, und der Dieb zahlt dir 5.",
    },
  },
  merchant: {
    en: {
      card: "Your 7, in the suit led or as a trump (any suit after a Wizard lead).",
      when: "The market opens as you play the 7, and trades when the trick ends, whoever wins.",
      effect: "Your 7 trades with every other card in the trick by its number alone, whatever its suit.",
      points: "Every card of 7 or lower pays you 5 points, never more than its player has. You pay 5 to every card above 7, in full, even below 0.",
      limits: [
        "Suit, trumps and the lead do not matter, so an Air turn after your 7 changes nothing.",
        "It always trades at 7, even when a Thief, a Servant or a Fisher took your 7. Each card trades for whoever played it.",
        "Wizards and Jesters do not trade. The Power of Earth's +3 does not count.",
        "A Smith in armour who would pay uses up a piece instead, and you pay the Smith 5.",
        "The King's peace stops it.",
      ],
      example: "Your fire 7 meets an earth 3, a water 7 and a fire 12: the 3 and the other 7 pay you 5 each, you pay the 12 5. You end with +5.",
    },
    de: {
      card: "Deine 7, in der angespielten Farbe oder als Trumpf (nach einem Zauberer als erster Karte in jeder Farbe).",
      when: "Der Markt öffnet, wenn du die 7 spielst, und handelt am Ende des Stichs, egal wer gewinnt.",
      effect: "Deine 7 handelt mit jeder anderen Karte im Stich, allein nach ihrer Zahl, egal welche Farbe.",
      points: "Jede Karte bis 7 zahlt dir 5 Punkte, nie mehr, als ihr Spieler hat. Jeder Karte über 7 zahlst du 5, voll, auch unter 0.",
      limits: [
        "Farbe, Trumpf und angespielte Farbe zählen nicht, also ändert ein Wechsel der Luft nach deiner 7 nichts.",
        "Gehandelt wird immer zur 7, auch wenn ein Dieb, ein Diener oder ein Fischer deine 7 genommen hat. Jede Karte handelt für den, der sie gespielt hat.",
        "Zauberer und Narren handeln nicht. Das +3 der Kraft der Erde zählt nicht.",
        "Ein Schmied mit Rüstung, der zahlen müsste, verbraucht stattdessen ein Teil, und du zahlst dem Schmied 5.",
        "Der Frieden des Königs hält ihn auf.",
      ],
      example: "Deine Feuer-7 trifft auf eine Erde-3, eine Wasser-7 und eine Feuer-12: Die 3 und die andere 7 zahlen dir je 5, du zahlst der 12 5. Am Ende hast du +5.",
    },
  },
  priest: {
    en: {
      card: "Your 8, in the suit led or as a trump (any suit after a Wizard lead).",
      when: "When the trick ends, whoever wins.",
      effect: "Every royal card, an 11, 12 or 13 of any suit, played by another player in the trick pays you faith. If your own 8 wins the trick, you feed the poor.",
      points: "Each royal pays you 5 points, never more than its player has. If your 8 wins, you pay 5 to every card from 1 to 7 played by others, in full, even below 0.",
      limits: [
        "Royals played before or after your 8 both pay; whoever played the royal pays.",
        "Wizards are not royal, and Jesters are not poor.",
        "If a Thief takes your 8, the royals still pay you; there are alms only if you win holding your own 8.",
        "You pay the King no tax and no tribute.",
        "A Smith in armour who would pay uses up a piece instead, and you pay the Smith 5.",
        "The King's peace stops it.",
      ],
      example: "A fire 12 and a water 13 are in the trick with your fire 8: you get 10. Had your 8 won with a 3 in the trick, you would pay that player 5.",
    },
    de: {
      card: "Deine 8, in der angespielten Farbe oder als Trumpf (nach einem Zauberer als erster Karte in jeder Farbe).",
      when: "Am Ende des Stichs, egal wer gewinnt.",
      effect: "Jede königliche Karte, eine 11, 12 oder 13 in jeder Farbe, die ein anderer Spieler in den Stich gespielt hat, zahlt dir Glaubenspunkte. Gewinnt deine eigene 8 den Stich, speist du die Armen.",
      points: "Jede königliche Karte zahlt dir 5 Punkte, nie mehr, als ihr Spieler hat. Gewinnt deine 8, zahlst du jeder Karte von 1 bis 7 der anderen 5, voll, auch unter 0.",
      limits: [
        "Königliche Karten vor und nach deiner 8 zahlen beide; es zahlt, wer die Karte gespielt hat.",
        "Zauberer sind nicht königlich, und Narren sind nicht arm.",
        "Nimmt ein Dieb deine 8, zahlen die königlichen Karten trotzdem dir; Almosen gibt es nur, wenn du mit deiner eigenen 8 gewinnst.",
        "Dem König zahlst du weder Steuer noch Tribut.",
        "Ein Schmied mit Rüstung, der zahlen müsste, verbraucht stattdessen ein Teil, und du zahlst dem Schmied 5.",
        "Der Frieden des Königs hält ihn auf.",
      ],
      example: "Eine Feuer-12 und eine Wasser-13 liegen mit deiner Feuer-8 im Stich: Du bekommst 10. Hätte deine 8 mit einer 3 im Stich gewonnen, zahltest du diesem Spieler 5.",
    },
  },
  warrior: {
    en: {
      card: "Your 9, in the suit led or as a trump.",
      when: "When the trick ends.",
      effect: "If your own 9 wins the trick, every other player pays you. If your 9 was a trump and loses, you pay every other player, out of pride.",
      points: "Won: every other player pays you 10, never more than they have. A trump 9 lost: you pay every other player 5, in full, even below 0.",
      limits: [
        "A 9 in the suit led that loses costs nothing.",
        "A trump 9 that a Thief, a Servant or a Fisher took counts as lost, even if they win with it.",
        "After a Wizard in the trick your 9 cannot win: it has no power, and there is no pride to pay.",
        "A Smith in armour who would pay uses up a piece instead, and you pay the Smith 5.",
        "The King's peace stops it.",
      ],
      example: "Water is trumps and your water 9 wins: the three others pay you 10 each. Beaten by the water 12, you pay each of them 5.",
    },
    de: {
      card: "Deine 9, in der angespielten Farbe oder als Trumpf.",
      when: "Am Ende des Stichs.",
      effect: "Gewinnt deine eigene 9 den Stich, zahlt dir jeder andere Spieler. War deine 9 Trumpf und verliert, zahlst du aus Stolz jedem anderen Spieler.",
      points: "Gewonnen: Jeder andere Spieler zahlt dir 10, nie mehr, als er hat. Trumpf-9 verloren: Du zahlst jedem anderen Spieler 5, voll, auch unter 0.",
      limits: [
        "Eine 9 in der angespielten Farbe, die verliert, kostet nichts.",
        "Eine Trumpf-9, die ein Dieb, ein Diener oder ein Fischer genommen hat, gilt als verloren, auch wenn er mit ihr gewinnt.",
        "Nach einem Zauberer im Stich kann deine 9 nicht gewinnen: Sie hat keine Kraft, und es ist kein Stolz zu zahlen.",
        "Ein Schmied mit Rüstung, der zahlen müsste, verbraucht stattdessen ein Teil, und du zahlst dem Schmied 5.",
        "Der Frieden des Königs hält ihn auf.",
      ],
      example: "Wasser ist Trumpf, und deine Wasser-9 gewinnt: Die drei anderen zahlen dir je 10. Schlägt sie die Wasser-12, zahlst du jedem 5.",
    },
  },
  gambler: {
    en: {
      card: "Your 10, in the suit led or as a trump.",
      when: "You choose as you play the 10; the bet is settled when the trick ends.",
      effect: "Bet that your 10 wins the trick, or do not.",
      points: "Bet and won: +25. Bet and lost: −10 to the house, in full, even below 0. No bet and your 10 wins: +5 lucky points.",
      limits: [
        "Only your own 10 counts: if a Thief, a Servant or a Fisher takes it, your bet is lost.",
        "After a Wizard in the trick your 10 cannot win: no bet can be made.",
        "The King's peace stops it, bet and all.",
      ],
      example: "You bet on the fire 10. If nobody plays a higher fire card, a trump or a Wizard: +25.",
    },
    de: {
      card: "Deine 10, in der angespielten Farbe oder als Trumpf.",
      when: "Du wählst, wenn du die 10 spielst; die Wette wird am Ende des Stichs abgerechnet.",
      effect: "Wette, dass deine 10 den Stich gewinnt, oder lass es.",
      points: "Gewettet und gewonnen: +25. Gewettet und verloren: −10 an die Bank, voll, auch unter 0. Ohne Wette, und deine 10 gewinnt: +5 Glückspunkte.",
      limits: [
        "Nur deine eigene 10 zählt: Nimmt ein Dieb, ein Diener oder ein Fischer sie, ist deine Wette verloren.",
        "Nach einem Zauberer im Stich kann deine 10 nicht gewinnen: Es kann nicht gewettet werden.",
        "Der Frieden des Königs hält ihn auf, samt Wette.",
      ],
      example: "Du wettest auf die Feuer-10. Spielt niemand eine höhere Feuerkarte, einen Trumpf oder einen Zauberer: +25.",
    },
  },
  duke: {
    en: {
      card: "Your 11, in the suit led or as a trump.",
      when: "When your own 11 wins the trick.",
      effect: "Keep the trick, or grant it to any other player. A granted trick counts for them, not for you; the trick's other powers still count you as its winner, and you lead the next trick. You have 15 seconds; then the trick is kept.",
      points: "Kept: +10. Granted: you pay that player 5, in full, even below 0.",
      limits: [
        "Only your own 11: if a Thief, a Servant or a Fisher won with it, there is no choice.",
        "After a Wizard in the trick your 11 cannot win: it has no power.",
        "The King's peace stops it.",
      ],
      example: "You predicted 1 and already won it, and your 11 wins again: grant the trick to Ana for 5, and you stay on 1.",
    },
    de: {
      card: "Deine 11, in der angespielten Farbe oder als Trumpf.",
      when: "Wenn deine eigene 11 den Stich gewinnt.",
      effect: "Behalte den Stich oder schenke ihn einem anderen Spieler. Ein geschenkter Stich zählt für ihn, nicht für dich; die übrigen Kräfte des Stichs zählen dich weiter als Gewinner, und du spielst den nächsten Stich an. Du hast 15 Sekunden; danach wird der Stich behalten.",
      points: "Behalten: +10. Geschenkt: Du zahlst diesem Spieler 5, voll, auch unter 0.",
      limits: [
        "Nur deine eigene 11: Hat ein Dieb, ein Diener oder ein Fischer mit ihr gewonnen, gibt es keine Wahl.",
        "Nach einem Zauberer im Stich kann deine 11 nicht gewinnen: Sie hat keine Kraft.",
        "Der Frieden des Königs hält ihn auf.",
      ],
      example: "Du hast 1 vorhergesagt und schon gewonnen, und deine 11 gewinnt wieder: Schenke Ana den Stich für 5, und du bleibst bei 1.",
    },
  },
  prophet: {
    en: {
      card: "Your 12, in the suit led or as a trump.",
      when: "You choose as you play the 12.",
      effect: "Lower your prediction by 1, or keep it. Lowered, everyone sees your new prediction at once.",
      points: "Kept, and your own 12 wins: +5. Lowered: nothing more.",
      limits: [
        "You cannot lower below the tricks you have already won.",
        "A lowered prediction may make the predictions add up to the tricks of the round.",
        "Only your own 12: if a Thief, a Servant or a Fisher won with it, there is no +5.",
        "After a Wizard in the trick there is no foretelling: no lowering and no +5.",
        "After the King's trump 13 you cannot lower, and there is no +5.",
      ],
      example: "You predicted 2, have won 1, and doubt you will win another: play the 12 and lower to 1.",
    },
    de: {
      card: "Deine 12, in der angespielten Farbe oder als Trumpf.",
      when: "Du wählst, wenn du die 12 spielst.",
      effect: "Senke deine Vorhersage um 1 oder behalte sie. Gesenkt sehen alle sofort deine neue Vorhersage.",
      points: "Behalten, und deine eigene 12 gewinnt: +5. Gesenkt: nichts weiter.",
      limits: [
        "Du kannst nicht unter die Stiche senken, die du schon gewonnen hast.",
        "Eine gesenkte Vorhersage darf die Vorhersagen auf die Stiche der Runde bringen.",
        "Nur deine eigene 12: Hat ein Dieb, ein Diener oder ein Fischer mit ihr gewonnen, gibt es kein +5.",
        "Nach einem Zauberer im Stich gibt es keine Weissagung: kein Senken und kein +5.",
        "Nach der Trumpf-13 des Königs kannst du nicht senken, und es gibt kein +5.",
      ],
      example: "Du hast 2 vorhergesagt, 1 gewonnen und zweifelst an einem weiteren: Spiel die 12 und senke auf 1.",
    },
  },
  king: {
    en: {
      card: "Your 13, as a trump or in the suit led.",
      when: "As a trump: at once. In the suit led: when the trick ends.",
      effect: "As a trump, the King's peace: no other power works in the trick, neither the roles nor the powers. What a role already did is undone: steals and services go back with their points, and armour forged goes again. In the suit led, the King's tax: if your 13 wins, every other card in the trick that used its power pays you.",
      points: "Peace: if your trump 13 wins, every other player pays you 5 tribute, never more than they have; the Priest pays none, and no armour blocks it. Tax: each such card pays 10, never more than its player has.",
      limits: [
        "With no trump suit there is no peace, only the tax.",
        "From your trump 13 on: no Air turn, no Fire shield or burn, no Earth +3, no element Wizard bonus and no Jester free play. An Air turn made before your 13 stands, but takes no points.",
        "If a Fire shield is already up and fire is not trumps, the trick has no trumps: your 13 brings no peace.",
        "With fire trumps, your fire 13 brings peace over the shield: you are not burned, and the Power of Fire pays no tribute.",
        "A Jester power's free play pays the tax too. The Priest pays no tax; a Smith's armour blocks it, and you pay the Smith 5.",
      ],
      example: "Water is trumps. A Thief stole Ana's card; then you play the water 13: the steal goes back, and when your 13 wins, everyone but the Priest pays you 5.",
    },
    de: {
      card: "Deine 13, als Trumpf oder in der angespielten Farbe.",
      when: "Als Trumpf: sofort. In der angespielten Farbe: am Ende des Stichs.",
      effect: "Als Trumpf der Frieden des Königs: Keine andere Kraft wirkt in diesem Stich, weder die der Rollen noch die Kräfte. Was eine Rolle schon getan hat, wird rückgängig gemacht: Diebstahl und Dienst gehen samt Punkten zurück, und geschmiedete Rüstung geht wieder. In der angespielten Farbe die Steuer des Königs: Gewinnt deine 13, zahlt dir jede andere Karte im Stich, die ihre Kraft genutzt hat.",
      points: "Frieden: Gewinnt deine Trumpf-13, zahlt dir jeder andere Spieler 5 Tribut, nie mehr, als er hat; der Priester zahlt keinen, und keine Rüstung blockt ihn. Steuer: Jede solche Karte zahlt 10, nie mehr, als ihr Spieler hat.",
      limits: [
        "Ohne Trumpffarbe gibt es keinen Frieden, nur die Steuer.",
        "Ab deiner Trumpf-13: kein Wechsel der Luft, kein Schild und kein Brand des Feuers, kein +3 der Erde, kein Bonus für den Zauberer eines Elements und kein freies Spiel des Narren. Ein Wechsel der Luft vor deiner 13 bleibt, nimmt aber keine Punkte.",
        "Steht schon ein Schild des Feuers und ist Feuer nicht Trumpf, hat der Stich keine Trümpfe: Deine 13 bringt keinen Frieden.",
        "Ist Feuer Trumpf, bringt deine Feuer-13 Frieden über den Schild: Du wirst nicht verbrannt, und die Kraft des Feuers zahlt keinen Tribut.",
        "Ein freies Spiel der Kraft des Narren zahlt auch Steuer. Der Priester zahlt keine Steuer; die Rüstung eines Schmieds blockt sie, und du zahlst dem Schmied 5.",
      ],
      example: "Wasser ist Trumpf. Ein Dieb hat Ana eine Karte gestohlen; dann spielst du die Wasser-13: Der Diebstahl geht zurück, und gewinnt deine 13, zahlen dir alle außer dem Priester 5.",
    },
  },
  blueWizard: {
    en: {
      card: "No card of your own.",
      when: "All through the round.",
      effect: "You see how many water cards every other player holds: their cards show blue to you, front and back, though never which card or its number. In a blind round, your own card shows blue too if it is water.",
      points: "Win a trick with the Water Wizard: +20.",
      limits: [
        "Wizards and Jesters are never water.",
        "The King's peace stops the bonus, not the sight.",
      ],
      example: "Two of Ben's cards show blue: he holds two water cards.",
    },
    de: {
      card: "Keine eigene Karte.",
      when: "Die ganze Runde lang.",
      effect: "Du siehst, wie viele Wasserkarten jeder andere Spieler hält: Seine Karten zeigen sich dir blau, vorne und hinten, aber nie welche Karte oder ihre Zahl. In einer Blindrunde zeigt sich auch deine eigene Karte blau, wenn sie Wasser ist.",
      points: "Gewinne einen Stich mit dem Wasser-Zauberer: +20.",
      limits: [
        "Zauberer und Narren sind nie Wasser.",
        "Der Frieden des Königs hält den Bonus auf, nicht die Sicht.",
      ],
      example: "Zwei von Bens Karten zeigen sich blau: Er hält zwei Wasserkarten.",
    },
  },
  greenWizard: {
    en: {
      card: "No card of your own.",
      when: "Whenever one of your earth cards meets another earth card.",
      effect: "Every earth card you hold counts 3 higher against other earth cards: a 7 is a 10, and a 12 beats a 13. A tie goes to you: your 7 beats a 10. Your earth cards show \"+3\" under their number.",
      points: "Win a trick with an earth number card: +5 from the house; with the Earth Wizard: +10.",
      limits: [
        "It works only when earth is the suit led or trumps. Trumps and Wizards still beat earth.",
        "The +3 belongs to whoever holds the card now: an earth card a Thief takes loses it, one you take gains it.",
        "With two Powers of Earth at the table, a tie goes to the card played first.",
        "It does not count at a Merchant's market.",
        "The King's peace stops the +3 and the bonus.",
      ],
      example: "Earth is led with a 12; your earth 10 counts as 13 and wins.",
    },
    de: {
      card: "Keine eigene Karte.",
      when: "Immer, wenn eine deiner Erdkarten auf eine andere Erdkarte trifft.",
      effect: "Jede Erdkarte, die du hältst, zählt gegen andere Erdkarten 3 höher: Eine 7 ist eine 10, und eine 12 schlägt eine 13. Ein Gleichstand geht an dich: Deine 7 schlägt eine 10. Deine Erdkarten zeigen \"+3\" unter ihrer Zahl.",
      points: "Gewinne einen Stich mit einer Erde-Zahlenkarte: +5 von der Bank; mit dem Erde-Zauberer: +10.",
      limits: [
        "Sie wirkt nur, wenn Erde angespielt oder Trumpf ist. Trümpfe und Zauberer schlagen Erde weiterhin.",
        "Das +3 gehört dem, der die Karte gerade hält: Eine Erdkarte, die ein Dieb nimmt, verliert es, eine, die du nimmst, bekommt es.",
        "Mit zwei Kräften der Erde am Tisch geht ein Gleichstand an die zuerst gespielte Karte.",
        "Auf dem Markt eines Händlers zählt es nicht.",
        "Der Frieden des Königs hält das +3 und den Bonus auf.",
      ],
      example: "Erde wird mit einer 12 angespielt; deine Erde-10 zählt als 13 und gewinnt.",
    },
  },
  yellowWizard: {
    en: {
      card: "No card of your own.",
      when: "When you have no card of the suit led.",
      effect: "Play an air card higher than the first card of the trick, and air becomes the suit led: the cards before yours no longer follow it, and the players after you must follow air.",
      points: "Turning the lead takes 5 points from the player who led, never more than they have, whoever wins. Win a trick with the Air Wizard: +10.",
      limits: [
        "Strictly higher: a tie does not turn the lead, so no air card turns a 13.",
        "The first card is the first that is not a Jester. After a Wizard lead there is no suit to turn.",
        "Not when air is trumps or was led, and only once a trick.",
        "Not once the Power of Fire has shielded a fire lead.",
        "The King's peace stops it: no turn after his trump 13, and a turn made before it takes no points.",
      ],
      example: "A fire 5 is led and you have no fire: your air 6 turns the lead to air and takes 5 from the leader. An air 5 would not.",
    },
    de: {
      card: "Keine eigene Karte.",
      when: "Wenn du keine Karte der angespielten Farbe hast.",
      effect: "Spiel eine Luftkarte, die höher ist als die erste Karte des Stichs, und Luft wird die angespielte Farbe: Die Karten vor deiner bedienen nicht mehr, und die Spieler nach dir müssen Luft bedienen.",
      points: "Der Wechsel nimmt dem Spieler, der angespielt hat, 5 Punkte ab, nie mehr, als er hat, egal wer gewinnt. Gewinne einen Stich mit dem Luft-Zauberer: +10.",
      limits: [
        "Echt höher: Ein Gleichstand wechselt nicht, also wechselt keine Luftkarte eine 13.",
        "Die erste Karte ist die erste, die kein Narr ist. Nach einem Zauberer als erster Karte gibt es keine Farbe zu wechseln.",
        "Nicht, wenn Luft Trumpf ist oder angespielt wurde, und nur einmal pro Stich.",
        "Nicht mehr, sobald die Kraft des Feuers eine Feuerfarbe abgeschirmt hat.",
        "Der Frieden des Königs hält sie auf: kein Wechsel nach seiner Trumpf-13, und ein Wechsel davor nimmt keine Punkte.",
      ],
      example: "Eine Feuer-5 wird angespielt, und du hast kein Feuer: Deine Luft-6 macht Luft zur angespielten Farbe und nimmt dem Ausspieler 5 ab. Eine Luft-5 könnte das nicht.",
    },
  },
  redWizard: {
    en: {
      card: "No card of your own.",
      when: "When fire is the suit led and you play a fire card, leading it or following.",
      effect: "Your shield: no trumps count in that trick, for anyone, including trumps played before your card. Your fire card cannot be trumped, though a higher fire card or a Wizard still beats it.",
      points: "A higher fire card that wins is burned: its player loses 5 points, to no one, never below 0. Win a trick with the Fire Wizard: +10.",
      limits: [
        "Once your shield is up, the Power of Air can no longer turn the lead; if it turned the lead before you played, there is no shield.",
        "The burn hits whoever wins with a fire card, even a Thief holding your stolen fire card. A Wizard that wins burns no one.",
        "Your shield up before the King's trump 13, with fire not trumps, leaves the King without peace. After his 13 there is no shield.",
        "With fire trumps, the King's fire 13 takes the shield down: he is not burned, and you pay him no tribute.",
      ],
      example: "A fire 4 is led, water is trumps, and you play the fire 9: Ana's water 2 cannot win. If Ben wins with the fire 11, he is burned 5.",
    },
    de: {
      card: "Keine eigene Karte.",
      when: "Wenn Feuer angespielt ist und du eine Feuerkarte spielst, ob du anspielst oder bedienst.",
      effect: "Dein Schild: In diesem Stich zählen keine Trümpfe, für niemanden, auch nicht die vor deiner Karte gespielten. Deine Feuerkarte kann nicht übertrumpft werden; eine höhere Feuerkarte oder ein Zauberer schlägt sie aber.",
      points: "Eine höhere Feuerkarte, die gewinnt, verbrennt: Ihr Spieler verliert 5 Punkte, an niemanden, nie unter 0. Gewinne einen Stich mit dem Feuer-Zauberer: +10.",
      limits: [
        "Steht dein Schild, kann die Kraft der Luft die Farbe nicht mehr wechseln; hat sie gewechselt, bevor du gespielt hast, gibt es keinen Schild.",
        "Der Brand trifft jeden, der mit einer Feuerkarte gewinnt, auch einen Dieb mit deiner gestohlenen Feuerkarte. Ein Zauberer, der gewinnt, verbrennt niemanden.",
        "Steht dein Schild vor der Trumpf-13 des Königs und ist Feuer nicht Trumpf, bleibt der König ohne Frieden. Nach seiner 13 gibt es keinen Schild.",
        "Ist Feuer Trumpf, nimmt die Feuer-13 des Königs den Schild weg: Er wird nicht verbrannt, und du zahlst ihm keinen Tribut.",
      ],
      example: "Eine Feuer-4 wird angespielt, Wasser ist Trumpf, und du spielst die Feuer-9: Anas Wasser-2 kann nicht gewinnen. Gewinnt Ben mit der Feuer-11, verbrennt er 5.",
    },
  },
  joker: {
    en: {
      card: "No card of your own, but Jester points.",
      when: "When you hold the suit led and have a Jester point to spend.",
      effect: "Spend a point to play any card instead: a trump, or another suit to throw it away.",
      points: "Every 3 tricks you win, in a row or not and across rounds, give you a point, up to 3. Playing a Jester counts as a trick won, whoever wins.",
      limits: [
        "Who wins is decided as ever: a card of another suit that is not a trump cannot win.",
        "The trick you spend a point in does not count towards the next point, and tricks won while you hold 3 do not count.",
        "A trick a Duke grants you counts as yours.",
        "No free play after the King's trump 13; one made before it stands.",
        "A free play in a trick the King wins with his 13 in the suit led pays him the 10 tax.",
      ],
      example: "Earth is led, you hold earth but want to lose the trick: spend a point and throw away a fire 2.",
    },
    de: {
      card: "Keine eigene Karte, aber Narrenpunkte.",
      when: "Wenn du die angespielte Farbe hast und einen Narrenpunkt ausgeben kannst.",
      effect: "Gib einen Punkt aus und spiel stattdessen eine beliebige Karte: einen Trumpf oder eine andere Farbe, um sie abzuwerfen.",
      points: "Je 3 gewonnene Stiche, ob hintereinander oder nicht und über Runden hinweg, geben einen Punkt, bis zu 3. Einen Narren zu spielen zählt wie ein gewonnener Stich, egal wer gewinnt.",
      limits: [
        "Wer gewinnt, wird wie immer entschieden: Eine Karte einer anderen Farbe, die kein Trumpf ist, kann nicht gewinnen.",
        "Der Stich, in dem du einen Punkt ausgibst, zählt nicht für den nächsten Punkt, und Stiche, die du mit 3 Punkten gewinnst, zählen nicht.",
        "Ein Stich, den dir ein Herzog schenkt, zählt als deiner.",
        "Kein freies Spiel nach der Trumpf-13 des Königs; eines davor bleibt.",
        "Ein freies Spiel in einem Stich, den der König mit seiner 13 in der angespielten Farbe gewinnt, zahlt ihm die Steuer von 10.",
      ],
      example: "Erde wird angespielt, du hast Erde, willst den Stich aber verlieren: Gib einen Punkt aus und wirf eine Feuer-2 ab.",
    },
  },
  watcher: {
    en: {
      card: "No card of your own; free to everyone with the powers open.",
      when: "Before each round is dealt, and all through it.",
      effect: "2 of the 4 Wizards and 2 of the 4 Jesters are watched, picked at random. You see how many of them every other player holds: that many of their cards show purple to you, though never which card, nor whether Wizard or Jester.",
      points: "None: it is knowledge.",
      limits: [
        "Watched cards left in the deck or turned up as trumps show nowhere, so some rounds you see all four, some fewer, some none.",
        "In a blind round, your own card shows purple too if it is watched.",
        "The King's peace does not stop it.",
      ],
      example: "One of Cid's cards shows purple: he holds one of the watched Wizards or Jesters.",
    },
    de: {
      card: "Keine eigene Karte; frei für alle, denen die Kräfte offenstehen.",
      when: "Bevor jede Runde ausgeteilt wird, und die ganze Runde lang.",
      effect: "2 der 4 Zauberer und 2 der 4 Narren werden beobachtet, zufällig gewählt. Du siehst, wie viele davon jeder andere Spieler hält: So viele seiner Karten zeigen sich dir lila, aber nie welche Karte, noch ob Zauberer oder Narr.",
      points: "Keine: Es ist Wissen.",
      limits: [
        "Beobachtete Karten, die im Stapel bleiben oder als Trumpf aufgedeckt werden, zeigen sich nirgends, also siehst du manche Runden alle vier, manche weniger, manche keine.",
        "In einer Blindrunde zeigt sich auch deine eigene Karte lila, wenn sie beobachtet wird.",
        "Der Frieden des Königs hält sie nicht auf.",
      ],
      example: "Eine von Cids Karten zeigt sich lila: Er hält einen der beobachteten Zauberer oder Narren.",
    },
  },
};
