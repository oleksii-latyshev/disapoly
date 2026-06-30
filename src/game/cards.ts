/**
 * Declarative Chance and Community Chest decks. Effects are data — the reducer
 * executes them in one switch (see architecture.md §3.7). Card display text is
 * localized on the client via the i18n key `card.<id>`.
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

export type Card = { id: string; effect: CardEffect }

export const CHANCE: readonly Card[] = [
  { id: "ch_go", effect: { kind: "moveTo", tile: 0 } },
  { id: "ch_illinois", effect: { kind: "moveTo", tile: 24 } },
  { id: "ch_charles", effect: { kind: "moveTo", tile: 11 } },
  { id: "ch_reading", effect: { kind: "moveTo", tile: 5 } },
  { id: "ch_boardwalk", effect: { kind: "moveTo", tile: 39 } },
  { id: "ch_dividend", effect: { kind: "money", amount: 50 } },
  { id: "ch_jailfree", effect: { kind: "getOutOfJail" } },
  { id: "ch_back3", effect: { kind: "moveBack", steps: 3 } },
  { id: "ch_jail", effect: { kind: "goToJail" } },
  { id: "ch_repairs", effect: { kind: "repairs", perHouse: 25, perHotel: 100 } },
  { id: "ch_poortax", effect: { kind: "money", amount: -15 } },
  { id: "ch_chairman", effect: { kind: "payEach", amount: 50 } },
] as const

export const COMMUNITY_CHEST: readonly Card[] = [
  { id: "cc_go", effect: { kind: "moveTo", tile: 0 } },
  { id: "cc_bankerror", effect: { kind: "money", amount: 200 } },
  { id: "cc_doctor", effect: { kind: "money", amount: -50 } },
  { id: "cc_jailfree", effect: { kind: "getOutOfJail" } },
  { id: "cc_jail", effect: { kind: "goToJail" } },
  { id: "cc_birthday", effect: { kind: "collectFromEach", amount: 10 } },
  { id: "cc_refund", effect: { kind: "money", amount: 20 } },
  { id: "cc_hospital", effect: { kind: "money", amount: -100 } },
  { id: "cc_inherit", effect: { kind: "money", amount: 100 } },
  { id: "cc_insurance", effect: { kind: "money", amount: 100 } },
  { id: "cc_school", effect: { kind: "money", amount: -50 } },
  { id: "cc_streets", effect: { kind: "repairs", perHouse: 40, perHotel: 115 } },
] as const
