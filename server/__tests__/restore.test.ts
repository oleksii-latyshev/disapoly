import { describe, expect, it } from "vitest"

import { restoreRoom } from "../helpers/restore"
import { inGameRoom } from "./helpers"

const NOW = 1_000_000

describe("restoreRoom", () => {
  it("flips every member to disconnected with a fresh absence clock", () => {
    const revived = restoreRoom({ ...inGameRoom(), autoSkipAt: 123 }, NOW)
    expect(revived.autoSkipAt).toBeNull()
    for (const m of revived.members) {
      expect(m.connected).toBe(false)
      expect(m.disconnectedAt).toBe(NOW)
    }
    expect(revived.game).not.toBeNull()
  })

  it("migrates a game persisted by an older build", () => {
    const room = inGameRoom()
    const legacy = { ...room.game!, pendingTrades: undefined } as never
    const revived = restoreRoom({ ...room, game: legacy }, NOW)
    expect(revived.game!.pendingTrades).toEqual([])
    expect(revived.game!.nextTradeId).toBe(1)
  })
})
