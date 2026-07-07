/**
 * Surprise-event match settings, shared by the online lobby (host) and the
 * hot-seat setup: the on/off toggle, the spawn frequency, and per-kind chips
 * so a table can drop the events it doesn't like.
 */

import { Button } from "@/shared/components/ui/button"
import {
  ALL_EVENT_KINDS,
  type BoardEventKind,
  type EventFrequency,
} from "@/core/game-core"
import { useT } from "@/core/i18n"

import { EVENT_EMOJI } from "@/core/board"

const FREQUENCIES: EventFrequency[] = ["rare", "normal", "frequent"]

export function EventSettings({
  events,
  onEventsChange,
  frequency,
  onFrequencyChange,
  kinds,
  onKindsChange,
}: {
  events: boolean
  onEventsChange: (events: boolean) => void
  frequency: EventFrequency
  onFrequencyChange: (frequency: EventFrequency) => void
  kinds: BoardEventKind[]
  onKindsChange: (kinds: BoardEventKind[]) => void
}) {
  const t = useT()

  const toggleKind = (kind: BoardEventKind) =>
    onKindsChange(
      kinds.includes(kind)
        ? kinds.filter((k) => k !== kind)
        : // Keep the stable ALL_EVENT_KINDS order regardless of click order.
          ALL_EVENT_KINDS.filter((k) => kinds.includes(k) || k === kind)
    )

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant={events ? "default" : "outline"}
        size="sm"
        onClick={() => onEventsChange(!events)}
      >
        {t("lobby.events")}: {events ? t("common.on") : t("common.off")}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t("lobby.events.desc")}
      </span>

      {events && (
        <>
          <span className="mt-1 text-xs text-muted-foreground">
            {t("lobby.eventFreq")}
          </span>
          <div className="flex gap-2">
            {FREQUENCIES.map((f) => (
              <Button
                key={f}
                variant={frequency === f ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onFrequencyChange(f)}
              >
                {t(`events.freq.${f}`)}
              </Button>
            ))}
          </div>

          <span className="mt-1 text-xs text-muted-foreground">
            {t("lobby.eventKinds")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_EVENT_KINDS.map((kind) => {
              const on = kinds.includes(kind)
              return (
                <Button
                  key={kind}
                  variant={on ? "default" : "outline"}
                  size="sm"
                  className={on ? undefined : "opacity-60"}
                  onClick={() => toggleKind(kind)}
                >
                  {EVENT_EMOJI[kind]} {t(`event.${kind}`)}
                </Button>
              )
            })}
          </div>
          {kinds.length === 0 && (
            <span className="text-xs text-destructive">
              {t("events.noneSelected")}
            </span>
          )}
        </>
      )}
    </div>
  )
}
