import { getLanguage } from "./index";

// The long Home panels (About, Rules, Legal) as whole pieces of markup, one
// per language side by side, so a translation can be read against its source.
// Their titles are in en.ts and de.ts like every other short text.

const MAIL_LINK = `<a
  class="home-modal-link"
  href="mailto:wizard.platform@gmail.com"
>wizard.platform@gmail.com</a>`;

const about = {
  en: `
    <p class="home-modal-copy">
      We are two software development students, game lovers, and longtime
      fans of Wizard. We created this platform because we wanted a better
      way to play the game online with friends.
    </p>

    <p class="home-modal-copy">
      Wizard is a brilliant game of prediction, risk, and surprises, but
      the online experience we found did not live up to the tabletop one.
      So we decided to build the game we wanted to play: a welcoming
      place to gather, compete, and enjoy Wizard together.
    </p>
  `,
  de: `
    <p class="home-modal-copy">
      Wir sind zwei Studenten der Softwareentwicklung, begeisterte Spieler
      und seit Langem Fans von Wizard. Wir haben diese Plattform gebaut,
      weil wir uns eine bessere Möglichkeit gewünscht haben, online mit
      Freunden zu spielen.
    </p>

    <p class="home-modal-copy">
      Wizard ist ein großartiges Spiel aus Ansagen, Risiko und
      Überraschungen, doch online kam nichts, was wir fanden, an das
      Spiel am Tisch heran. Also haben wir das Spiel gebaut, das wir
      selbst spielen wollten: einen einladenden Ort, um sich zu treffen,
      sich zu messen und Wizard gemeinsam zu genießen.
    </p>
  `,
};

const rules = {
  en: `
    <div class="home-rules-content">

      <section class="home-rules-section">
        <h3>Materials</h3>
        <p>
          Foretold is played with a 60-card deck containing four elemental
          suits (Fire, Earth, Water, and Air), numbered cards, Wizards, and
          Fools.
          Wizards are the highest-ranking special cards, while Fools
          are the lowest. The game also uses a score pad.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Object of the Game</h3>
        <p>
          Predict how many tricks you will win in each round.
          Earn points by predicting correctly and avoid penalties
          by estimating your tricks accurately. The player with
          the highest total score at the end of the game wins.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Rounds and Dealing</h3>
        <p>
          Each round determines how many cards each player receives.
          In Round 1, each player receives one card. In Round 2,
          each receives two cards, and so on.
        </p>
        <p>
          The maximum number of rounds depends on the number of players:
        </p>
        <ul>
          <li>3 players: 20 rounds</li>
          <li>4 players: 15 rounds</li>
          <li>5 players: 12 rounds</li>
          <li>6 players: 10 rounds</li>
        </ul>
        <p>
          The dealer rotates after each round. After the cards are
          dealt, the next card is revealed to determine the trump suit,
          except in the final round, when there is no trump suit.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Predictions</h3>
        <p>
          Before playing, each player predicts how many tricks they
          expect to win during the round. Your prediction can range
          from zero to the number of cards in your hand.
        </p>
        <p>
          <strong>Special rule:</strong> The last player to predict
          cannot choose the number that would make everyone's
          predictions add up to the number of tricks in the round. For
          example, with three cards each, if the other players have
          predicted one trick between them, the last player cannot
          predict two.
        </p>
        <p>
          So the predictions never match the tricks available, and at
          least one player must miss.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Tricks and Player Rotation</h3>
        <p>
          A trick consists of every player playing one card. The
          winner takes the trick, and the number of tricks you win
          during a round is your trick count.
        </p>
        <p>
          The starting player rotates each round. The designated
          starting player leads the first trick, and the winner
          of each trick leads the next one.
        </p>
        <p>
          For example, in Round 3, each player receives three cards,
          so three tricks are played.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Playing Cards and Winning Tricks</h3>
        <p>
          The first card played determines the lead suit. Players
          must follow that suit whenever possible. If you have no
          cards of the lead suit, you may play any card, including
          a trump card, Wizard, or Fool.
        </p>
        <ol>
          <li>The highest-numbered card of the lead suit normally wins.</li>
          <li>A trump card beats cards of the lead suit.</li>
          <li>If multiple trump cards are played, the highest-numbered
            trump card wins, unless a Wizard determines the winner.</li>
          <li>Wizards and Fools follow their special rules.</li>
        </ol>
      </section>

      <section class="home-rules-section">
        <h3>Trump Suit</h3>
        <p>
          In every round except the final round, a card is revealed
          after dealing to determine the trump suit. Trump is stronger
          than the other suits.
        </p>
        <p>
          You may play a trump card when the lead suit is trump or
          when you cannot follow the lead suit. If several trump
          cards are played, the highest-numbered trump card wins,
          unless a Wizard determines the winner.
        </p>
        <p>
          <strong>If the revealed card is a Wizard:</strong>
          The player leading the first trick chooses the trump suit.
          A coloured rim around the Wizard displays the chosen suit
          throughout the round.
        </p>
        <p>
          <strong>If the revealed card is a Fool:</strong>
          There is no trump suit for that round. The rim remains white.
        </p>
        <p>
          <strong>Final round:</strong> No trump card is revealed,
          and there is no trump suit.
        </p>
        <p>
          <strong>Blind first round (rule variation):</strong> In the
          first round each player holds their one card facing outwards,
          so you can see everyone's card except your own. Predict, then
          play your card without ever seeing it.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Wizards and Fools</h3>

        <p>
          <strong>Wizards:</strong> Wizards can be played at any time,
          regardless of the lead suit. Normally, the first Wizard
          played wins the trick, even if other Wizards are played later.
        </p>
        <p>
          <strong>Rule variation:</strong> The host can choose
          <em>Last Wizard wins</em> in the game's Rule Variations, so
          the last Wizard played takes the trick instead of the first.
        </p>
        <p>
          <strong>Strategy tip:</strong> When the first Wizard wins,
          playing a Wizard after another player has already played one
          gets rid of your Wizard without winning the trick.
        </p>
        <p>
          <strong>Fools:</strong> Fools are the lowest-ranking
          cards and normally lose tricks. They can be played at any
          time and are useful when you want to avoid winning a trick.
          If only Fools are played, the first Fool wins.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Ranks and Powers</h3>
        <p>
          Each element has thirteen ranks, from lowest to highest:
          Peasant, Farmer, Citizen, Soldier, Merchant, Priest,
          General, Thief, Trickster, Seer, Heir, Consort and Monarch.
          Each card shows its title across the middle.
        </p>
        <p>
          The <strong>Seer</strong> (an eye) and the <strong>Trickster</strong>
          (a mask) follow suit and rank like any other card, but win the
          trick with one and you may change a prediction by one, up or down:
        </p>
        <ul>
          <li><strong>Seer:</strong> your own prediction.</li>
          <li><strong>Trickster:</strong> an opponent's prediction.</li>
        </ul>
        <p>
          A prediction stays between 0 and the round's number, and keeping
          it as it is uses no power. It works in any round, even the last
          trick. If a Wizard or a higher card wins the trick, there is no
          power.
        </p>
        <p>
          The <strong>Thief</strong> also follows suit and rank, but win the
          trick with it and you may swap one of your cards for one of another
          player's, which you take without seeing it. It does nothing in a
          round's last trick, when there is nothing left to swap.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Scoring</h3>
        <p>
          Your score depends on how accurately you predict your tricks.
        </p>
        <ul>
          <li>Predict correctly: +2 points, plus 1 point for
            each trick you won.</li>
          <li>Miss your prediction: −1 point for each trick
            of difference.</li>
        </ul>

        <div class="home-scoring-example">
          <strong>Examples</strong>
          <p>
            Predict 0 and win 0: +2 points.<br>
            Predict 2 and win 2: +4 points.<br>
            Predict 3 and win 3: +5 points.<br>
            Predict 2 and win 1: −1 point.<br>
            Predict 2 and win 0: −2 points.
          </p>
        </div>
      </section>

      <section class="home-rules-section">
        <h3>Winning the Game</h3>
        <p>
          After all rounds are completed, the player with the
          highest total score wins.
        </p>
      </section>

    </div>
  `,
  // Terms as in the AMIGO edition: Zauberer, Narr, Trumpf, Stich, Ansage,
  // bedienen, Farbe.
  de: `
    <div class="home-rules-content">

      <section class="home-rules-section">
        <h3>Spielmaterial</h3>
        <p>
          Foretold wird mit 60 Karten gespielt: vier Elemente (Feuer, Erde,
          Wasser, Luft) mit Zahlenkarten, dazu Zauberer und Narren. Die Zauberer sind die höchsten
          Sonderkarten, die Narren die niedrigsten. Außerdem braucht
          man einen Block für die Punkte.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Ziel des Spiels</h3>
        <p>
          Sag in jeder Runde voraus, wie viele Stiche du machst.
          Eine genaue Ansage bringt Punkte, eine falsche kostet welche.
          Wer am Ende der Partie die meisten Punkte hat, gewinnt.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Runden und Geben</h3>
        <p>
          Die Runde bestimmt, wie viele Karten alle bekommen: In Runde 1
          bekommt jede Person eine Karte, in Runde 2 zwei Karten und so
          weiter.
        </p>
        <p>
          Wie viele Runden es höchstens gibt, hängt davon ab, wie viele
          mitspielen:
        </p>
        <ul>
          <li>3 am Tisch: 20 Runden</li>
          <li>4 am Tisch: 15 Runden</li>
          <li>5 am Tisch: 12 Runden</li>
          <li>6 am Tisch: 10 Runden</li>
        </ul>
        <p>
          Nach jeder Runde gibt die nächste Person. Nach dem Geben wird
          die nächste Karte aufgedeckt: Sie bestimmt die Trumpffarbe.
          Nur in der letzten Runde gibt es keinen Trumpf.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Ansagen</h3>
        <p>
          Vor dem Ausspielen sagen alle an, wie viele Stiche sie in
          dieser Runde machen wollen. Deine Ansage liegt zwischen null
          und der Zahl deiner Handkarten.
        </p>
        <p>
          <strong>Sonderregel:</strong> Wer als Letztes ansagt, darf
          keine Zahl wählen, mit der die Summe aller Ansagen genau der
          Zahl der Stiche in dieser Runde entspricht. Beispiel: Mit drei
          Karten pro Person haben die anderen zusammen einen Stich
          angesagt. Dann darf die letzte Person nicht zwei ansagen.
        </p>
        <p>
          So gehen die Ansagen nie genau auf, und mindestens eine Person
          liegt daneben.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Stiche und Reihenfolge</h3>
        <p>
          Ein Stich besteht aus je einer Karte von allen am Tisch. Wer
          den Stich gewinnt, nimmt ihn. Wie viele Stiche du in einer
          Runde nimmst, ist deine Stichzahl.
        </p>
        <p>
          Wer beginnt, wechselt von Runde zu Runde. Diese Person spielt
          zum ersten Stich aus, danach spielt immer aus, wer den letzten
          Stich gewonnen hat.
        </p>
        <p>
          Zum Beispiel bekommen in Runde 3 alle drei Karten, also werden
          drei Stiche gespielt.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Karten spielen und Stiche gewinnen</h3>
        <p>
          Die erste ausgespielte Karte bestimmt die Farbe des Stichs.
          Diese Farbe musst du bedienen, wenn du kannst. Hast du keine
          Karte dieser Farbe, darfst du jede Karte spielen, auch einen
          Trumpf, einen Zauberer oder einen Narren.
        </p>
        <ol>
          <li>Normalerweise gewinnt die höchste Karte der ausgespielten Farbe.</li>
          <li>Ein Trumpf schlägt die Karten der ausgespielten Farbe.</li>
          <li>Liegen mehrere Trümpfe im Stich, gewinnt der höchste,
            außer ein Zauberer entscheidet den Stich.</li>
          <li>Für Zauberer und Narren gelten eigene Regeln.</li>
        </ol>
      </section>

      <section class="home-rules-section">
        <h3>Trumpf</h3>
        <p>
          In jeder Runde außer der letzten wird nach dem Geben eine Karte
          aufgedeckt, die die Trumpffarbe bestimmt. Trumpf ist stärker als
          die anderen Farben.
        </p>
        <p>
          Einen Trumpf darfst du spielen, wenn Trumpf ausgespielt wurde
          oder wenn du die ausgespielte Farbe nicht bedienen kannst.
          Liegen mehrere Trümpfe im Stich, gewinnt der höchste, außer
          ein Zauberer entscheidet den Stich.
        </p>
        <p>
          <strong>Wird ein Zauberer aufgedeckt:</strong>
          Wer zum ersten Stich ausspielt, wählt die Trumpffarbe. Ein
          farbiger Rand um den Zauberer zeigt die Farbe die ganze Runde
          über an.
        </p>
        <p>
          <strong>Wird ein Narr aufgedeckt:</strong>
          In dieser Runde gibt es keinen Trumpf. Der Rand bleibt weiß.
        </p>
        <p>
          <strong>Letzte Runde:</strong> Es wird keine Karte aufgedeckt,
          und es gibt keinen Trumpf.
        </p>
        <p>
          <strong>Blinde erste Runde (Regelvariante):</strong> In der
          ersten Runde halten alle ihre eine Karte nach außen. Du siehst
          also die Karten der anderen, aber nicht deine eigene. Du sagst
          an und spielst deine Karte aus, ohne sie je gesehen zu haben.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Zauberer und Narren</h3>

        <p>
          <strong>Zauberer:</strong> Einen Zauberer darfst du immer
          spielen, egal welche Farbe ausgespielt wurde. Normalerweise
          gewinnt der erste Zauberer im Stich, auch wenn danach noch
          weitere gespielt werden.
        </p>
        <p>
          <strong>Regelvariante:</strong> Wer den Raum eröffnet, kann
          in den Regelvarianten <em>Der letzte Zauberer gewinnt</em>
          wählen. Dann nimmt der zuletzt gespielte Zauberer den Stich,
          nicht der erste.
        </p>
        <p>
          <strong>Tipp:</strong> Gewinnt der erste Zauberer, kannst du
          deinen eigenen Zauberer loswerden, ohne den Stich zu nehmen:
          Spiel ihn, nachdem schon jemand anderes einen gespielt hat.
        </p>
        <p>
          <strong>Narren:</strong> Narren sind die niedrigsten Karten
          und verlieren normalerweise den Stich. Du darfst sie immer
          spielen, praktisch, wenn du einen Stich nicht gewinnen willst.
          Liegen nur Narren im Stich, gewinnt der erste.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Ränge und Kräfte</h3>
        <p>
          Jedes Element hat dreizehn Ränge, vom niedrigsten zum höchsten:
          Bauer, Landwirt, Bürger, Soldat, Händler, Priester, General,
          Dieb, Trickser, Seher, Erbe, Konsort und Monarch. Jede Karte
          trägt ihren Titel in der Mitte.
        </p>
        <p>
          Der <strong>Seher</strong> (ein Auge) und der <strong>Trickser</strong>
          (eine Maske) bedienen Farbe und zählen wie jede andere Karte. Wer
          aber einen Stich mit einer von ihnen gewinnt, darf eine Ansage um
          eins erhöhen oder senken:
        </p>
        <ul>
          <li><strong>Seher:</strong> die eigene Ansage.</li>
          <li><strong>Trickser:</strong> die Ansage eines Mitspielers.</li>
        </ul>
        <p>
          Eine Ansage bleibt zwischen 0 und der Rundennummer; bleibt sie
          gleich, wird keine Kraft eingesetzt. Die Kraft gilt in jeder
          Runde, auch im letzten Stich. Gewinnt ein Zauberer oder eine
          höhere Karte den Stich, gibt es keine Kraft.
        </p>
        <p>
          Der <strong>Dieb</strong> bedient ebenfalls Farbe und zählt wie jede
          andere Karte. Wer aber einen Stich mit ihm gewinnt, darf eine seiner
          Karten gegen eine Karte eines Mitspielers tauschen, die er ungesehen
          zieht. Im letzten Stich einer Runde bleibt er ohne Wirkung, da nichts
          mehr zu tauschen ist.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Punkte</h3>
        <p>
          Deine Punkte hängen davon ab, wie genau deine Ansage war.
        </p>
        <ul>
          <li>Ansage getroffen: 2 Punkte, dazu 1 Punkt für jeden
            gewonnenen Stich.</li>
          <li>Ansage verfehlt: −1 Punkt für jeden Stich Unterschied.</li>
        </ul>

        <div class="home-scoring-example">
          <strong>Beispiele</strong>
          <p>
            0 angesagt, 0 gewonnen: +2 Punkte.<br>
            2 angesagt, 2 gewonnen: +4 Punkte.<br>
            3 angesagt, 3 gewonnen: +5 Punkte.<br>
            2 angesagt, 1 gewonnen: −1 Punkt.<br>
            2 angesagt, 0 gewonnen: −2 Punkte.
          </p>
        </div>
      </section>

      <section class="home-rules-section">
        <h3>Wer gewinnt</h3>
        <p>
          Nach der letzten Runde gewinnt, wer die meisten Punkte hat.
        </p>
      </section>

    </div>
  `,
};

const legal = {
  en: `
    <p class="home-modal-copy">
      Wizard Platform is a public, non-commercial educational project
      created by Carlos Denegri and Rufus Lane.
    </p>

    <p class="home-modal-copy">
      Wizard is an existing tabletop card game created by Ken Fisher,
      with art by Franz Vohwinkel and published by AMIGO. Wizard existed
      before this website and builds on familiar playing-card traditions.
      Wizard Platform is an independent student-made digital project and
      is not affiliated with or endorsed by AMIGO or the original game
      creators.
    </p>

    <p class="home-modal-copy">
      The card images and related game artwork are from or based on the
      original Wizard game. We do not claim ownership of those images,
      names, or related game materials.
    </p>

    <p class="home-modal-copy">
      The soundtrack includes original music from Chessmaster II,
      including music associated with the PlayStation release and Joseph
      Kolkovich. Copyright and publishing rights belong to the relevant
      original developers and publishers, including Mindscape and
      Starsphere Interactive. We do not claim ownership of that music or
      its recording.
    </p>

    <p class="home-modal-copy">
      Your data: when you sign up we store your username, last name, date
      of birth, email address and a hashed form of your password that
      nobody, including us, can turn back into the password. Other players only ever see your username. Your
      last name and date of birth are kept solely as an account record, so
      that if there is ever a question about who an account belongs to, we
      can confirm it is yours. Only the site administrators can see them.
      We do not share your data or use it for advertising. It is kept until
      your account is deleted; to have it deleted, email ${MAIL_LINK}.
    </p>

    <p class="home-modal-copy">
      This project is made for educational and demonstration purposes.
      Rights holders who have questions about the materials used here
      should email ${MAIL_LINK} so the relevant content can be reviewed
      or removed.
    </p>
  `,
  de: `
    <p class="home-modal-copy">
      Wizard Platform ist ein öffentliches, nicht kommerzielles
      Lernprojekt von Carlos Denegri und Rufus Lane.
    </p>

    <p class="home-modal-copy">
      Wizard ist ein bestehendes Kartenspiel von Ken Fisher, illustriert
      von Franz Vohwinkel und verlegt bei AMIGO. Wizard gab es schon vor
      dieser Website, und es baut auf bekannten Kartenspieltraditionen
      auf. Wizard Platform ist ein unabhängiges digitales Projekt von
      Studierenden und steht in keiner Verbindung zu AMIGO oder den
      Urhebern des Spiels und wird von ihnen nicht unterstützt.
    </p>

    <p class="home-modal-copy">
      Die Kartenbilder und die zugehörigen Spielgrafiken stammen aus dem
      Original-Wizard oder beruhen darauf. Wir beanspruchen keine Rechte
      an diesen Bildern, Namen oder anderen Spielmaterialien.
    </p>

    <p class="home-modal-copy">
      Die Musik enthält Originalmusik aus Chessmaster II, darunter Musik
      aus der PlayStation-Fassung und von Joseph Kolkovich. Urheber- und
      Verlagsrechte liegen bei den jeweiligen Entwicklern und Verlagen,
      darunter Mindscape und Starsphere Interactive. Wir beanspruchen
      keine Rechte an dieser Musik oder ihren Aufnahmen.
    </p>

    <p class="home-modal-copy">
      Deine Daten: Bei der Anmeldung speichern wir deinen Benutzernamen,
      Nachnamen, dein Geburtsdatum, deine E-Mail-Adresse und dein Passwort
      nur als Hash, aus dem niemand, auch wir nicht, das Passwort
      zurückgewinnen kann. Andere Spieler sehen
      nur deinen Benutzernamen. Nachname und Geburtsdatum dienen
      ausschließlich als Kontonachweis: Falls jemals unklar ist, wem ein
      Konto gehört, können wir damit bestätigen, dass es deins ist. Nur die
      Administratoren der Seite können sie sehen. Wir geben deine Daten
      nicht weiter und nutzen sie nicht für Werbung. Sie bleiben
      gespeichert, bis dein Konto gelöscht wird; dafür schreib einfach an
      ${MAIL_LINK}.
    </p>

    <p class="home-modal-copy">
      Dieses Projekt dient Lern- und Vorführzwecken. Rechteinhaber mit
      Fragen zu den hier verwendeten Materialien schreiben bitte an
      ${MAIL_LINK}, damit die betreffenden Inhalte geprüft oder entfernt
      werden können.
    </p>
  `,
};

export const aboutHtml = (): string => about[getLanguage()];
export const rulesHtml = (): string => rules[getLanguage()];
export const legalHtml = (): string => legal[getLanguage()];
