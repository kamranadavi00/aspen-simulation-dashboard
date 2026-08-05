'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { AspenRow } from '@/lib/types'
import { cn } from '@/lib/utils'

// Chart color palette (matches design tokens)
const COLORS = {
  teal: 'oklch(0.72 0.19 200)',
  blue: 'oklch(0.65 0.2 220)',
  green: 'oklch(0.78 0.16 140)',
  amber: 'oklch(0.75 0.18 60)',
  red: 'oklch(0.65 0.22 25)',
}

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border border-border bg-card p-5', className)}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-56">{children}</div>
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    background: 'oklch(0.17 0.02 240)',
    border: '1px solid oklch(0.22 0.025 240)',
    borderRadius: '8px',
    color: 'oklch(0.93 0.01 220)',
    fontSize: '12px',
  },
  labelStyle: { color: 'oklch(0.58 0.04 230)', marginBottom: 4 },
  itemStyle: { color: 'oklch(0.93 0.01 220)' },
}

const axisStyle = {
  tick: { fill: 'oklch(0.58 0.04 230)', fontSize: 11 },
  line: false as false,
  tickLine: false as false,
}

interface ChartsProps {
  data: AspenRow[]
}

// Sort data by a key for better line charts
function sortedBy(data: AspenRow[], key: keyof AspenRow) {
  return [...data].sort((a, b) => (a[key] as number) - (b[key] as number))
}

// Heatmap component
interface HeatmapProps {
  data: AspenRow[]
}

function Heatmap({ data }: HeatmapProps) {
  const [hovered, setHovered] = useState<{ t: number; p: number; y: number } | null>(null)

  const { cells, temps, pressures, minYield, maxYield } = useMemo(() => {
    const tempSet = [...new Set(data.map((d) => d.Temperature))].sort((a, b) => a - b)
    const pressSet = [...new Set(data.map((d) => d.Pressure))].sort((a, b) => a - b)

    const gridMap = new Map<string, number>()
    for (const row of data) {
      const key = `${row.Temperature}:${row.Pressure}`
      const existing = gridMap.get(key)
      if (existing === undefined || row.Yield > existing) {
        gridMap.set(key, row.Yield)
      }
    }

    const allYields = [...gridMap.values()]
    const minY = Math.min(...allYields)
    const maxY = Math.max(...allYields)

    const cells = pressSet.map((p) =>
      tempSet.map((t) => ({ t, p, y: gridMap.get(`${t}:${p}`) ?? null }))
    )

    return { cells, temps: tempSet, pressures: pressSet, minYield: minY, maxYield: maxY }
  }, [data])

  if (!temps.length || !pressures.length) return null

  const cellW = Math.max(28, Math.min(60, Math.floor(500 / temps.length)))
  const cellH = Math.max(24, Math.min(48, Math.floor(240 / pressures.length)))

  function yieldColor(y: number | null) {
    if (y === null) return 'oklch(0.17 0.02 240)'
    const t = (y - minYield) / Math.max(maxYield - minYield, 0.001)
    const l = 0.22 + t * 0.52
    const c = 0.04 + t * 0.18
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 200)`
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div className="relative inline-block ml-8">
          <svg
            width={temps.length * cellW + 60}
            height={pressures.length * cellH + 40}
            className="select-none"
          >
            {/* X-axis labels (Temperature) */}
            {temps.map((t, i) => (
              <text
                key={t}
                x={60 + i * cellW + cellW / 2}
                y={pressures.length * cellH + 14}
                fontSize={9}
                fill="oklch(0.58 0.04 230)"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {t}
              </text>
            ))}
            {/* X-axis label */}
            <text
              x={60 + (temps.length * cellW) / 2}
              y={pressures.length * cellH + 32}
              fontSize={10}
              fill="oklch(0.58 0.04 230)"
              textAnchor="middle"
            >
              Temperature (°C)
            </text>
            {/* Y-axis labels (Pressure) */}
            {pressures.map((p, j) => (
              <text
                key={p}
                x={54}
                y={j * cellH + cellH / 2}
                fontSize={9}
                fill="oklch(0.58 0.04 230)"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {p}
              </text>
            ))}
            {/* Cells */}
            {cells.map((row, j) =>
              row.map((cell, i) => (
                <g key={`${cell.t}-${cell.p}`}>
                  <rect
                    x={60 + i * cellW}
                    y={j * cellH}
                    width={cellW - 1}
                    height={cellH - 1}
                    rx={2}
                    fill={yieldColor(cell.y)}
                    stroke={
                      hovered?.t === cell.t && hovered?.p === cell.p
                        ? 'oklch(0.72 0.19 200)'
                        : 'oklch(0.13 0.022 250)'
                    }
                    strokeWidth={hovered?.t === cell.t && hovered?.p === cell.p ? 1.5 : 0.5}
                    onMouseEnter={() => cell.y !== null && setHovered({ t: cell.t, p: cell.p, y: cell.y! })}
                    onMouseLeave={() => setHovered(null)}
                    className="cursor-pointer"
                  />
                  {cellW >= 40 && cell.y !== null && (
                    <text
                      x={60 + i * cellW + cellW / 2}
                      y={j * cellH + cellH / 2}
                      fontSize={8}
                      fill="oklch(0.93 0.01 220)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      pointerEvents="none"
                    >
                      {cell.y.toFixed(1)}
                    </text>
                  )}
                </g>
              ))
            )}
          </svg>
        </div>
      </div>

      {/* Tooltip display */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-muted px-4 py-2 text-xs min-h-[36px]">
        {hovered ? (
          <>
            <span className="text-muted-foreground">Temp:</span>
            <span className="font-mono font-semibold text-foreground">{hovered.t}°C</span>
            <span className="text-muted-foreground">Pressure:</span>
            <span className="font-mono font-semibold text-foreground">{hovered.p} bar</span>
            <span className="text-muted-foreground">Yield:</span>
            <span className="font-mono font-semibold text-primary">{hovered.y.toFixed(2)}%</span>
          </>
        ) : (
          <span className="text-muted-foreground">Hover a cell to inspect Temperature, Pressure, and Yield values</span>
        )}
      </div>

      {/* Color scale legend */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground">Low Yield</span>
        <div
          className="h-3 flex-1 rounded-full"
          style={{ background: 'linear-gradient(to right, oklch(0.22 0.04 200), oklch(0.72 0.19 200))' }}
        />
        <span className="text-[10px] text-muted-foreground">High Yield</span>
      </div>
    </div>
  )
}

export function Charts({ data }: ChartsProps) {
  const byTemp = useMemo(() => sortedBy(data, 'Temperature'), [data])
  const byPressure = useMemo(() => sortedBy(data, 'Pressure'), [data])
  const byFeedRate = useMemo(() => sortedBy(data, 'Feed_Rate'), [data])

  if (!data.length) return null

  return (
    <section aria-label="Analytics Charts" id="charts-section">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Process Analytics
      </h2>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {/* Yield vs Temperature */}
        <ChartCard
          title="Yield vs Temperature"
          subtitle="Impact of temperature on product yield"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byTemp} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
              <XAxis dataKey="Temperature" {...axisStyle} label={{ value: '°C', position: 'insideRight', dx: 8, fill: 'oklch(0.58 0.04 230)', fontSize: 10 }} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Yield']} labelFormatter={(l) => `Temp: ${l}°C`} />
              <Line type="monotone" dataKey="Yield" stroke={COLORS.teal} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.teal }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Conversion vs Temperature */}
        <ChartCard
          title="Conversion vs Temperature"
          subtitle="Reactant conversion across temperature range"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byTemp} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
              <XAxis dataKey="Temperature" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Conversion']} labelFormatter={(l) => `Temp: ${l}°C`} />
              <Line type="monotone" dataKey="Conversion" stroke={COLORS.blue} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.blue }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Energy vs Temperature */}
        <ChartCard
          title="Energy vs Temperature"
          subtitle="Energy consumption across temperature range"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byTemp} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
              <XAxis dataKey="Temperature" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)} GJ/h`, 'Energy']} labelFormatter={(l) => `Temp: ${l}°C`} />
              <Line type="monotone" dataKey="Energy" stroke={COLORS.amber} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.amber }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Yield vs Pressure */}
        <ChartCard
          title="Yield vs Pressure"
          subtitle="Effect of operating pressure on yield"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byPressure} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
              <XAxis dataKey="Pressure" {...axisStyle} label={{ value: 'bar', position: 'insideRight', dx: 8, fill: 'oklch(0.58 0.04 230)', fontSize: 10 }} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Yield']} labelFormatter={(l) => `Pressure: ${l} bar`} />
              <Line type="monotone" dataKey="Yield" stroke={COLORS.green} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.green }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Conversion vs Pressure */}
        <ChartCard
          title="Conversion vs Pressure"
          subtitle="Reactant conversion at varying pressures"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byPressure} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
              <XAxis dataKey="Pressure" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Conversion']} labelFormatter={(l) => `Pressure: ${l} bar`} />
              <Line type="monotone" dataKey="Conversion" stroke={COLORS.red} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.red }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Feed Rate vs Yield */}
        <ChartCard
          title="Feed Rate vs Yield"
          subtitle="How feed rate influences product yield"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byFeedRate} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
              <XAxis dataKey="Feed_Rate" {...axisStyle} label={{ value: 'kmol/h', position: 'insideRight', dx: 14, fill: 'oklch(0.58 0.04 230)', fontSize: 10 }} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Yield']} labelFormatter={(l) => `Feed Rate: ${l} kmol/h`} />
              <Line type="monotone" dataKey="Yield" stroke={COLORS.blue} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.blue }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Energy vs Yield Scatter */}
        <ChartCard
          title="Energy vs Yield (Scatter)"
          subtitle="Energy consumption plotted against yield — identify efficient operating zones"
          className="md:col-span-2 xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 20, left: -15, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
              <XAxis
                dataKey="Yield"
                name="Yield"
                {...axisStyle}
                label={{ value: 'Yield (%)', position: 'insideBottom', dy: 18, fill: 'oklch(0.58 0.04 230)', fontSize: 10 }}
              />
              <YAxis
                dataKey="Energy"
                name="Energy"
                {...axisStyle}
                label={{ value: 'Energy (GJ/h)', angle: -90, position: 'insideLeft', dx: 12, fill: 'oklch(0.58 0.04 230)', fontSize: 10 }}
              />
              <ZAxis range={[30, 30]} />
              <Tooltip
                {...tooltipStyle}
                cursor={{ strokeDasharray: '3 3', stroke: 'oklch(0.58 0.04 230)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as AspenRow
                    return (
                      <div
                        style={{
                          background: 'oklch(0.17 0.02 240)',
                          border: '1px solid oklch(0.22 0.025 240)',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: 12,
                          color: 'oklch(0.93 0.01 220)',
                        }}
                      >
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.Run_ID}</p>
                        <p>Yield: <strong>{d.Yield.toFixed(2)}%</strong></p>
                        <p>Energy: <strong>{d.Energy.toFixed(2)} GJ/h</strong></p>
                        <p>Temp: <strong>{d.Temperature}°C</strong></p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Scatter data={data} fill={COLORS.teal} fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Heatmap */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 md:col-span-2 xl:col-span-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Temperature × Pressure → Yield Heatmap</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cell color represents yield intensity — hover a cell to inspect values
            </p>
          </div>
          <Heatmap data={data} />
        </div>
      </div>
    </section>
  )
}
