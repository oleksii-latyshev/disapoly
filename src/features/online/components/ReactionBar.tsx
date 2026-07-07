import { REACTIONS } from "@/core/game-core"

/** A compact palette of emoji reactions to fling during a live game (online). */
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-1 rounded-md border bg-card p-1.5">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`React ${emoji}`}
          onClick={() => onReact(emoji)}
          className="flex-1 rounded-md py-1 text-lg transition-transform hover:scale-125 hover:bg-muted active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
