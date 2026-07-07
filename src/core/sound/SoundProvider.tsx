/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { playSound, type SoundName, unlock } from "./engine"

const STORAGE_KEY = "disapoly.muted"

type SoundState = {
  muted: boolean
  setMuted: (muted: boolean) => void
  play: (name: SoundName) => void
}

const SoundContext = createContext<SoundState | undefined>(undefined)

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  )

  // Unlock the audio context on the first user interaction (autoplay policy).
  useEffect(() => {
    const onGesture = () => unlock()
    window.addEventListener("pointerdown", onGesture, { once: true })
    window.addEventListener("keydown", onGesture, { once: true })
    return () => {
      window.removeEventListener("pointerdown", onGesture)
      window.removeEventListener("keydown", onGesture)
    }
  }, [])

  const setMuted = useCallback((next: boolean) => {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
    setMutedState(next)
  }, [])

  const play = useCallback(
    (name: SoundName) => {
      if (!muted) playSound(name)
    },
    [muted]
  )

  const value = useMemo<SoundState>(
    () => ({ muted, setMuted, play }),
    [muted, setMuted, play]
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound(): SoundState {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error("useSound must be used within a SoundProvider")
  return ctx
}
