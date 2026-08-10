'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import { generateChartRecommendations, type DatasetSchema } from '@/lib/analysis'

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
  schema: DatasetSchema
}

// Sort data by a key for better line charts
function sortedBy(data: AspenRow[], key: keyof AspenRow) {
  return [...data].sort((a, b) => (a[key] as number) - (b[key] as number))
}

// Heatmap component
interface HeatmapProps {
  data: AspenRow[]
}

type ChartType = 'line' | 'bar' | 'scatter' | 'area'

interface BuilderChartConfig {
  id: string
  x: string
  y: string
  type: ChartType
}

function numericValueFromCell(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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

export function Charts({ data, schema }: ChartsProps) {
  const numericColumns = schema?.numericColumns ?? []
  const firstNumeric = numericColumns[0]
  const secondNumeric = numericColumns[1]
  const byTemp = useMemo(() => sortedBy(data, firstNumeric || 'Temperature' as keyof AspenRow), [data, firstNumeric])
  const byPressure = useMemo(() => sortedBy(data, secondNumeric || 'Pressure' as keyof AspenRow), [data, secondNumeric])
  const byFeedRate = useMemo(() => sortedBy(data, firstNumeric || 'Yield' as keyof AspenRow), [data, firstNumeric])

  const [chartConfigs, setChartConfigs] = useState<BuilderChartConfig[]>([])
  const [builderX, setBuilderX] = useState<string>('')
  const [builderY, setBuilderY] = useState<string>('')
  const [builderType, setBuilderType] = useState<ChartType>('line')

  useEffect(() => {
    if (!data.length) return

    const recommendations = generateChartRecommendations(data, schema.columns)
    const initial = recommendations.length
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
    <section aria-label="Analytics Charts" id="charts-section">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Process Analytics
        </h2>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">
          {chartConfigs.length} chart{chartConfigs.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            X-axis
            <select className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground" value={builderX} onChange={(e) => setBuilderX(e.target.value)}>
              {axisOptions.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Y-axis
            <select className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground" value={builderY} onChange={(e) => setBuilderY(e.target.value)}>
              {yOptions.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Chart type
            <select className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground" value={builderType} onChange={(e) => setBuilderType(e.target.value as ChartType)}>
              <option value="line">Line chart</option>
              <option value="bar">Bar chart</option>
              <option value="scatter">Scatter plot</option>
              <option value="area">Area chart</option>
            </select>
          </label>
          <button className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20" onClick={addChart}>
            Add chart
          </button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {chartConfigs.map((config) => {
          const configRows = data.map((row) => ({
            x: row[config.x],
            y: row[config.y],
          }))

          const renderChart = () => {
            if (config.type === 'line') {
              return (
                <LineChart data={configRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
                  <XAxis dataKey="x" {...axisStyle} />
                  <YAxis {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="y" stroke={COLORS.teal} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: COLORS.teal }} />
                </LineChart>
              )
            }

            if (config.type === 'bar') {
              return (
                <BarChart data={configRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
                  <XAxis dataKey="x" {...axisStyle} />
                  <YAxis {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="y" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              )
            }

            if (config.type === 'area') {
              return (
                <AreaChart data={configRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
                  <XAxis dataKey="x" {...axisStyle} />
                  <YAxis {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="y" stroke={COLORS.blue} fill={COLORS.blue} strokeWidth={2} />
                </AreaChart>
              )
            }

            return (
              <ScatterChart data={configRows} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 240)" />
                <XAxis dataKey="x" name={config.x} {...axisStyle} />
                <YAxis dataKey="y" name={config.y} {...axisStyle} />
                <ZAxis range={[40, 40]} />
                <Tooltip {...tooltipStyle} />
                <Scatter data={configRows} fill={COLORS.teal} />
              </ScatterChart>
            )
          }

          return (
            <ChartCard key={config.id} title={`${config.x} vs ${config.y}`} subtitle={`${config.type.toUpperCase()} chart`}>
              <div className="relative h-full">
                <div className="absolute right-0 top-0 z-10">
                  <button className="rounded-md border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => removeChart(config.id)}>Remove</button>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart()}
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )
        })}

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
