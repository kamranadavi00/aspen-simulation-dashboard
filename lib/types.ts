export interface AspenRow {
  Run_ID: string
  Temperature: number
  Pressure: number
  Feed_Rate: number
  Residence_Time: number
  Catalyst_Loading: number
  Yield: number
  Conversion: number
  Energy: number
  Reactor_Duty: number
  Cooling_Duty: number
  Selectivity: number
  Byproduct: number
  Cost_Index: number
  [key: string]: string | number
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
