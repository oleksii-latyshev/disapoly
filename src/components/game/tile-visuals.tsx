/** Icon + accent metadata for non-street tiles (corners, taxes, draws, etc.). */

import {
  ArrowBigRight,
  Banknote,
  CircleHelp,
  CircleParking,
  Droplets,
  Gem,
  Gift,
  Lock,
  Siren,
  TrainFront,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { TileDefinition } from "@/game"

export type TileVisual = {
  Icon: LucideIcon
  /** Signature accent color used for the icon and corner tint. */
  color: string
  /** Short uppercase label shown on corner tiles. */
  label?: string
}

const CORNER_IDS = new Set([0, 10, 20, 30])

export function isCornerTile(id: number): boolean {
  return CORNER_IDS.has(id)
}

/** Visual treatment for a tile, or `null` for plain street tiles. */
export function tileVisual(def: TileDefinition): TileVisual | null {
  switch (def.type) {
    case "go":
      return { Icon: ArrowBigRight, color: "#16a34a", label: "GO" }
    case "jail":
      return { Icon: Lock, color: "#ea580c", label: "JAIL" }
    case "goToJail":
      return { Icon: Siren, color: "#dc2626", label: "GO TO JAIL" }
    case "freeParking":
      return { Icon: CircleParking, color: "#2563eb", label: "FREE PARKING" }
    case "tax":
      return def.name.toLowerCase().includes("luxury")
        ? { Icon: Gem, color: "#9333ea" }
        : { Icon: Banknote, color: "#0891b2" }
    case "chance":
      return { Icon: CircleHelp, color: "#f59e0b" }
    case "communityChest":
      return { Icon: Gift, color: "#2563eb" }
    case "railroad":
      return { Icon: TrainFront, color: "#6b7280" }
    case "utility":
      return def.name.toLowerCase().includes("water")
        ? { Icon: Droplets, color: "#0ea5e9" }
        : { Icon: Zap, color: "#eab308" }
    default:
      return null
  }
}
