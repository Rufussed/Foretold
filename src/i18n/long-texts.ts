import { getLanguage } from "./index";

export type HelpPage = "lobby" | "profile" | "room" | "admin";

// The long Home panels (Story, Rules, Legal) and the navbar's help pages as
// whole pieces of markup, one per language side by side, so a translation can
// be read against its source. Their titles are in en.ts and de.ts like every
// other short text.

const MAIL_LINK = `<a
  class="home-modal-link"
  href="mailto:wizard.platform@gmail.com"
>wizard.platform@gmail.com</a>`;

const about = {
  en: `
    <div class="home-story">
      <p class="home-modal-copy">
        Long, long ago, there was a great civilization. Its people
        had learned to work together toward a single goal, and
        together they could accomplish anything. Then they decided
        to build a tower that would reach the skies: the fabled
        Tower of Babel.
      </p>

      <p class="home-modal-copy">
        The wise men of this forgotten civilization gathered to
        find a way to pass their knowledge on to the generations
        to come. They knew that statues, monuments and great
        architectural wonders could be destroyed by time, war and
        enemies, and the knowledge would be lost. Even writing
        could be burned, changed or ruined. The wise men could not
        find a way, until they came up with a GAME.
      </p>

      <p class="home-modal-copy">
        But the tower fell. Their one language was broken into
        many, and the people were scattered across the earth.
        Their cities were lost and their words forgotten, but the
        game survived, because the people carried it with them.
        Words could no longer be understood, but pictures could.
      </p>

      <p class="home-modal-copy">
        That game and its rules are forgotten too, all except its
        cards. As they passed from people to people, the cards
        changed, but the essence of their images, and of what they
        represent, has somehow survived. Their hidden message was
        never read, yet the game endured.
      </p>

      <p class="home-modal-copy">
        The hidden knowledge was studied deeply by the Magi of the
        city of Babylon. When some of these Magi began to acquire
        great magical power, they fled Babylon and crossed the sea
        to settle in a faraway land to the north.
      </p>

      <p class="home-modal-copy">
        These Magi are said to be the founders of magic and the
        first Wizards this world has ever seen.
      </p>

      <p class="home-modal-copy">
        They scattered to the four corners of that land, carrying
        with them the cards of that ancient world.
      </p>

      <p class="home-modal-copy">
        The Magi discovered that the cards held a power: they
        could foretell the future. With them, they could see who
        would become a good apprentice. In time, people would call
        these cards the Arcana, which means "the secrets".
      </p>

      <p class="home-modal-copy">
        The Magi created a game of prediction in which young
        apprentices showed their ability to foresee the outcome.
        It was also a test of intelligence, but in secret the Magi
        knew that it was the cards that truly decided who the
        chosen apprentice would be.
      </p>

      <p class="home-modal-copy">
        The cards are here. And you too can foretell the future.
      </p>
    </div>
  `,
  de: `
    <div class="home-story">
      <p class="home-modal-copy">
        Vor langer, langer Zeit gab es eine große Zivilisation.
        Ihre Menschen hatten gelernt, gemeinsam auf ein einziges
        Ziel hinzuarbeiten, und zusammen konnten sie alles
        erreichen. Dann beschlossen sie, einen Turm zu bauen, der
        bis in den Himmel reichen sollte: den sagenumwobenen Turm
        zu Babel.
      </p>

      <p class="home-modal-copy">
        Die Weisen dieser vergessenen Zivilisation kamen zusammen,
        um einen Weg zu finden, ihr Wissen an die kommenden
        Generationen weiterzugeben. Sie wussten, dass Statuen,
        Denkmäler und große Bauwerke von der Zeit, von Kriegen und
        von Feinden zerstört werden können, und mit ihnen das
        Wissen. Selbst Schriften konnten verbrannt, verfälscht
        oder vernichtet werden. Die Weisen fanden keinen Weg, bis
        sie auf die Idee kamen: ein SPIEL.
      </p>

      <p class="home-modal-copy">
        Doch der Turm fiel. Ihre eine Sprache zerbrach in viele,
        und die Menschen wurden über die ganze Erde zerstreut.
        Ihre Städte gingen verloren und ihre Worte wurden
        vergessen, doch das Spiel überlebte, denn die Menschen
        trugen es mit sich. Worte verstand man nicht mehr, Bilder
        aber schon.
      </p>

      <p class="home-modal-copy">
        Auch dieses Spiel und seine Regeln sind vergessen, bis auf
        seine Karten. Während sie von Volk zu Volk weitergegeben
        wurden, veränderten sich die Karten, doch das Wesen ihrer
        Bilder und dessen, wofür sie stehen, hat auf rätselhafte
        Weise überdauert. Ihre verborgene Botschaft wurde nie
        gelesen, und doch blieb das Spiel bestehen.
      </p>

      <p class="home-modal-copy">
        Das verborgene Wissen wurde von den Magiern der Stadt
        Babylon eingehend studiert. Als einige dieser Magier große
        magische Kräfte erlangten, flohen sie aus Babylon,
        überquerten das Meer und ließen sich in einem fernen Land
        im Norden nieder.
      </p>

      <p class="home-modal-copy">
        Diese Magier gelten als die Begründer der Magie und als
        die ersten Zauberer, die diese Welt je gesehen hat.
      </p>

      <p class="home-modal-copy">
        Sie zerstreuten sich in alle vier Himmelsrichtungen jenes
        Landes und trugen die Karten jener alten Welt bei sich.
      </p>

      <p class="home-modal-copy">
        Die Magier entdeckten, dass die Karten eine Kraft besaßen:
        Mit ihnen ließ sich die Zukunft vorhersagen. So erkannten
        sie, wer ein guter Lehrling werden würde. Mit der Zeit
        nannte man diese Karten die Arkana, das heißt „die
        Geheimnisse“.
      </p>

      <p class="home-modal-copy">
        Die Magier erfanden ein Spiel der Vorhersage, in dem junge
        Lehrlinge zeigten, wie gut sie den Ausgang vorhersehen
        konnten. Es war auch eine Prüfung der Klugheit, doch
        insgeheim wussten die Magier, dass in Wahrheit die Karten
        bestimmten, wer der auserwählte Lehrling sein würde.
      </p>

      <p class="home-modal-copy">
        Die Karten sind hier. Und auch du kannst die Zukunft
        vorhersagen.
      </p>
    </div>
  `,
};

const rules = {
  en: `
    <div class="home-rules-content">

      <section class="home-rules-section">
        <h3>Materials</h3>
        <p>
          Wizard is played with a 60-card deck containing four coloured
          suits, numbered cards, Wizards, and Jesters.
          Wizards are the highest-ranking special cards, while Jesters
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
          a trump card, Wizard, or Jester.
        </p>
        <ol>
          <li>The highest-numbered card of the lead suit normally wins.</li>
          <li>A trump card beats cards of the lead suit.</li>
          <li>If multiple trump cards are played, the highest-numbered
            trump card wins, unless a Wizard determines the winner.</li>
          <li>Wizards and Jesters follow their special rules.</li>
        </ol>
      </section>

      <section class="home-rules-section">
        <h3>Trump Suit</h3>
        <p>
          In every round except the final round, a card is revealed
          after dealing to determine the trump suit. Trump is stronger
          than the other coloured suits.
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
          <strong>If the revealed card is a Jester:</strong>
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
        <h3>Wizards and Jesters</h3>

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
          <strong>Jesters:</strong> Jesters are the lowest-ranking
          cards and normally lose tricks. They can be played at any
          time and are useful when you want to avoid winning a trick.
          If only Jesters are played, the first Jester wins.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Scoring</h3>
        <p>
          Your score depends on how accurately you predict your tricks.
        </p>
        <ul>
          <li>Predict correctly: +20 points, plus 10 points for
            each trick you won.</li>
          <li>Miss your prediction: −10 points for each trick
            of difference.</li>
        </ul>

        <div class="home-scoring-example">
          <strong>Examples</strong>
          <p>
            Predict 0 and win 0: +20 points.<br>
            Predict 2 and win 2: +40 points.<br>
            Predict 3 and win 3: +50 points.<br>
            Predict 2 and win 1: −10 points.<br>
            Predict 2 and win 0: −20 points.
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
          Wizard wird mit 60 Karten gespielt: vier Farben mit Zahlenkarten,
          dazu Zauberer und Narren. Die Zauberer sind die höchsten
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
        <h3>Punkte</h3>
        <p>
          Deine Punkte hängen davon ab, wie genau deine Ansage war.
        </p>
        <ul>
          <li>Ansage getroffen: 20 Punkte, dazu 10 Punkte für jeden
            gewonnenen Stich.</li>
          <li>Ansage verfehlt: −10 Punkte für jeden Stich Unterschied.</li>
        </ul>

        <div class="home-scoring-example">
          <strong>Beispiele</strong>
          <p>
            0 angesagt, 0 gewonnen: +20 Punkte.<br>
            2 angesagt, 2 gewonnen: +40 Punkte.<br>
            3 angesagt, 3 gewonnen: +50 Punkte.<br>
            2 angesagt, 1 gewonnen: −10 Punkte.<br>
            2 angesagt, 0 gewonnen: −20 Punkte.
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
      Wizard Foretold is a public, non-commercial educational project
      created by Carlos Denegri and Rufus Lane.
    </p>

    <p class="home-modal-copy">
      Wizard Foretold was inspired by Wizard, the card game by Ken
      Fisher. It is an independent project and is not affiliated with or
      endorsed by AMIGO or the creators of Wizard.
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
      Your data: when you sign up we store your username, your email
      address and a hashed form of your password that nobody, including
      us, can turn back into the password. Other players only ever see your
      username. Only the site administrators can see your email address.
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
      Wizard Foretold ist ein öffentliches, nicht kommerzielles
      Lernprojekt von Carlos Denegri und Rufus Lane.
    </p>

    <p class="home-modal-copy">
      Wizard Foretold ist vom Kartenspiel Wizard von Ken Fisher
      inspiriert. Es ist ein unabhängiges Projekt und steht in keiner
      Verbindung zu AMIGO oder den Urhebern von Wizard, die es auch nicht
      unterstützen.
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
      deine E-Mail-Adresse und dein Passwort nur als Hash, aus dem niemand,
      auch wir nicht, das Passwort zurückgewinnen kann. Andere Spieler
      sehen nur deinen Benutzernamen. Deine E-Mail-Adresse sehen nur die
      Administratoren der Seite. Wir geben deine Daten nicht weiter und
      nutzen sie nicht für Werbung. Sie bleiben gespeichert, bis dein Konto
      gelöscht wird; dafür schreib einfach an ${MAIL_LINK}.
    </p>

    <p class="home-modal-copy">
      Dieses Projekt dient Lern- und Vorführzwecken. Rechteinhaber mit
      Fragen zu den hier verwendeten Materialien schreiben bitte an
      ${MAIL_LINK}, damit die betreffenden Inhalte geprüft oder entfernt
      werden können.
    </p>
  `,
};

// The navbar's "?" window, per page. A page not written yet shows the
// placeholder (help.placeholder) instead.
const help: Partial<Record<HelpPage, { en: string; de: string }>> = {
  lobby: {
    en: `
    <div class="home-rules-content">

      <section class="home-rules-section">
        <h3>What is a glade?</h3>
        <p>
          A glade is an open, grassy space, a clearing surrounded by trees
          within a forest or woodland. Here it is the lobby: the place
          where wizards gather, open tables and find a game.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Opening a table</h3>
        <p>
          Create Room sets up a new table. A public room is open to
          everyone: any wizard can see it here and join. A private room
          is for your friends only: only they see it in the Glade, and
          only they can join.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Before the game</h3>
        <p>
          Whoever created a room can delete it, as long as its game has
          not started. Every room, with its game, is removed 24 hours
          after it was created, finished or not.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Time per turn</h3>
        <p>
          With no limit, a game waits for you: choose Leave for now at
          the table and come back to it later.
        </p>
        <p>
          With a time limit, the game goes on without you. When your time
          runs out, a bot makes that move for you, and after the room's
          number of missed turns in a row (5 unless the room says
          otherwise) a bot plays your seat for good. The last wizard left
          at a game is never put out, so a game with a time limit plays
          on to its end even when everyone has left the table.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Quitting</h3>
        <p>
          Quit game, at Leave Table, hands your seat to a bot for the rest
          of the game. You cannot come back to it, and the game counts as
          played but not finished, which lowers your Reliability. When the
          last wizard quits, the game ends there, unfinished for everyone.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Your game has begun</h3>
        <p>
          When your name in the navbar glows gold, a game you are in has
          started. Go to your Study, your profile page (click your name), and
          choose Take your seat.
        </p>
      </section>

    </div>
  `,
    de: `
    <div class="home-rules-content">

      <section class="home-rules-section">
        <h3>Was ist eine Lichtung?</h3>
        <p>
          Eine Lichtung ist eine offene, grasbewachsene Stelle, eine
          freie Fläche mitten im Wald, ringsum von Bäumen umgeben. Hier
          ist sie die Lobby: der Ort, an dem sich die Zauberer treffen,
          Tische eröffnen und eine Partie finden.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Einen Tisch eröffnen</h3>
        <p>
          Mit Raum erstellen richtest du einen neuen Tisch ein. Ein
          öffentlicher Raum steht allen offen: Jeder Zauberer sieht ihn
          hier und kann beitreten. Ein privater Raum ist nur für deinen
          Freundeskreis: Nur deine Freunde sehen ihn auf der Lichtung,
          und nur sie können beitreten.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Vor der Partie</h3>
        <p>
          Wer einen Raum erstellt hat, kann ihn löschen, solange die
          Partie noch nicht begonnen hat. Jeder Raum wird mit seiner
          Partie 24 Stunden nach dem Erstellen entfernt, ob sie zu Ende
          gespielt ist oder nicht.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Zeit pro Zug</h3>
        <p>
          Ohne Zeitlimit wartet die Partie auf dich: Wähle am Tisch Für
          eine Weile gehen und komm später zurück.
        </p>
        <p>
          Mit Zeitlimit läuft die Partie ohne dich weiter. Läuft deine
          Zeit ab, macht ein Bot diesen Zug für dich, und nach so vielen
          verpassten Zügen in Folge, wie der Raum vorgibt (sonst 5),
          spielt ein Bot deinen Platz für immer. Der letzte Zauberer einer
          Partie wird nie hinausgesetzt, daher läuft eine Partie mit
          Zeitlimit bis zum Ende weiter, auch wenn alle den Tisch
          verlassen haben.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Aufgeben</h3>
        <p>
          Mit Partie aufgeben, unter Tisch verlassen, übernimmt ein Bot
          deinen Platz bis zum Ende. Du kannst nicht zurück, und die
          Partie zählt als gespielt, aber nicht beendet, was deine
          Zuverlässigkeit senkt. Gibt der letzte Zauberer auf, endet die
          Partie dort, für alle unbeendet.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Deine Partie hat begonnen</h3>
        <p>
          Leuchtet dein Name in der Navigationsleiste golden, hat eine
          Partie begonnen, in der du mitspielst. Geh in deine
          Studierstube, deine Profilseite (Klick auf deinen Namen), und
          wähle Zum Tisch.
        </p>
      </section>

    </div>
  `,
  },
  profile: {
    en: `
    <div class="home-rules-content">

      <section class="home-rules-section">
        <h3>What is the Study?</h3>
        <p>
          Every wizard has a study: a quiet room where they keep their
          books and records. Yours holds what you have played, how well,
          and the wizards you have played with.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Your games</h3>
        <p>
          Full games are played to the last round, short games end
          sooner. For each you see how many you played, how many you won
          and your win rate. Highest score is your best single game, Total
          points all your game scores added up. Your level grows with your
          total points, from short and full games alike; full games, being
          longer, get you there faster.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Reliability</h3>
        <p>
          Reliability is the share of your games you played to the end.
          Every game you quit, or lose to a bot after missing too many
          turns, counts as not finished and lowers it. Other wizards see
          it in your Study: a low reliability tells them you often leave
          games early, and they may think twice before sharing a table
          with you. A game still running does not count until it ends.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Finding players</h3>
        <p>
          Find Players searches by wizard name: visit their Study or send
          a friend request. Requests sent to you wait under Friend
          Requests, and your friends are listed under Social. Only friends
          can see and join your private rooms.
        </p>
        <p>
          Recent opponents remembers the last 100 wizards you played with,
          and how many games. Click a name to visit that wizard's Study.
        </p>
      </section>

    </div>
  `,
    de: `
    <div class="home-rules-content">

      <section class="home-rules-section">
        <h3>Was ist die Studierstube?</h3>
        <p>
          Jeder Zauberer hat eine Studierstube: einen stillen Raum, in dem
          er seine Bücher und Aufzeichnungen aufbewahrt. Deine hält fest,
          was du gespielt hast, wie gut, und mit welchen Zauberern.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Deine Partien</h3>
        <p>
          Ganze Partien gehen bis zur letzten Runde, kurze enden früher.
          Für beide siehst du, wie viele du gespielt und gewonnen hast,
          und deine Siegquote. Höchste Punktzahl ist deine beste einzelne
          Partie, Gesamtpunkte sind alle Partien zusammengezählt. Deine
          Stufe steigt mit deinen Gesamtpunkten, aus kurzen wie aus ganzen
          Partien; ganze Partien, weil länger, bringen dich schneller
          voran.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Zuverlässigkeit</h3>
        <p>
          Zuverlässigkeit ist der Anteil deiner Partien, die du bis zum
          Ende gespielt hast. Jede Partie, die du aufgibst oder nach zu
          vielen verpassten Zügen an einen Bot verlierst, zählt als nicht
          beendet und senkt sie. Andere Zauberer sehen sie in deiner
          Studierstube: Eine niedrige Zuverlässigkeit zeigt ihnen, dass du
          Partien oft früh verlässt, und sie überlegen es sich vielleicht
          zweimal, ob sie mit dir an einen Tisch gehen. Eine laufende
          Partie zählt erst, wenn sie endet.
        </p>
      </section>

      <section class="home-rules-section">
        <h3>Spieler finden</h3>
        <p>
          Mit Mitspielende finden suchst du nach Zauberernamen: Besuche ihre
          Studierstube oder schick eine Freundschaftsanfrage. Anfragen an
          dich warten unter Freundschaftsanfragen, deine Freunde stehen
          unter Kontakte. Nur Freunde sehen deine privaten Räume und
          können beitreten.
        </p>
        <p>
          Zuletzt am Tisch merkt sich die letzten 100 Zauberer, mit denen du
          gespielt hast, und wie viele Partien. Klick auf einen Namen, um
          seine Studierstube zu besuchen.
        </p>
      </section>

    </div>
  `,
  },
};

export const aboutHtml = (): string => about[getLanguage()];
export const rulesHtml = (): string => rules[getLanguage()];
export const legalHtml = (): string => legal[getLanguage()];
export const helpHtml = (page: HelpPage): string | null =>
  help[page]?.[getLanguage()] ?? null;
