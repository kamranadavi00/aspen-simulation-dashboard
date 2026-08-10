'use client'

import { useRef, useState } from 'react'
import { Activity, BarChart3, FlaskConical, Moon, Sun, Upload } from 'lucide-react'
import { CSVUpload } from './csv-upload'
import { KPICards } from './kpi-cards'
import { DataTable } from './data-table'
import { Charts } from './charts'
import { PDFExport } from './pdf-export'
import { ChatAssistant } from './chat-assistant'
import type { AspenRow } from '@/lib/types'
import { inferDatasetSchema, type DatasetSchema } from '@/lib/analysis'

export function DashboardClient() {
  const [data, setData] = useState<AspenRow[]>([])
  const [schema, setSchema] = useState<DatasetSchema | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const dashboardRef = useRef<HTMLDivElement>(null)
  const chartsRef = useRef<HTMLDivElement>(null)

  function handleDataLoaded(rows: AspenRow[], name: string) {
    const nextSchema = inferDatasetSchema(rows)
    setData(rows)
    setSchema(nextSchema)
    setFileName(name)
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <FlaskConical className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-none">
                Aspen Process Analytics
              </h1>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                Simulation Results Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.length > 0 && (
              <>
                <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  <Activity className="size-3.5 text-primary" />
                  <span className="font-semibold text-foreground">{data.length.toLocaleString()}</span> runs
                </div>
                <PDFExport dashboardRef={dashboardRef} chartsRef={chartsRef} fileName={fileName} />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6" ref={dashboardRef}>
        <div className="flex flex-col gap-6">
          {/* Upload */}
          <CSVUpload
            onDataLoaded={handleDataLoaded}
            hasData={data.length > 0}
            fileName={fileName}
            rowCount={data.length}
          />

          {data.length > 0 ? (
            <>
              {/* KPIs */}
              <KPICards data={data} schema={schema ?? inferDatasetSchema(data)} />

              {/* Charts */}
              <div ref={chartsRef}>
                <Charts data={data} schema={schema ?? inferDatasetSchema(data)} />
              </div>

              {/* Data Table */}
              <DataTable data={data} />
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-border bg-card py-24 px-8 text-center">
              <div className="flex size-20 items-center justify-center rounded-2xl border border-border bg-muted">
                <BarChart3 className="size-10 text-muted-foreground/50" />
              </div>
              <div className="max-w-md">
                <h2 className="text-lg font-semibold text-foreground">No simulation data loaded</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Upload an Aspen Plus or Aspen HYSYS CSV output file above to populate the dashboard with interactive
                  KPI cards, sortable data tables, and eight analytical charts including a yield heatmap.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left text-xs text-muted-foreground sm:grid-cols-4">
                {[
                  { icon: '01', label: 'Upload CSV', desc: 'Drag & drop or browse' },
                  { icon: '02', label: 'View KPIs', desc: 'Instant metrics overview' },
                  { icon: '03', label: 'Explore Data', desc: 'Sort, filter, paginate' },
                  { icon: '04', label: 'Analyze Charts', desc: '8 interactive charts' },
                ].map((step) => (
                  <div key={step.icon} className="flex flex-col gap-1 rounded-lg border border-border bg-muted/50 p-3">
                    <span className="font-mono text-[10px] text-primary">{step.icon}</span>
                    <span className="font-semibold text-foreground text-xs">{step.label}</span>
                    <span className="text-[11px]">{step.desc}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 rounded-lg border border-border bg-muted/40 px-6 py-4 text-left text-xs text-muted-foreground max-w-lg w-full">
                <p className="mb-2 font-semibold text-foreground text-xs">Expected CSV columns</p>
                <div className="flex flex-wrap gap-1.5 font-mono">
                  {[
                    'Run_ID', 'Temperature', 'Pressure', 'Feed_Rate',
                    'Residence_Time', 'Catalyst_Loading', 'Yield', 'Conversion',
                    'Energy', 'Reactor_Duty', 'Cooling_Duty', 'Selectivity',
                    'Byproduct', 'Cost_Index'
                  ].map((col) => (
                    <span key={col} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-10 border-t border-border pt-6 pb-4 text-center text-xs text-muted-foreground">
          <p>Aspen Process Analytics Dashboard &mdash; Chemical Engineering Simulation Analysis Tool</p>
        </footer>
      </main>

      <ChatAssistant data={data} fileName={fileName} />
    </div>
  )
}
