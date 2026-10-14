import { useEffect, useState } from "react"
import type {
  GameState,
  RoomMember,
  RoomState,
  TileState,
} from "@/core/game-core"
import { NetworkGame } from "./NetworkGame"

const mockTiles: TileState[] = Array.from({ length: 40 }, () => ({
  ownerId: null,
  houses: 0,
  mortgaged: false,
}))

// Configure ownership and developments
// Brown
mockTiles[1] = { ownerId: "p4", houses: 0, mortgaged: false } // Mediterranean
mockTiles[3] = { ownerId: "p4", houses: 0, mortgaged: false } // Baltic
// Railroad 1
mockTiles[5] = { ownerId: "p4", houses: 0, mortgaged: false } // Reading RR
// Light Blue (Monopoly for Kate with 1 house each)
mockTiles[6] = { ownerId: "p5", houses: 1, mortgaged: false } // Oriental
mockTiles[8] = { ownerId: "p5", houses: 1, mortgaged: false } // Vermont
mockTiles[9] = { ownerId: "p5", houses: 1, mortgaged: false } // Connecticut
// Pink (Monopoly for disa)
mockTiles[11] = { ownerId: "p1", houses: 0, mortgaged: false } // St. Charles
mockTiles[12] = { ownerId: "p3", houses: 0, mortgaged: true } // Electric Co (MTG)
mockTiles[13] = { ownerId: "p1", houses: 0, mortgaged: false } // States
mockTiles[14] = { ownerId: "p1", houses: 0, mortgaged: false } // Virginia
// Railroad 2
mockTiles[15] = { ownerId: "p4", houses: 0, mortgaged: false } // Pennsylvania RR
// Orange (Monopoly for Sonya with 3-4 houses)
mockTiles[16] = { ownerId: "p2", houses: 3, mortgaged: false } // St. James
mockTiles[18] = { ownerId: "p2", houses: 3, mortgaged: false } // Tennessee
mockTiles[19] = { ownerId: "p2", houses: 4, mortgaged: false } // New York
// Red (disa owns 2, landing on 3rd!)
mockTiles[21] = { ownerId: "p1", houses: 0, mortgaged: false } // Kentucky
mockTiles[23] = { ownerId: "p1", houses: 0, mortgaged: false } // Indiana
mockTiles[24] = { ownerId: null, houses: 0, mortgaged: false } // Illinois (about to complete set!)
// Railroad 3
mockTiles[25] = { ownerId: "p4", houses: 0, mortgaged: false } // B&O RR
// Yellow
mockTiles[26] = { ownerId: "p3", houses: 0, mortgaged: false } // Atlantic
mockTiles[27] = { ownerId: "p3", houses: 0, mortgaged: false } // Ventnor (Bounty on it!)
mockTiles[28] = { ownerId: "p3", houses: 0, mortgaged: false } // Water Works
mockTiles[29] = { ownerId: "p5", houses: 0, mortgaged: false } // Marvin Gardens
// Green (Monopoly for Danya with 2 houses each)
mockTiles[31] = { ownerId: "p4", houses: 2, mortgaged: false } // Pacific
mockTiles[32] = { ownerId: "p4", houses: 2, mortgaged: false } // North Carolina
mockTiles[34] = { ownerId: "p4", houses: 2, mortgaged: false } // Pennsylvania
// Railroad 4
mockTiles[35] = { ownerId: "p4", houses: 0, mortgaged: false } // Short Line
// Dark Blue (Monopoly for Sonya with Hotels!)
mockTiles[37] = { ownerId: "p2", houses: 5, mortgaged: false } // Park Place (Hotel)
mockTiles[39] = { ownerId: "p2", houses: 5, mortgaged: false } // Boardwalk (Hotel)

const mockGameState: GameState = {
  status: "playing",
  settings: {
    payMode: "turbo",
    orderRoll: false,
    board: "classic",
    events: true,
  },
  players: [
    {
      id: "p1",
      nickname: "disa",
      color: "#f97316",
      emoji: "🦊",
      balance: 1420,
      position: 24,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
    },
    {
      id: "p2",
      nickname: "Sonya",
      color: "#ec4899",
      emoji: "🐱",
      balance: 2350,
      position: 39,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 1,
      isBankrupt: false,
    },
    {
      id: "p3",
      nickname: "Kirill",
      color: "#3b82f6",
      emoji: "🎮",
      balance: 380,
      position: 10,
      inJail: true,
      jailTurns: 1,
      getOutOfJailCards: 0,
      isBankrupt: false,
    },
    {
      id: "p4",
      nickname: "Danya",
      color: "#10b981",
      emoji: "🎲",
      balance: 1160,
      position: 15,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
    },
    {
      id: "p5",
      nickname: "Kate",
      color: "#a855f7",
      emoji: "✨",
      balance: 890,
      position: 6,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
    },
    {
      id: "p6",
      nickname: "Artem",
      color: "#eab308",
      emoji: "💀",
      balance: 0,
      position: 39,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isBankrupt: true,
    },
  ],
  tiles: mockTiles,
  currentPlayerIndex: 0,
  phase: "awaiting-buy",
  dice: [4, 4],
  diceRolls: 14,
  doublesCount: 1,
  pendingPurchase: 24,
  auction: null,
  pendingDebt: null,
  orderRolls: null,
  bank: { houses: 18, hotels: 10 },
  rngSeed: 42,
  chance: { order: [0, 1, 2, 3], pos: 1 },
  chest: { order: [0, 1, 2, 3], pos: 2 },
  lastCard: null,
  activeEvent: {
    kind: "bounty",
    tileId: 27,
    amount: 150,
    expiresAtTurn: 18,
  },
  eventCooldownUntil: 0,
  pendingTrades: [],
  nextTradeId: 1,
  turnCount: 14,
  history: [
    { turn: 0, p1: 1500, p2: 1500, p3: 1500, p4: 1500, p5: 1500, p6: 1500 },
    { turn: 4, p1: 1350, p2: 1800, p3: 1200, p4: 1600, p5: 1450, p6: 900 },
    { turn: 8, p1: 1400, p2: 2400, p3: 750, p4: 1900, p5: 1300, p6: 400 },
    { turn: 14, p1: 1620, p2: 3350, p3: 530, p4: 2160, p5: 1250, p6: 0 },
  ],
  log: [
    { id: 1, key: "log.started", params: { n: 6 } },
    {
      id: 2,
      key: "log.tradeProposed",
      params: { from: "Sonya", to: "Kirill" },
    },
    { id: 3, key: "log.tradeAccepted", params: { name: "Kirill" } },
    { id: 4, key: "log.passGo", params: { name: "Danya", amount: 200 } },
    {
      id: 5,
      key: "log.builtHotel",
      params: { name: "Sonya", tile: "Park Place", cost: 200 },
    },
    {
      id: 6,
      key: "log.builtHotel",
      params: { name: "Sonya", tile: "Boardwalk", cost: 200 },
    },
    {
      id: 7,
      key: "log.rolled",
      params: { name: "Artem", a: 5, b: 3, sum: 8 },
    },
    {
      id: 8,
      key: "log.rent",
      params: {
        name: "Artem",
        rent: 1500,
        owner: "Sonya",
        tile: "Boardwalk",
      },
    },
    { id: 9, key: "log.bankrupt", params: { name: "Artem" } },
    {
      id: 10,
      key: "log.eventBounty",
      params: { amount: 150, tile: "Ventnor Avenue" },
    },
    {
      id: 11,
      key: "log.rolledDoubles",
      params: { name: "disa", a: 4, b: 4, sum: 8 },
    },
  ],
  nextLogId: 12,
  winnerId: null,
}

const mockMembers: RoomMember[] = [
  {
    id: "p1",
    nickname: "disa",
    emoji: "🦊",
    color: "#f97316",
    isHost: true,
    connected: true,
    disconnectedAt: null,
  },
  {
    id: "p2",
    nickname: "Sonya",
    emoji: "🐱",
    color: "#ec4899",
    isHost: false,
    connected: true,
    disconnectedAt: null,
  },
  {
    id: "p3",
    nickname: "Kirill",
    emoji: "🎮",
    color: "#3b82f6",
    isHost: false,
    connected: true,
    disconnectedAt: null,
  },
  {
    id: "p4",
    nickname: "Danya",
    emoji: "🎲",
    color: "#10b981",
    isHost: false,
    connected: true,
    disconnectedAt: null,
  },
  {
    id: "p5",
    nickname: "Kate",
    emoji: "✨",
    color: "#a855f7",
    isHost: false,
    connected: true,
    disconnectedAt: null,
  },
  {
    id: "p6",
    nickname: "Artem",
    emoji: "💀",
    color: "#eab308",
    isHost: false,
    connected: false,
    disconnectedAt: Date.now() - 60000,
  },
]

const mockRoomState: RoomState = {
  roomId: "preview-room",
  phase: "in-game",
  members: mockMembers,
  game: mockGameState,
  autoSkipAt: null,
  kickedIds: [],
}

export function PreviewGame() {
  const [reactionTick, setReactionTick] = useState(1)

  useEffect(() => {
    // Keep reactions floating periodically
    const timer = setInterval(() => {
      setReactionTick((t) => t + 1)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return (
    <NetworkGame
      state={mockRoomState}
      self={mockMembers[0]}
      send={() => {}}
      connected={true}
      reactions={[{ id: reactionTick, playerId: "p2", emoji: "🔥" }]}
      latencies={{
        p1: 34,
        p2: 42,
        p3: 65,
        p4: 28,
        p5: 51,
      }}
    />
  )
}
