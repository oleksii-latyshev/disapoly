import { describe, expect, it } from "vitest"

import { renderLog } from "../helpers/log-format"
import { translate } from "../translate"
import { en } from "../translations/en"
import { ru } from "../translations/ru"

describe("translate", () => {
  it("fills {param} placeholders", () => {
    expect(
      translate("en", "log.rent", {
        name: "Ann",
        rent: 24,
        owner: "Bob",
        tile: "Boardwalk",
      })
    ).toBe("Ann pays $24 rent to Bob for Boardwalk.")
  })

  it("returns the key itself when unknown", () => {
    expect(translate("en", "no.such.key")).toBe("no.such.key")
  })

  it("has the same keys in every language", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
  })
})

describe("renderLog", () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate("en", key, params)

  it("resolves translatable { t } params before formatting", () => {
    const text = renderLog(
      { id: 1, key: "log.drew", params: { name: "Ann", card: { t: "card.ch_go" } } },
      t
    )
    expect(text).toBe("Ann drew: Advance to GO. Collect $200.")
  })
})
