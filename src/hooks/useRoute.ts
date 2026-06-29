import { useCallback, useEffect, useState } from "react"

/** Read the `?room=` code from the current URL. */
function roomFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("room")
}

/**
 * Minimal URL routing without a router dependency: the whole app is either on
 * the home screen or inside a room, keyed by the `?room=` query param.
 */
export function useRoute() {
  const [roomId, setRoomId] = useState<string | null>(roomFromUrl)

  useEffect(() => {
    const onPop = () => setRoomId(roomFromUrl())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const navigate = useCallback((id: string | null) => {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set("room", id)
    else url.searchParams.delete("room")
    window.history.pushState({}, "", url)
    setRoomId(id)
  }, [])

  return { roomId, navigate }
}
