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
  Diamond,
  Droplets,
  Factory,
  FerrisWheel,
  Fish,
  Flag,
  Flower,
  Flower2,
  Gem,
  Gift,
  Guitar,
  Lamp,
  Lock,
  Mountain,
  RadioTower,
  Sailboat,
  Shell,
  Ship,
  ShoppingBag,
  Siren,
  Sprout,
  Sun,
  TrainFront,
  TrainFrontTunnel,
  TrainTrack,
  TramFront,
  TreePalm,
  TreePine,
  Trophy,
  Umbrella,
  Waves,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { GROUP_COLOR } from "@/modules/board"
import type { TileDefinition } from "@/modules/game-core"

export type TileVisual = {
  Icon: LucideIcon
  /** Signature accent color used for the emblem and corner tint. */
  color: string
  /** Short uppercase label shown on corner tiles. */
  label?: string
}

/** Corner tiles sit at the quarter points of any board size. */
export function isCornerTile(id: number, size: number): boolean {
  return id % (size / 4) === 0
}

/**
 * One hand-picked emblem per property, keyed by tile *name* — names are
 * stable across board sizes while ids shift.
 */
const PROPERTY_ICONS: Record<string, LucideIcon> = {
  "Mediterranean Avenue": Waves,
  "Baltic Avenue": Anchor,
  "Shoreline Drive": Umbrella,
  "Harbor Lane": Ship,
  "Beacon Street": RadioTower,
  "Reading Railroad": TrainFront,
  "Oriental Avenue": Lamp,
  "Vermont Avenue": Mountain,
  "Connecticut Avenue": Sailboat,
  "St. Charles Place": Church,
  "Electric Company": Zap,
  "States Avenue": Flag,
  "Virginia Avenue": Flower2,
  "Pennsylvania Railroad": TramFront,
  "St. James Place": Castle,
  "Tennessee Avenue": Guitar,
  "New York Avenue": Building2,
  "Kentucky Avenue": Trophy, // the Derby
  "Indiana Avenue": CarFront, // the 500
  "Illinois Avenue": Wheat,
  "B&O Railroad": TrainFrontTunnel,
  "Atlantic Avenue": Shell,
  "Ventnor Avenue": Sun,
  "Water Works": Droplets,
  "Marvin Gardens": TreePalm,
  "Orchid Terrace": Flower,
  "Lavender Row": Sprout,
  "Amethyst Avenue": Diamond,
  "Pacific Avenue": Fish,
  "North Carolina Avenue": TreePine,
  "Pennsylvania Avenue": Factory,
  "Short Line Railroad": TrainTrack,
  "Park Place": Crown,
  "Fifth Avenue": ShoppingBag,
  Boardwalk: FerrisWheel,
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
      return {
        Icon: PROPERTY_ICONS[def.name] ?? Waves,
        color: GROUP_COLOR[def.group],
      }
    case "railroad":
      return { Icon: PROPERTY_ICONS[def.name] ?? TrainFront, color: "#475569" }
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
