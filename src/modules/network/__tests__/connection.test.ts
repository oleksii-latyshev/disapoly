import { describe, expect, it } from "vitest"

import { connectionQuality } from "../helpers/connection"

describe("connectionQuality", () => {
  it("is offline whenever the socket is down, regardless of ping", () => {
    expect(connectionQuality(false, 20)).toBe("offline")
    expect(connectionQuality(false, undefined)).toBe("offline")
  })

  it("is unknown until a ping arrives", () => {
    expect(connectionQuality(true, undefined)).toBe("unknown")
  })

  it("buckets by round-trip thresholds", () => {
    expect(connectionQuality(true, 0)).toBe("good")
    expect(connectionQuality(true, 149)).toBe("good")
    expect(connectionQuality(true, 150)).toBe("ok")
    expect(connectionQuality(true, 399)).toBe("ok")
    expect(connectionQuality(true, 400)).toBe("poor")
  })
})
