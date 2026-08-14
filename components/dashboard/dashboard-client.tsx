'use client'

import { useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FlaskConical,
  LineChart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
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
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/12 shadow-sm shadow-primary/10">
              <FlaskConical className="size-5 text-primary" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tracking-tight text-foreground">AspenIQ</span>
                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Process Analytics</span>
              </div>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Engineering workspace</p>
            </div>
          </div>

          {data.length > 0 && (
            <div className="flex items-center gap-2">
              <nav className="mr-2 hidden items-center gap-1 lg:flex" aria-label="Dashboard sections">
                <a href="#overview" className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Overview</a>
                <a href="#charts-section" className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Analytics</a>
                <a href="#data-section" className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Data</a>
              </nav>
              <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-1.5 text-xs text-emerald-300 md:flex">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Dataset ready
              </div>
              <PDFExport dashboardRef={dashboardRef} chartsRef={chartsRef} fileName={fileName} />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8" ref={dashboardRef}>
        {data.length > 0 ? (
          <div className="flex flex-col gap-8 lg:gap-10">
            <section id="overview" className="grid scroll-mt-24 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.55fr)] lg:items-stretch">
              <div className="surface-panel flex flex-col justify-between rounded-2xl p-6 sm:p-7">
                <div>
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <Activity className="size-3.5" /> Live workspace
                    </span>
                    <span className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">{schema?.columns.length ?? 0} variables</span>
                  </div>
                  <p className="text-sm font-medium text-primary">Simulation overview</p>
                  <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-4xl">Operational performance, clearly in view.</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Review process outcomes, compare operating conditions, and identify the strongest simulation runs from one focused workspace.</p>
                </div>
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-t border-border/70 pt-5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2"><Database className="size-4 text-primary" /><strong className="font-semibold text-foreground">{data.length.toLocaleString()}</strong> simulation runs</span>
                  <span className="inline-flex min-w-0 items-center gap-2"><FileSpreadsheet className="size-4 text-accent" /><span className="max-w-[240px] truncate">{fileName}</span></span>
                </div>
              </div>
              <CSVUpload onDataLoaded={handleDataLoaded} hasData fileName={fileName} rowCount={data.length} />
            </section>

            <div className="sticky top-16 z-30 -mx-4 flex items-center gap-1 overflow-x-auto border-y border-border/70 bg-background/92 px-4 py-2 backdrop-blur-lg sm:hidden" aria-label="Dashboard sections">
              <a href="#overview" className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">Overview</a>
              <a href="#charts-section" className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground">Analytics</a>
              <a href="#data-section" className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground">Data</a>
            </div>

            <KPICards data={data} schema={schema ?? inferDatasetSchema(data)} />

            <div ref={chartsRef}>
              <Charts data={data} schema={schema ?? inferDatasetSchema(data)} />
            </div>

            <DataTable data={data} />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section className="grid min-h-[560px] items-center gap-8 py-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(460px,1.08fr)] lg:gap-14 lg:py-12">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" /> Built for process engineers
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">Turn simulation output into operating insight.</h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Upload an Aspen Plus or HYSYS CSV to surface high-value KPIs, compare process variables, explore every run, and export a decision-ready report.</p>
                <div className="mt-8 hidden gap-3 sm:grid sm:grid-cols-3">
                  {[
                    { icon: LineChart, label: 'Visual analysis', desc: 'Adaptive charts and heatmaps' },
                    { icon: Database, label: 'Dynamic schema', desc: 'Works with your CSV structure' },
                    { icon: ShieldCheck, label: 'Local workflow', desc: 'Data stays in your session' },
                  ].map((item) => (
                    <div key={item.label} className="border-l border-border pl-3.5">
                      <item.icon className="mb-2 size-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <CSVUpload onDataLoaded={handleDataLoaded} hasData={false} fileName={fileName} rowCount={data.length} />
            </section>

            <section className="surface-panel grid overflow-hidden rounded-2xl sm:grid-cols-3" aria-label="Product capabilities">
              {[
                { number: '01', icon: BarChart3, title: 'Find the signal', copy: 'Automatically infer numeric variables and surface decision-useful comparisons.' },
                { number: '02', icon: CheckCircle2, title: 'Validate each run', copy: 'Search, sort, filter, and export the full simulation result set.' },
                { number: '03', icon: Sparkles, title: 'Ask your analyst', copy: 'Use the file-aware assistant to explore results in natural language.' },
              ].map((item, index) => (
                <div key={item.number} className={`p-6 sm:p-7 ${index > 0 ? 'border-t border-border sm:border-l sm:border-t-0' : ''}`}>
                  <div className="flex items-center justify-between">
                    <item.icon className="size-5 text-primary" />
                    <span className="font-mono text-[10px] text-muted-foreground">{item.number}</span>
                  </div>
                  <h2 className="mt-5 text-base font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                </div>
              ))}
            </section>
          </div>
        )}

        <footer className="mt-14 flex flex-col gap-3 border-t border-border/70 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-foreground/80">AspenIQ Process Analytics</p>
          <p>Simulation intelligence for chemical engineering workflows</p>
        </footer>
      </main>

      <ChatAssistant data={data} schema={schema} fileName={fileName} />
    </div>
  )
}
