import { useEffect, useRef } from "react"

import { useSound } from "@/sound/SoundProvider"

const BASE_TITLE = "Disapoly"

/**
 * Alerts the player when it's their turn in an online game: a chime on the
 * transition, plus a flashing document title whenever it's their turn and the
 * tab is in the background (so friends who switched tabs notice).
 */
export function useTurnNotification(isMyTurn: boolean, label: string): void {
  const { play } = useSound()
  const wasMyTurn = useRef(false)
  const flashTimer = useRef<number | null>(null)

  // Chime once when the turn becomes yours.
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) play("turn")
    wasMyTurn.current = isMyTurn
  }, [isMyTurn, play])

  // Flash the tab title while it's your turn and the tab is hidden.
  useEffect(() => {
    const stop = () => {
      if (flashTimer.current !== null) {
        clearInterval(flashTimer.current)
        flashTimer.current = null
        document.title = BASE_TITLE
      }
    }
    const update = () => {
      const shouldFlash = isMyTurn && document.hidden
      if (shouldFlash && flashTimer.current === null) {
        let on = false
        flashTimer.current = window.setInterval(() => {
          on = !on
          document.title = on ? `🔔 ${label}` : BASE_TITLE
        }, 900)
      } else if (!shouldFlash) {
        stop()
      }
    }

    update()
    document.addEventListener("visibilitychange", update)
    return () => {
      document.removeEventListener("visibilitychange", update)
      stop()
    }
  }, [isMyTurn, label])
}
