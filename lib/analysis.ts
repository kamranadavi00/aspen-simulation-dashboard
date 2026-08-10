import type { AspenRow } from '@/lib/types'
import { toFiniteNumber } from '@/lib/utils'

export type ColumnKind = 'numeric' | 'categorical' | 'date' | 'boolean' | 'mixed' | 'unknown'

export interface ColumnStats {
  min?: number
  max?: number
  mean?: number
  median?: number
  stdDev?: number
  range?: number
  uniqueCount?: number
  sampleValues?: Array<string | number | boolean | null>
}

export interface ColumnSchema {
  name: string
  kind: ColumnKind
  confidence: number
  stats?: ColumnStats
  isIdColumn?: boolean
  isChartAxis?: boolean
  isKpiCandidate?: boolean
}

export interface ChartRecommendation {
  title: string
  x: string
  y: string
  type: 'line' | 'bar' | 'scatter' | 'area'
}

export interface DatasetSchema {
  columns: ColumnSchema[]
  numericColumns: string[]
  categoricalColumns: string[]
  dateColumns: string[]
  booleanColumns: string[]
  chartAxisColumns: string[]
  kpiColumns: string[]
  idColumns: string[]
  chartRecommendations: ChartRecommendation[]
}

export interface KPIValue {
  name: string
  label: string
  value: number | string
  unit?: string
  description?: string
}

export interface QueryResult {
  kind: 'summary' | 'row' | 'table' | 'stats' | 'comparison'
  title: string
  description: string
  rows?: AspenRow[]
  numericSummary?: Record<string, number>
  message?: string
}

function normalizeColumnName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function isLikelyDate(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const cleaned = value.trim()
  if (!cleaned) return false
  const when = new Date(cleaned)
  return !Number.isNaN(when.getTime()) && Number.isFinite(when.getTime())
}

function isLikelyBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['true', 'false', 'yes', 'no', 'y', 'n', '1', '0'].includes(normalized)
  }
  return false
}

function percent(value: number) {
  return Number.isFinite(value) ? value : 0
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[midpoint]
  return (sorted[midpoint - 1] + sorted[midpoint]) / 2
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function analyzeNumericColumn(rows: AspenRow[], column: string): ColumnStats {
  const values = rows.map((row) => toFiniteNumber(row[column])).filter((value): value is number => typeof value === 'number')

  if (!values.length) {
    return {}
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length

  return {
    min,
    max,
    mean,
    median: median(values),
    stdDev: standardDeviation(values),
    range: max - min,
    uniqueCount: new Set(values).size,
  }
}

export function inferDatasetSchema(rows: AspenRow[]): DatasetSchema {
  if (!rows.length) {
    return {
      columns: [],
      numericColumns: [],
      categoricalColumns: [],
      dateColumns: [],
      booleanColumns: [],
      chartAxisColumns: [],
      kpiColumns: [],
      idColumns: [],
      chartRecommendations: [],
    }
  }

  const first = rows[0]
  const keys = Object.keys(first)

  const columns: ColumnSchema[] = keys.map((key) => {
    const samples = rows.map((row) => row[key]).filter((value) => value !== null && typeof value !== 'undefined' && String(value).trim() !== '')
    const nonEmptyValues = samples.map((value) => String(value).trim())

    const numericSamples = samples.map((value) => toFiniteNumber(value)).filter((value): value is number => value !== null)

    const boolSamples = samples.filter(isLikelyBoolean)
    const dateSamples = samples.filter(isLikelyDate)

    const normalized = normalizeColumnName(key)
    const isIdColumn = /(^|_)(run|id|index|point|record|sample|row|batch|case)(_|$)/.test(normalized) || key.toLowerCase().includes('run')

    let kind: ColumnKind = 'unknown'
    let confidence = 0

    if (numericSamples.length > 0 && numericSamples.length >= Math.max(1, Math.round(samples.length * 0.75))) {
      kind = 'numeric'
      confidence = 0.94
    } else if (boolSamples.length > 0 && boolSamples.length >= Math.max(1, Math.round(samples.length * 0.75))) {
      kind = 'boolean'
      confidence = 0.9
    } else if (dateSamples.length > 0 && dateSamples.length >= Math.max(1, Math.round(samples.length * 0.6))) {
      kind = 'date'
      confidence = 0.86
    } else if (nonEmptyValues.length) {
      const uniqueValues = new Set(nonEmptyValues).size
      const distinctRatio = uniqueValues / Math.max(nonEmptyValues.length, 1)
      kind = distinctRatio < 0.2 ? 'categorical' : 'categorical'
      confidence = 0.75
    }

    const stats = kind === 'numeric' ? analyzeNumericColumn(rows, key) : undefined

    return {
      name: key,
      kind,
      confidence,
      stats,
      isIdColumn,
      isChartAxis: kind === 'numeric' || kind === 'date' || kind === 'categorical',
      isKpiCandidate: kind === 'numeric' || kind === 'categorical',
    }
  })

  const numericColumns = columns.filter((c) => c.kind === 'numeric').map((c) => c.name)
  const categoricalColumns = columns.filter((c) => c.kind === 'categorical').map((c) => c.name)
  const dateColumns = columns.filter((c) => c.kind === 'date').map((c) => c.name)
  const booleanColumns = columns.filter((c) => c.kind === 'boolean').map((c) => c.name)
  const chartAxisColumns = columns.filter((c) => c.isChartAxis).map((c) => c.name)
  const kpiColumns = columns.filter((c) => c.isKpiCandidate).map((c) => c.name)
  const idColumns = columns.filter((c) => c.isIdColumn).map((c) => c.name)

  const chartRecommendations = generateChartRecommendations(rows, columns)

  return {
    columns,
    numericColumns,
    categoricalColumns,
    dateColumns,
    booleanColumns,
    chartAxisColumns,
    kpiColumns,
    idColumns,
    chartRecommendations,
  }
}

export function generateChartRecommendations(rows: AspenRow[], columns: ColumnSchema[]): ChartRecommendation[] {
  if (!rows.length) return []

  const numeric = columns.filter((c) => c.kind === 'numeric').map((c) => c.name)
  const date = columns.filter((c) => c.kind === 'date').map((c) => c.name)
  const categorical = columns.filter((c) => c.kind === 'categorical').map((c) => c.name)

  const recommendations: ChartRecommendation[] = []

  const xCandidates = [...numeric, ...date, ...categorical]
  const yCandidates = numeric

  const pickX = (fallback: string) => xCandidates.find((item) => item === 'Temperature') || xCandidates.find((item) => item === 'Pressure') || xCandidates.find((item) => item === 'Time') || xCandidates.find((item) => item === 'Run_ID') || xCandidates[0] || fallback
  const pickY = (fallback: string) => yCandidates.find((item) => /yield|conversion|eff|rate|energy|flow|quality/i.test(item)) || yCandidates.find((item) => /yield|conversion|eff|rate|energy/i.test(item)) || yCandidates[0] || fallback

  const x = pickX('Temperature')
  const y = pickY('Yield')

  if (x && y) {
    recommendations.push({ title: `${x} vs ${y}`, x, y, type: 'scatter' })

    const areaY = yCandidates.find((item) => item.toLowerCase().includes('yield')) || y
    if (areaY && x) {
      recommendations.push({ title: `${areaY} trend`, x, y: areaY, type: 'line' })
    }

    if (numeric.length > 1) {
      recommendations.push({ title: `${numeric[0]} vs ${y}`, x: numeric[0], y, type: 'bar' })
    }
  }

  return recommendations.slice(0, 6)
}

export function generateKPIs(rows: AspenRow[], schema: DatasetSchema): KPIValue[] {
  const kpis: KPIValue[] = []

  if (!rows.length) return kpis

  const numeric = schema.numericColumns

  for (const column of numeric) {
    const values = rows.map((row) => toFiniteNumber(row[column])).filter((value): value is number => value !== null)
    if (!values.length) continue

    const stats = analyzeNumericColumn(rows, column)
    const mean = stats.mean ?? values.reduce((sum, n) => sum + n, 0) / values.length
    const max = stats.max ?? Math.max(...values)
    const min = stats.min ?? Math.min(...values)

    const normalized = normalizeColumnName(column)

    if (/yield|conversion|efficiency|recovery|selectivity|rate|product/i.test(normalized)) {
      const descriptor = normalized.includes('yield') ? 'Yield' : normalized.includes('conversion') ? 'Conversion' : normalized.includes('eff') ? 'Efficiency' : 'Metric'
      kpis.push({
        name: column,
        label: `Max ${descriptor}`,
        value: max,
        unit: column.toLowerCase().includes('rate') ? '' : '%',
        description: `Highest ${column} across the dataset`,
      })
    }

    const semantic = normalized
    if (semantic.includes('energy')) {
      kpis.push({ name: column, label: 'Minimum Energy', value: min, unit: 'GJ/h', description: 'Lowest energy draw' })
    }

    if (semantic.includes('temperature')) {
      const bestRow = rows.reduce((best, row) => {
        const rowYield = toFiniteNumber(row.Yield) ?? Number.NEGATIVE_INFINITY
        const bestYield = toFiniteNumber(best.Yield) ?? Number.NEGATIVE_INFINITY
        return rowYield > bestYield ? row : best
      }, rows[0])

      kpis.push({ name: column, label: 'Best Temperature', value: toFiniteNumber(bestRow[column]) ?? mean, unit: '°C', description: 'Temperature associated with the best observed operating point' })
    }
  }

  const valueColumns = schema.numericColumns
  if (valueColumns.length > 0) {
    const first = valueColumns[0]
    const stats = analyzeNumericColumn(rows, first)
    if (stats.mean !== undefined) {
      kpis.push({ name: first, label: `${first} Average`, value: stats.mean, unit: '', description: `Average ${first}` })
    }
  }

  return kpis.slice(0, 10)
}

export function executeDataQuery(rows: AspenRow[], schema: DatasetSchema, question: string): QueryResult {
  const normalized = question.toLowerCase()

  if (normalized.includes('summary') || normalized.includes('summarize')) {
    return {
      kind: 'summary',
      title: 'Dataset summary',
      description: 'Loaded dataset summary computed from the uploaded CSV.',
      numericSummary: {
        rows: rows.length,
        numericColumns: schema.numericColumns.length,
        categoricalColumns: schema.categoricalColumns.length,
      } as unknown as Record<string, number>,
    }
  }

  if (normalized.includes('max') || normalized.includes('maximum') || normalized.includes('highest')) {
    const numericColumn = schema.numericColumns.find((c) => normalized.includes(c.toLowerCase().replace(/[^a-z0-9]+/g, '')))
    const target = numericColumn ?? schema.numericColumns[0]

    if (!target) {
      return { kind: 'stats', title: 'No numeric question target', description: 'No numeric columns are available for this question.', message: 'The uploaded dataset does not expose a numeric target column for this analysis.' }
    }

    const values = rows.map((row) => toFiniteNumber(row[target])).filter((value): value is number => value !== null)
    const max = Math.max(...values)
    const matchingRows = rows.filter((row) => toFiniteNumber(row[target]) === max)

    return {
      kind: 'row',
      title: `Maximum ${target}`,
      description: `Maximum ${target} computed from the loaded dataset`,
      rows: matchingRows,
      numericSummary: { value: max } as Record<string, number>,
    }
  }

  if (normalized.includes('min') || normalized.includes('minimum') || normalized.includes('lowest')) {
    const numericColumn = schema.numericColumns.find((c) => normalized.includes(c.toLowerCase().replace(/[^a-z0-9]+/g, '')))
    const target = numericColumn ?? schema.numericColumns[0]

    if (!target) {
      return { kind: 'stats', title: 'No numeric question target', description: 'No numeric columns are available for this question.', message: 'The uploaded dataset does not expose a numeric target column for this analysis.' }
    }

    const values = rows.map((row) => toFiniteNumber(row[target])).filter((value): value is number => value !== null)
    const min = Math.min(...values)
    const matchingRows = rows.filter((row) => toFiniteNumber(row[target]) === min)

    return {
      kind: 'row',
      title: `Minimum ${target}`,
      description: `Minimum ${target} computed from the loaded dataset`,
      rows: matchingRows,
      numericSummary: { value: min } as Record<string, number>,
    }
  }

  if (normalized.includes('average') || normalized.includes('avg') || normalized.includes('mean')) {
    const numericColumn = schema.numericColumns.find((c) => normalized.includes(c.toLowerCase().replace(/[^a-z0-9]+/g, '')))
    const target = numericColumn ?? schema.numericColumns[0]

    if (!target) {
      return { kind: 'stats', title: 'No numeric question target', description: 'No numeric columns are available for this question.', message: 'The uploaded dataset does not expose a numeric target column for this analysis.' }
    }

    const values = rows.map((row) => toFiniteNumber(row[target])).filter((value): value is number => value !== null)
    const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)

    return {
      kind: 'stats',
      title: `Average ${target}`,
      description: `Average ${target} from the loaded dataset`,
      numericSummary: { value: avg } as Record<string, number>,
    }
  }

  return {
    kind: 'summary',
    title: 'Data analysis unavailable',
    description: 'The question was parsed but no deterministic calculation matched the requested dataset operation.',
    message: 'The uploaded dataset is available, but this question needs a more specific data-operation definition.',
  }
}

export function compareOperatingPoints(rows: AspenRow[], selected: Array<string | number>, schema: DatasetSchema) {
  const matches = rows.filter((row) => {
    const identifiers = schema.idColumns.length ? schema.idColumns.map((column) => row[column]) : []
    const runIdentifier = identifiers.length ? identifiers[0] : row.Run_ID ?? 'row'
    return selected.includes(runIdentifier as string | number)
  })

  if (!matches.length) {
    return []
  }

  return matches.map((row) => ({ row }))
}
