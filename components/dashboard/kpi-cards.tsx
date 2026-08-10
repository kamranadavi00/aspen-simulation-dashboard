'use client'

import { useMemo } from 'react'
import {
  Activity,
  Gauge,
  TrendingUp,
  Star,
  Target,
  Thermometer,
  Zap,
} from 'lucide-react'
import type { AspenRow, KPIData } from '@/lib/types'
import { cn, toFiniteNumber } from '@/lib/utils'
import { generateKPIs, type DatasetSchema } from '@/lib/analysis'

interface KPICardsProps {
  data: AspenRow[]
  schema: DatasetSchema
}

function computeKPIs(data: AspenRow[]): KPIData {
  if (!data.length) {
    return {
      maxYield: 0,
      maxConversion: 0,
      bestTemperature: 0,
      bestPressure: 0,
      minEnergy: 0,
      bestOperatingPoint: null,
    }
  }

  let maxYieldRow = data[0]
  let maxConvRow = data[0]
  let minEnergyRow = data[0]

  for (const row of data) {
    if ((toFiniteNumber(row.Yield) ?? Number.NEGATIVE_INFINITY) > (toFiniteNumber(maxYieldRow.Yield) ?? Number.NEGATIVE_INFINITY)) maxYieldRow = row
    if ((toFiniteNumber(row.Conversion) ?? Number.NEGATIVE_INFINITY) > (toFiniteNumber(maxConvRow.Conversion) ?? Number.NEGATIVE_INFINITY)) maxConvRow = row
    if ((toFiniteNumber(row.Energy) ?? Number.POSITIVE_INFINITY) < (toFiniteNumber(minEnergyRow.Energy) ?? Number.POSITIVE_INFINITY)) minEnergyRow = row
  }

  return {
    maxYield: toFiniteNumber(maxYieldRow.Yield) ?? 0,
    maxConversion: toFiniteNumber(maxConvRow.Conversion) ?? 0,
    bestTemperature: toFiniteNumber(maxYieldRow.Temperature) ?? 0,
    bestPressure: toFiniteNumber(maxYieldRow.Pressure) ?? 0,
    minEnergy: toFiniteNumber(minEnergyRow.Energy) ?? 0,
    bestOperatingPoint: maxYieldRow,
  }
}

interface KPICardProps {
  label: string
  value: string
  unit?: string
  sublabel?: string
  icon: React.ReactNode
  accent?: 'teal' | 'blue' | 'green' | 'amber' | 'red' | 'violet'
  wide?: boolean
}

const accentStyles: Record<string, string> = {
  teal: 'hover:border-accent/35',
  blue: 'hover:border-primary/40',
  green: 'hover:border-emerald-400/35',
  amber: 'hover:border-amber-400/35',
  red: 'hover:border-rose-400/35',
  violet: 'hover:border-violet-400/35',
}

const iconAccentStyles: Record<string, string> = {
  teal: 'text-accent bg-accent/10 border-accent/20',
  blue: 'text-primary bg-primary/10 border-primary/20',
  green: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  red: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
  violet: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
}

function KPICard({ label, value, unit, sublabel, icon, accent = 'teal', wide }: KPICardProps) {
  return (
    <div
      className={cn(
        'surface-panel group flex min-h-40 flex-col justify-between gap-5 rounded-2xl p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
        accentStyles[accent],
        wide && 'col-span-2'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[75%] text-xs font-semibold leading-5 text-muted-foreground">{label}</p>
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl border', iconAccentStyles[accent])}>
          {icon}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[1.75rem] font-bold tracking-[-0.035em] tabular-nums text-foreground">{value}</span>
          {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
        </div>
        {sublabel && <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  )
}

interface BestPointCardProps {
  point: AspenRow
}

function BestPointCard({ point }: BestPointCardProps) {
  const formatNumber = (value: unknown, digits: number) => toFiniteNumber(value)?.toFixed(digits) ?? '—'

  const fields: { label: string; value: string; unit: string }[] = [
    { label: 'Temperature', value: formatNumber(point.Temperature, 1), unit: '°C' },
    { label: 'Pressure', value: formatNumber(point.Pressure, 2), unit: 'bar' },
    { label: 'Feed Rate', value: formatNumber(point.Feed_Rate, 2), unit: 'kmol/h' },
    { label: 'Yield', value: formatNumber(point.Yield, 2), unit: '%' },
    { label: 'Conversion', value: formatNumber(point.Conversion, 2), unit: '%' },
    { label: 'Energy', value: formatNumber(point.Energy, 2), unit: 'GJ/h' },
  ]

  return (
    <div className="surface-panel col-span-2 grid gap-6 rounded-2xl border-amber-400/20 p-5 sm:p-6 md:col-span-3 xl:col-span-5 xl:grid-cols-[260px_1fr] xl:items-center">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <Star className="size-4 fill-current" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Best operating point</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Highest observed yield</p>
          </div>
        </div>
        <span className="mt-4 inline-flex rounded-lg border border-amber-400/25 bg-amber-400/8 px-2.5 py-1 font-mono text-xs font-semibold text-amber-300">
          {point.Run_ID}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {fields.map((f) => (
          <div key={f.label} className="rounded-xl border border-border/80 bg-background/45 p-3">
            <p className="text-[10px] font-medium text-muted-foreground">{f.label}</p>
            <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-foreground">
              {f.value} <span className="text-[10px] font-normal text-muted-foreground">{f.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KPICards({ data, schema }: KPICardsProps) {
  const kpis = useMemo(() => computeKPIs(data), [data])
  const dynamicKpis = useMemo(() => generateKPIs(data, schema), [data, schema])

  if (!data.length) return null

  const kpiCards = [...dynamicKpis].slice(0, 5)
  const iconForKpi = (label: string) => {
    if (/energy/i.test(label)) return <Zap className="size-4" />
    if (/temperature/i.test(label)) return <Thermometer className="size-4" />
    if (/pressure/i.test(label)) return <Gauge className="size-4" />
    if (/conversion|yield|efficiency/i.test(label)) return <Target className="size-4" />
    if (/average/i.test(label)) return <Activity className="size-4" />
    return <TrendingUp className="size-4" />
  }

  return (
    <section aria-label="Key Performance Indicators">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Performance overview</p>
        <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Key process indicators</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">The most decision-useful values detected in the current simulation set.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpiCards.map((kpi, index) => (
          <KPICard
            key={`${kpi.name}-${index}`}
            label={kpi.label}
            value={typeof kpi.value === 'number' ? kpi.value.toFixed(2) : String(kpi.value)}
            unit={kpi.unit}
            sublabel={kpi.description}
            icon={iconForKpi(kpi.label)}
            accent={index % 5 === 0 ? 'teal' : index % 5 === 1 ? 'blue' : index % 5 === 2 ? 'red' : index % 5 === 3 ? 'green' : 'violet'}
          />
        ))}
        {kpis.bestOperatingPoint && (
          <BestPointCard point={kpis.bestOperatingPoint} />
        )}
      </div>
    </section>
  )
}
