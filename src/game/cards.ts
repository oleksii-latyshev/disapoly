/**
 * Declarative Chance and Community Chest decks. Effects are data — the reducer
 * executes them in one switch (see architecture.md §3.7). Card `text` is English
 * (shown in the log and the card banner); UI chrome around it is localized.
 */

export type CardEffect =
  | { kind: "money"; amount: number } // + collect from / − pay to the bank
  | { kind: "collectFromEach"; amount: number }
  | { kind: "payEach"; amount: number }
  | { kind: "moveTo"; tile: number } // advance (collect GO if passed)
  | { kind: "moveBack"; steps: number }
  | { kind: "goToJail" }
  | { kind: "getOutOfJail" }
  | { kind: "repairs"; perHouse: number; perHotel: number }

export type Card = { id: string; text: string; effect: CardEffect }

export const CHANCE: readonly Card[] = [
  { id: "ch_go", text: "Advance to GO. Collect $200.", effect: { kind: "moveTo", tile: 0 } },
  { id: "ch_illinois", text: "Advance to Illinois Avenue.", effect: { kind: "moveTo", tile: 24 } },
  { id: "ch_charles", text: "Advance to St. Charles Place.", effect: { kind: "moveTo", tile: 11 } },
  { id: "ch_reading", text: "Take a trip to Reading Railroad.", effect: { kind: "moveTo", tile: 5 } },
  { id: "ch_boardwalk", text: "Advance to Boardwalk.", effect: { kind: "moveTo", tile: 39 } },
  { id: "ch_dividend", text: "Bank pays you a dividend of $50.", effect: { kind: "money", amount: 50 } },
  { id: "ch_jailfree", text: "Get out of jail free.", effect: { kind: "getOutOfJail" } },
  { id: "ch_back3", text: "Go back 3 spaces.", effect: { kind: "moveBack", steps: 3 } },
  { id: "ch_jail", text: "Go to jail. Do not pass GO.", effect: { kind: "goToJail" } },
  { id: "ch_repairs", text: "Make repairs: $25 per house, $100 per hotel.", effect: { kind: "repairs", perHouse: 25, perHotel: 100 } },
  { id: "ch_poortax", text: "Pay poor tax of $15.", effect: { kind: "money", amount: -15 } },
  { id: "ch_chairman", text: "Elected chairman. Pay each player $50.", effect: { kind: "payEach", amount: 50 } },
] as const

export const COMMUNITY_CHEST: readonly Card[] = [
  { id: "cc_go", text: "Advance to GO. Collect $200.", effect: { kind: "moveTo", tile: 0 } },
  { id: "cc_bankerror", text: "Bank error in your favor. Collect $200.", effect: { kind: "money", amount: 200 } },
  { id: "cc_doctor", text: "Doctor's fee. Pay $50.", effect: { kind: "money", amount: -50 } },
  { id: "cc_jailfree", text: "Get out of jail free.", effect: { kind: "getOutOfJail" } },
  { id: "cc_jail", text: "Go to jail. Do not pass GO.", effect: { kind: "goToJail" } },
  { id: "cc_birthday", text: "It's your birthday. Collect $10 from each player.", effect: { kind: "collectFromEach", amount: 10 } },
  { id: "cc_refund", text: "Income tax refund. Collect $20.", effect: { kind: "money", amount: 20 } },
  { id: "cc_hospital", text: "Pay hospital fees of $100.", effect: { kind: "money", amount: -100 } },
  { id: "cc_inherit", text: "You inherit $100.", effect: { kind: "money", amount: 100 } },
  { id: "cc_insurance", text: "Life insurance matures. Collect $100.", effect: { kind: "money", amount: 100 } },
  { id: "cc_school", text: "School fees. Pay $50.", effect: { kind: "money", amount: -50 } },
  { id: "cc_streets", text: "Street repairs: $40 per house, $115 per hotel.", effect: { kind: "repairs", perHouse: 40, perHotel: 115 } },
] as const
