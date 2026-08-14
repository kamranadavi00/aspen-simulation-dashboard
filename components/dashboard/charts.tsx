'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChartSpline, Plus, SlidersHorizontal, X } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { Button } from '@/components/ui/button'
import { cn, toFiniteNumber } from '@/lib/utils'
import { generateChartRecommendations, type DatasetSchema } from '@/lib/analysis'

// Chart color palette (matches design tokens)
const COLORS = {
  teal: 'oklch(0.72 0.14 190)',
  blue: 'oklch(0.72 0.16 238)',
  green: 'oklch(0.77 0.16 145)',
  amber: 'oklch(0.79 0.16 78)',
  red: 'oklch(0.69 0.19 25)',
}

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <div className={cn('surface-panel flex flex-col gap-5 rounded-2xl p-5 sm:p-6', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <ChartSpline className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="h-72 min-h-72">{children}</div>
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    background: 'oklch(0.175 0.03 258)',
    border: '1px solid oklch(0.30 0.04 252)',
    borderRadius: '12px',
    color: 'oklch(0.965 0.008 245)',
    fontSize: '12px',
    boxShadow: '0 16px 40px rgba(0,0,0,.28)',
  },
  labelStyle: { color: 'oklch(0.72 0.03 245)', marginBottom: 6 },
  itemStyle: { color: 'oklch(0.965 0.008 245)' },
}

const axisStyle = {
  tick: { fill: 'oklch(0.69 0.028 248)', fontSize: 11 },
  line: false as false,
  tickLine: false as false,
}

interface ChartsProps {
  data: AspenRow[]
  schema: DatasetSchema
}

// Heatmap component
interface HeatmapProps {
  data: AspenRow[]
}

export type ChartType = 'line' | 'bar' | 'scatter' | 'area'

interface BuilderChartConfig {
  id: string
  x: string
  y: string
  type: ChartType
}

interface DatasetChartProps {
  data: AspenRow[]
  x: string
  y: string
  type: ChartType
  className?: string
}

export function DatasetChart({ data, x, y, type, className }: DatasetChartProps) {
  const chartRows = useMemo(() => data.map((row) => ({ x: row[x], y: row[y] })), [data, x, y])

  const chart = type === 'line' ? (
    <LineChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(0.255 0.03 255)" />
      <XAxis dataKey="x" name={x} {...axisStyle} />
      <YAxis dataKey="y" name={y} {...axisStyle} />
      <Tooltip {...tooltipStyle} />
      <Line type="monotone" dataKey="y" name={y} stroke={COLORS.teal} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.teal }} />
    </LineChart>
  ) : type === 'bar' ? (
    <BarChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(0.255 0.03 255)" />
      <XAxis dataKey="x" name={x} {...axisStyle} />
      <YAxis dataKey="y" name={y} {...axisStyle} />
      <Tooltip {...tooltipStyle} />
      <Bar dataKey="y" name={y} fill={COLORS.green} radius={[4, 4, 0, 0]} />
    </BarChart>
  ) : type === 'area' ? (
    <AreaChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(0.255 0.03 255)" />
      <XAxis dataKey="x" name={x} {...axisStyle} />
      <YAxis dataKey="y" name={y} {...axisStyle} />
      <Tooltip {...tooltipStyle} />
      <Area type="monotone" dataKey="y" name={y} stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.14} strokeWidth={2} />
    </AreaChart>
  ) : (
    <ScatterChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.255 0.03 255)" />
      <XAxis dataKey="x" name={x} {...axisStyle} />
      <YAxis dataKey="y" name={y} {...axisStyle} />
      <ZAxis range={[40, 40]} />
      <Tooltip {...tooltipStyle} />
      <Scatter data={chartRows} name={`${y} by ${x}`} fill={COLORS.teal} />
    </ScatterChart>
  )

  return (
    <div className={cn('h-full min-h-0 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  )
}

function Heatmap({ data }: HeatmapProps) {
  const [hovered, setHovered] = useState<{ t: number; p: number; y: number } | null>(null)

  const { cells, temps, pressures, minYield, maxYield } = useMemo(() => {
    const points: Array<{ temperature: number; pressure: number; yieldValue: number }> = []

    for (const row of data) {
      const temperature = toFiniteNumber(row.Temperature)
      const pressure = toFiniteNumber(row.Pressure)
      const yieldValue = toFiniteNumber(row.Yield)

      if (temperature !== null && pressure !== null && yieldValue !== null) {
        points.push({ temperature, pressure, yieldValue })
      }
    }

    const tempSet = [...new Set(points.map((point) => point.temperature))].sort((a, b) => a - b)
    const pressSet = [...new Set(points.map((point) => point.pressure))].sort((a, b) => a - b)

    const gridMap = new Map<string, number>()
    for (const point of points) {
      const key = `${point.temperature}:${point.pressure}`
      const existing = gridMap.get(key)
      if (existing === undefined || point.yieldValue > existing) {
        gridMap.set(key, point.yieldValue)
      }
    }

    const allYields = [...gridMap.values()]
    const minY = allYields.length ? Math.min(...allYields) : 0
    const maxY = allYields.length ? Math.max(...allYields) : 0

    const cells = pressSet.map((p) =>
      tempSet.map((t) => ({ t, p, y: gridMap.get(`${t}:${p}`) ?? null }))
    )

    return { cells, temps: tempSet, pressures: pressSet, minYield: minY, maxYield: maxY }
  }, [data])

  if (!temps.length || !pressures.length) return null

  const cellW = Math.max(28, Math.min(60, Math.floor(500 / temps.length)))
  const cellH = Math.max(24, Math.min(48, Math.floor(240 / pressures.length)))

  function yieldColor(y: number | null) {
    if (y === null) return 'oklch(0.19 0.025 258)'
    const t = (y - minYield) / Math.max(maxYield - minYield, 0.001)
    const l = 0.22 + t * 0.52
    const c = 0.04 + t * 0.18
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 205)`
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div className="relative ml-2 inline-block sm:ml-8">
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
                fill="oklch(0.69 0.028 248)"
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
              fill="oklch(0.69 0.028 248)"
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
                fill="oklch(0.69 0.028 248)"
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
                        ? 'oklch(0.86 0.12 205)'
                        : 'oklch(0.14 0.026 258)'
                    }
                    strokeWidth={hovered?.t === cell.t && hovered?.p === cell.p ? 2 : 0.5}
                    tabIndex={cell.y === null ? -1 : 0}
                    role="img"
                    aria-label={cell.y === null ? `No yield value at ${cell.t} degrees and ${cell.p} bar` : `Yield ${cell.y.toFixed(2)} percent at ${cell.t} degrees and ${cell.p} bar`}
                    onMouseEnter={() => cell.y !== null && setHovered({ t: cell.t, p: cell.p, y: cell.y })}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => cell.y !== null && setHovered({ t: cell.t, p: cell.p, y: cell.y })}
                    onBlur={() => setHovered(null)}
                    className="cursor-pointer outline-none"
                  />
                  {cellW >= 40 && cell.y !== null && (
                    <text
                      x={60 + i * cellW + cellW / 2}
                      y={j * cellH + cellH / 2}
                      fontSize={8}
                      fill="oklch(0.965 0.008 245)"
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
      <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/80 bg-background/45 px-4 py-2 text-xs">
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
          <span className="text-muted-foreground">Hover or focus a cell to inspect its operating values</span>
        )}
      </div>

      {/* Color scale legend */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground">Low Yield</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{ background: 'linear-gradient(to right, oklch(0.22 0.04 205), oklch(0.74 0.18 205))' }}
        />
        <span className="text-[10px] text-muted-foreground">High Yield</span>
      </div>
    </div>
  )
}

export function Charts({ data, schema }: ChartsProps) {
  const numericColumns = schema?.numericColumns ?? []
  const firstNumeric = numericColumns[0]

  const [chartConfigs, setChartConfigs] = useState<BuilderChartConfig[]>([])
  const [builderX, setBuilderX] = useState<string>('')
  const [builderY, setBuilderY] = useState<string>('')
  const [builderType, setBuilderType] = useState<ChartType>('line')

  useEffect(() => {
    if (!data.length) return

    const recommendations = generateChartRecommendations(data, schema.columns)
    const initial: BuilderChartConfig[] = recommendations.length
      ? recommendations.map((c, index) => ({
          id: `${c.title}-${index}-${crypto.randomUUID()}`,
          x: c.x,
          y: c.y,
          type: c.type,
        }))
      : [{ id: 'chart-1', x: firstNumeric ?? schema.chartAxisColumns[0] ?? '', y: numericColumns[1] ?? numericColumns[0] ?? '', type: 'line' }]

    setChartConfigs(initial)
    setBuilderX(initial[0]?.x ?? '')
    setBuilderY(initial[0]?.y ?? '')
    setBuilderType(initial[0]?.type ?? 'line')
  }, [data, schema, firstNumeric])

  if (!data.length) return null

  const axisOptions = schema.chartAxisColumns
  const yOptions = schema.numericColumns

  const addChart = () => {
    const useX = builderX || axisOptions[0] || ''
    const useY = builderY || yOptions[0] || ''

    if (!useX || !useY) return

    setChartConfigs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        x: useX,
        y: useY,
        type: builderType,
      },
    ])
  }

  const removeChart = (id: string) => {
    setChartConfigs((current) => current.filter((config) => config.id !== id))
  }

  return (
    <section aria-label="Analytics Charts" id="charts-section" className="scroll-mt-28">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Explore relationships</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Process analytics</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Compare operating inputs and outcomes across the current simulation set.</p>
        </div>
        <span className="w-fit rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {chartConfigs.length} chart{chartConfigs.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="surface-panel mb-4 rounded-2xl p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" /> Chart builder
          <span className="ml-1 text-xs font-normal text-muted-foreground">Create a focused comparison</span>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.75fr_auto]">
          <label className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
            Horizontal axis
            <select className="field-select w-full" value={builderX} onChange={(e) => setBuilderX(e.target.value)}>
              {axisOptions.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
            Vertical axis
            <select className="field-select w-full" value={builderY} onChange={(e) => setBuilderY(e.target.value)}>
              {yOptions.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
            Chart type
            <select className="field-select w-full" value={builderType} onChange={(e) => setBuilderType(e.target.value as ChartType)}>
              <option value="line">Line chart</option>
              <option value="bar">Bar chart</option>
              <option value="scatter">Scatter plot</option>
              <option value="area">Area chart</option>
            </select>
          </label>
          <Button onClick={addChart} className="w-full gap-2 lg:w-auto"><Plus className="size-4" /> Add chart</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {chartConfigs.map((config) => {
          return (
            <ChartCard key={config.id} title={`${config.y} by ${config.x}`} subtitle={`${config.type.charAt(0).toUpperCase()}${config.type.slice(1)} view · ${data.length.toLocaleString()} runs`}>
              <div className="relative h-full">
                <button type="button" aria-label={`Remove ${config.x} versus ${config.y} chart`} title="Remove chart" className="absolute right-0 top-0 z-10 flex size-8 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => removeChart(config.id)}><X className="size-3.5" /></button>
                <DatasetChart data={data} x={config.x} y={config.y} type={config.type} />
              </div>
            </ChartCard>
          )
        })}

        {/* Heatmap */}
        <div className="surface-panel flex flex-col gap-5 rounded-2xl p-5 sm:p-6 xl:col-span-2">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Yield operating envelope</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Temperature × pressure, with color encoding the highest observed yield
            </p>
            </div>
          </div>
          <Heatmap data={data} />
        </div>
      </div>
    </section>
  )
}
