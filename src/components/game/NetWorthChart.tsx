import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { GameState } from "@/game"

/**
 * Net worth (cash + property value) per player over the course of the game.
 * Default export so it can be code-split with `lazy()` (Recharts is heavy).
 */
export default function NetWorthChart({
  state,
  height = 240,
}: {
  state: GameState
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={state.history}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
        <XAxis
          dataKey="turn"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          stroke="rgba(128,128,128,0.4)"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          stroke="rgba(128,128,128,0.4)"
          width={48}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => `$${value}`}
          labelFormatter={(label) => `Turn ${label}`}
        />
        {state.players.map((p) => (
          <Line
            key={p.id}
            type="monotone"
            dataKey={p.id}
            name={p.nickname}
            stroke={p.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
