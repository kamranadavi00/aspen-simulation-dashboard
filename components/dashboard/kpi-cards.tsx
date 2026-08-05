'use client'

import { useMemo } from 'react'
import {
  TrendingUp,
  Zap,
  Thermometer,
  Gauge,
  FlaskConical,
  Star,
} from 'lucide-react'
import type { AspenRow, KPIData } from '@/lib/types'
import { cn } from '@/lib/utils'

interface KPICardsProps {
  data: AspenRow[]
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
    if (row.Yield > maxYieldRow.Yield) maxYieldRow = row
    if (row.Conversion > maxConvRow.Conversion) maxConvRow = row
    if (row.Energy < minEnergyRow.Energy) minEnergyRow = row
  }

  return {
    maxYield: maxYieldRow.Yield,
    maxConversion: maxConvRow.Conversion,
    bestTemperature: maxYieldRow.Temperature,
    bestPressure: maxYieldRow.Pressure,
    minEnergy: minEnergyRow.Energy,
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
  teal: 'border-[oklch(0.72_0.19_200)/30] bg-[oklch(0.72_0.19_200)/8]',
  blue: 'border-[oklch(0.65_0.2_220)/30] bg-[oklch(0.65_0.2_220)/8]',
  green: 'border-[oklch(0.78_0.16_140)/30] bg-[oklch(0.78_0.16_140)/8]',
  amber: 'border-[oklch(0.75_0.18_60)/30] bg-[oklch(0.75_0.18_60)/8]',
  red: 'border-[oklch(0.65_0.22_25)/30] bg-[oklch(0.65_0.22_25)/8]',
  violet: 'border-[oklch(0.70_0.18_290)/30] bg-[oklch(0.70_0.18_290)/8]',
}

const iconAccentStyles: Record<string, string> = {
  teal: 'text-[oklch(0.72_0.19_200)] bg-[oklch(0.72_0.19_200)/15]',
  blue: 'text-[oklch(0.65_0.2_220)] bg-[oklch(0.65_0.2_220)/15]',
  green: 'text-[oklch(0.78_0.16_140)] bg-[oklch(0.78_0.16_140)/15]',
  amber: 'text-[oklch(0.75_0.18_60)] bg-[oklch(0.75_0.18_60)/15]',
  red: 'text-[oklch(0.65_0.22_25)] bg-[oklch(0.65_0.22_25)/15]',
  violet: 'text-[oklch(0.70_0.18_290)] bg-[oklch(0.70_0.18_290)/15]',
}

function KPICard({ label, value, unit, sublabel, icon, accent = 'teal', wide }: KPICardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-5 transition-all duration-200 hover:brightness-110',
        accentStyles[accent],
        wide && 'col-span-2'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', iconAccentStyles[accent])}>
          {icon}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
          {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
        </div>
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  )
}

interface BestPointCardProps {
  point: AspenRow
}

function BestPointCard({ point }: BestPointCardProps) {
  const fields: { label: string; value: string; unit: string }[] = [
    { label: 'Temperature', value: point.Temperature.toFixed(1), unit: '°C' },
    { label: 'Pressure', value: point.Pressure.toFixed(2), unit: 'bar' },
    { label: 'Feed Rate', value: point.Feed_Rate.toFixed(2), unit: 'kmol/h' },
    { label: 'Yield', value: point.Yield.toFixed(2), unit: '%' },
    { label: 'Conversion', value: point.Conversion.toFixed(2), unit: '%' },
    { label: 'Energy', value: point.Energy.toFixed(2), unit: 'GJ/h' },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[oklch(0.75_0.18_60)/30] bg-[oklch(0.75_0.18_60)/6] p-5 col-span-2 md:col-span-3 lg:col-span-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Best Operating Point</p>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.75_0.18_60)/15] text-[oklch(0.75_0.18_60)]">
          <Star className="size-4" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-[oklch(0.75_0.18_60)/40] bg-[oklch(0.75_0.18_60)/20] px-2 py-0.5 font-mono text-xs text-[oklch(0.75_0.18_60)]">
          {point.Run_ID}
        </span>
        <span className="text-sm text-muted-foreground">Highest Yield Run</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {f.value} <span className="text-xs font-normal text-muted-foreground">{f.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KPICards({ data }: KPICardsProps) {
  const kpis = useMemo(() => computeKPIs(data), [data])

  if (!data.length) return null

  return (
    <section aria-label="Key Performance Indicators">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Key Performance Indicators
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KPICard
          label="Max Yield"
          value={kpis.maxYield.toFixed(2)}
          unit="%"
          sublabel="Highest yield across all runs"
          icon={<TrendingUp className="size-4" />}
          accent="teal"
        />
        <KPICard
          label="Max Conversion"
          value={kpis.maxConversion.toFixed(2)}
          unit="%"
          sublabel="Peak reactant conversion"
          icon={<FlaskConical className="size-4" />}
          accent="blue"
        />
        <KPICard
          label="Best Temperature"
          value={kpis.bestTemperature.toFixed(1)}
          unit="°C"
          sublabel="Temperature at max yield"
          icon={<Thermometer className="size-4" />}
          accent="red"
        />
        <KPICard
          label="Best Pressure"
          value={kpis.bestPressure.toFixed(2)}
          unit="bar"
          sublabel="Pressure at max yield"
          icon={<Gauge className="size-4" />}
          accent="violet"
        />
        <KPICard
          label="Min Energy"
          value={kpis.minEnergy.toFixed(2)}
          unit="GJ/h"
          sublabel="Lowest energy consumption"
          icon={<Zap className="size-4" />}
          accent="green"
        />
        {kpis.bestOperatingPoint && (
          <BestPointCard point={kpis.bestOperatingPoint} />
        )}
      </div>
    </section>
  )
}
