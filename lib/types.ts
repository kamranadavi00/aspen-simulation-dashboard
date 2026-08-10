export type DataCellValue = string | number | boolean | null | undefined

export interface AspenRow {
  [key: string]: DataCellValue
}

export interface KPIData {
  maxYield: number
  maxConversion: number
  bestTemperature: number
  bestPressure: number
  minEnergy: number
  bestOperatingPoint: AspenRow | null
}

export interface HeatmapCell {
  temperature: number
  pressure: number
  yield: number
}
