/**
 * Icon + accent metadata for every tile. Each property gets its own vector
 * emblem (lucide icons, drawn in code — no image assets), so locations are
 * recognizable at a glance like the brand logos on classic fan boards.
 */

import {
  Anchor,
  ArrowBigRight,
  Banknote,
  Building2,
  CarFront,
  Castle,
  Church,
  CircleHelp,
  CircleParking,
  Crown,
  Droplets,
  Factory,
  FerrisWheel,
  Fish,
  Flag,
  Flower2,
  Gem,
  Gift,
  Guitar,
  Lamp,
  Lock,
  Mountain,
  Sailboat,
  Shell,
  Siren,
  Sun,
  TrainFront,
  TrainFrontTunnel,
  TrainTrack,
  TramFront,
  TreePalm,
  TreePine,
  Trophy,
  Waves,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { GROUP_COLOR } from "./board-meta"
import type { TileDefinition } from "@/game"

export type TileVisual = {
  Icon: LucideIcon
  /** Signature accent color used for the emblem and corner tint. */
  color: string
  /** Short uppercase label shown on corner tiles. */
  label?: string
}

const CORNER_IDS = new Set([0, 10, 20, 30])

export function isCornerTile(id: number): boolean {
  return CORNER_IDS.has(id)
}

/** One hand-picked emblem per property, keyed by tile id (see board.config). */
const PROPERTY_ICONS: Record<number, LucideIcon> = {
  1: Waves, // Mediterranean Avenue
  3: Anchor, // Baltic Avenue
  5: TrainFront, // Reading Railroad
  6: Lamp, // Oriental Avenue
  8: Mountain, // Vermont Avenue
  9: Sailboat, // Connecticut Avenue
  11: Church, // St. Charles Place
  12: Zap, // Electric Company
  13: Flag, // States Avenue
  14: Flower2, // Virginia Avenue
  15: TramFront, // Pennsylvania Railroad
  16: Castle, // St. James Place
  18: Guitar, // Tennessee Avenue
  19: Building2, // New York Avenue
  21: Trophy, // Kentucky Avenue (the Derby)
  23: CarFront, // Indiana Avenue (the 500)
  24: Wheat, // Illinois Avenue
  25: TrainFrontTunnel, // B&O Railroad
  26: Shell, // Atlantic Avenue
  27: Sun, // Ventnor Avenue
  28: Droplets, // Water Works
  29: TreePalm, // Marvin Gardens
  31: Fish, // Pacific Avenue
  32: TreePine, // North Carolina Avenue
  34: Factory, // Pennsylvania Avenue
  35: TrainTrack, // Short Line Railroad
  37: Crown, // Park Place
  39: FerrisWheel, // Boardwalk
}

/** Visual treatment for a tile: a unique emblem for every location. */
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
    case "street":
      return { Icon: PROPERTY_ICONS[def.id] ?? Waves, color: GROUP_COLOR[def.group] }
    case "railroad":
      return { Icon: PROPERTY_ICONS[def.id] ?? TrainFront, color: "#475569" }
    case "utility":
      return def.name.toLowerCase().includes("water")
        ? { Icon: Droplets, color: "#0ea5e9" }
        : { Icon: Zap, color: "#d97706" }
    default:
      return null
  }
}

/** Rough perceptual luminance (0–1) of a hex color, for contrast picks. */
export function hexLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 0.5
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Readable foreground (near-black/white) for text sitting on `hex`. */
export function contrastText(hex: string): string {
  return hexLuminance(hex) > 0.62 ? "#1f2937" : "#ffffff"
}
