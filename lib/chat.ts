import type { AspenRow } from '@/lib/types'

export const CHAT_CHART_TYPES = ['line', 'bar', 'scatter', 'area'] as const

export type ChatChartType = (typeof CHAT_CHART_TYPES)[number]

export interface ChatChartSpec {
  type: ChatChartType
  title: string
  x: string
  y: string
}

export interface ChatTableSpec {
  title?: string
  columns: string[]
  rowIndexes?: number[]
}

export interface ChatKpiSpec {
  label: string
  value: string | number
  column?: string
}

export interface ChatDataResponse {
  answer: string
  charts?: ChatChartSpec[]
  tables?: ChatTableSpec[]
  kpis?: ChatKpiSpec[]
}

export interface ChatResponseValidation {
  response: ChatDataResponse
  warnings: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateChatDataResponse(
  value: unknown,
  columns: string[],
  numericColumns: string[],
  rowCount: number,
): ChatResponseValidation {
  const warnings: string[] = []
  const columnSet = new Set(columns)
  const numericColumnSet = new Set(numericColumns)

  if (!isRecord(value)) {
    return {
      response: {
        answer: 'The analyst returned a malformed response. Please try the question again.',
      },
      warnings: ['The assistant response was not a JSON object.'],
    }
  }

  const answer = nonEmptyString(value.answer)
    ? value.answer.trim()
    : 'The analyst returned a response without a readable text answer.'

  if (!nonEmptyString(value.answer)) {
    warnings.push('The assistant response did not include a valid answer.')
  }

  const charts: ChatChartSpec[] = []
  if (typeof value.charts !== 'undefined' && !Array.isArray(value.charts)) {
    warnings.push('An invalid charts field was ignored.')
  } else {
    for (const [index, candidate] of (value.charts ?? []).entries()) {
      if (!isRecord(candidate)) {
        warnings.push(`Chart ${index + 1} was malformed and could not be rendered.`)
        continue
      }

      const type = candidate.type
      const title = candidate.title
      const x = candidate.x
      const y = candidate.y

      if (!CHAT_CHART_TYPES.includes(type as ChatChartType)) {
        warnings.push(`Chart ${index + 1} requested an unsupported chart type.`)
        continue
      }
      if (!nonEmptyString(title) || !nonEmptyString(x) || !nonEmptyString(y)) {
        warnings.push(`Chart ${index + 1} was missing required configuration.`)
        continue
      }
      if (!columnSet.has(x) || !columnSet.has(y)) {
        warnings.push(`Chart ${index + 1} could not be generated because one of its columns does not exist in this dataset.`)
        continue
      }
      if (!numericColumnSet.has(y) || (type === 'scatter' && !numericColumnSet.has(x))) {
        warnings.push(`Chart ${index + 1} requires numeric ${type === 'scatter' ? 'X and Y columns' : 'Y values'}.`)
        continue
      }

      charts.push({ type: type as ChatChartType, title: title.trim(), x, y })
    }
  }

  const tables: ChatTableSpec[] = []
  if (typeof value.tables !== 'undefined' && !Array.isArray(value.tables)) {
    warnings.push('An invalid tables field was ignored.')
  } else {
    for (const [index, candidate] of (value.tables ?? []).entries()) {
      if (!isRecord(candidate) || !Array.isArray(candidate.columns) || !candidate.columns.length) {
        warnings.push(`Table ${index + 1} was malformed and could not be rendered.`)
        continue
      }

      const tableColumns = candidate.columns
      if (!tableColumns.every((column) => nonEmptyString(column) && columnSet.has(column))) {
        warnings.push(`Table ${index + 1} could not be generated because it requested an unknown column.`)
        continue
      }

      if (!Array.isArray(candidate.rowIndexes)) {
        warnings.push(`Table ${index + 1} was ignored because it did not identify rows from the current dataset.`)
        continue
      }

      const rowIndexes = candidate.rowIndexes
      if (!rowIndexes.every((rowIndex) => Number.isInteger(rowIndex) && rowIndex >= 0 && rowIndex < rowCount)) {
        warnings.push(`Table ${index + 1} could not be generated because it referenced an invalid row.`)
        continue
      }

      const title = typeof candidate.title === 'string' ? candidate.title.trim() : undefined
      tables.push({
        title: title || undefined,
        columns: tableColumns as string[],
        rowIndexes: rowIndexes as number[],
      })
    }
  }

  const kpis: ChatKpiSpec[] = []
  if (typeof value.kpis !== 'undefined' && !Array.isArray(value.kpis)) {
    warnings.push('An invalid KPIs field was ignored.')
  } else {
    for (const [index, candidate] of (value.kpis ?? []).entries()) {
      if (!isRecord(candidate) || !nonEmptyString(candidate.label)) {
        warnings.push(`KPI ${index + 1} was malformed and could not be rendered.`)
        continue
      }

      const metricValue = candidate.value
      if (!nonEmptyString(metricValue) && !(typeof metricValue === 'number' && Number.isFinite(metricValue))) {
        warnings.push(`KPI ${index + 1} did not contain a valid value.`)
        continue
      }

      const column = candidate.column
      if (column !== null && typeof column !== 'undefined' && (!nonEmptyString(column) || !columnSet.has(column))) {
        warnings.push(`KPI ${index + 1} could not be generated because its column does not exist in this dataset.`)
        continue
      }

      kpis.push({
        label: candidate.label.trim(),
        value: metricValue as string | number,
        column: typeof column === 'string' ? column : undefined,
      })
    }
  }

  return {
    response: {
      answer,
      charts: charts.length ? charts : undefined,
      tables: tables.length ? tables : undefined,
      kpis: kpis.length ? kpis : undefined,
    },
    warnings,
  }
}

export function selectTableRows(data: AspenRow[], rowIndexes: number[]) {
  return rowIndexes.map((rowIndex) => data[rowIndex]).filter((row): row is AspenRow => Boolean(row))
}
