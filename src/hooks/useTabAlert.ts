import { useEffect, useRef } from "react"

const BASE_TITLE = "Disapoly"

/**
 * A single global flasher owns the tab title at a time, so multiple concurrent
 * alerts (e.g. your turn *and* an incoming trade) never fight over it — the
 * first to claim wins until it clears.
 */
let flashOwner: symbol | null = null

/**
 * Flashes the document title whenever `active` is true and the tab is hidden,
 * so a friend who switched tabs notices they're needed. Sound is handled
 * elsewhere (see `useGameSounds`); this hook only touches the title.
 */
export function useTabAlert(active: boolean, label: string): void {
  const id = useRef<symbol>(undefined as unknown as symbol)
  if (id.current === undefined) id.current = Symbol("tab-alert")

  useEffect(() => {
    const me = id.current
    let timer: number | null = null

    const release = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      if (flashOwner === me) {
        flashOwner = null
        document.title = BASE_TITLE
      }
    }

    const update = () => {
      const shouldFlash = active && document.hidden
      if (shouldFlash && timer === null && (flashOwner === null || flashOwner === me)) {
        flashOwner = me
        let on = false
        timer = window.setInterval(() => {
          on = !on
          document.title = on ? `🔔 ${label}` : BASE_TITLE
        }, 900)
      } else if (!shouldFlash) {
        release()
      }
    }

    update()
    document.addEventListener("visibilitychange", update)
    return () => {
      document.removeEventListener("visibilitychange", update)
      release()
    }
  }, [active, label])
}
