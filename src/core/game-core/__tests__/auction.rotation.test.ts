import { describe, expect, it } from "vitest"

import { nextActiveBidder } from "../reducer/auction"
import type { AuctionState } from "../types"

function auction(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    tileId: 1,
    highBid: 0,
    highBidderId: null,
    bidderOrder: ["p1", "p2", "p3"],
    activeBidderIds: ["p1", "p2", "p3"],
    currentBidderId: "p1",
    ...overrides,
  }
}

describe("nextActiveBidder", () => {
  it("advances through the fixed rotation", () => {
    expect(nextActiveBidder(auction(), "p1")).toBe("p2")
    expect(nextActiveBidder(auction(), "p2")).toBe("p3")
  })

  it("wraps around the end of the order", () => {
    expect(nextActiveBidder(auction(), "p3")).toBe("p1")
  })

  it("skips bidders who passed", () => {
    const a = auction({ activeBidderIds: ["p1", "p3"] })
    expect(nextActiveBidder(a, "p1")).toBe("p3")
  })

  it("returns the sole remaining bidder even from themselves", () => {
    const a = auction({ activeBidderIds: ["p2"] })
    expect(nextActiveBidder(a, "p2")).toBe("p2")
  })

  it("returns null when nobody is left in", () => {
    const a = auction({ activeBidderIds: [] })
    expect(nextActiveBidder(a, "p1")).toBeNull()
  })
})
