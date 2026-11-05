# Card hierarchy

Thirteen ranks in each of the four elements (Fire, Earth, Water, Air), lowest to
highest, plus the Fool (the Jester) and the Wizard, which belong to no element.

| Rank | Title | Notes |
|---|---|---|
| 1 | Peasant | |
| 2 | Farmer | |
| 3 | Citizen | |
| 4 | Soldier | |
| 5 | Merchant | |
| 6 | Priest | |
| 7 | **Trickster** | Power: win the trick and you may move an opponent's prediction up or down by one |
| 8 | **Seer** | Power: win the trick and you may move your own prediction up or down by one |
| 9 | Noble | |
| 10 | General | |
| 11 | Heir | |
| 12 | Consort | |
| 13 | Monarch | |
| 0 | Fool | Lowest card; belongs to no element. Prints its jester-hat symbol and its title in yellow |
| 14 | Wizard | Highest card; belongs to no element. Prints its crook symbol and its title in yellow |

All titles are gender neutral.

## The Trickster and the Seer

They are two of the thirteen ranks, not extra cards, so the deck stays at 60
cards and the rounds per player count are unchanged (20 / 15 / 12 / 10 for
3 / 4 / 5 / 6 players).

Unlike the Wizard and the Fool, they follow suit like any other card, and the
power only happens if you win the trick with it.

- **Seer:** offered your own prediction minus one, as it stands, and plus one.
  Choosing the number you already have changes nothing.
- **Trickster:** choose an opponent, then they are offered their prediction
  minus one, as it stands, and plus one.
- A new prediction stays between 0 and the round number (the cards dealt that
  round); at either end of that range only two choices are offered.
- Usable in any round, including the last trick of a round.
- If nothing changes, the announcement says the player did not use the power,
  and does not name a target.

## On the cards

- The hierarchy title is printed across the middle of the card, in Merienda,
  with the same outline as the number.
- The Fool, Seer, Trickster and Wizard each carry a symbol in yellow, with the
  black outline: the Fool a jester's hat, the Seer an eye in a circle, the
  Trickster a comedy mask and the Wizard a shepherd's crook. On the Seer and
  Trickster it sits above the number and pushes the number and the element
  symbol down; on the Fool and Wizard, which have no number, it is on its own in
  the corner. The titles of these four are yellow too.
- The symbols are small lossless WebPs in `src/assets/cards/symbols/`, drawn
  white and tinted in code.
