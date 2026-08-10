'use client'

import { useCallback, useRef, useState } from 'react'
import Papa from 'papaparse'
import { UploadCloud, FileText, X, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AspenRow } from '@/lib/types'

interface CSVUploadProps {
  onDataLoaded: (data: AspenRow[], fileName: string) => void
  hasData: boolean
  fileName: string | null
  rowCount: number
}

function normalizeCell(value: string | undefined): string | number | boolean | null {
  if (typeof value === 'undefined') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^(true|false|yes|no|y|n|1|0)$/i.test(trimmed)) {
    return /^(true|yes|y|1)$/i.test(trimmed)
  }

  const numeric = Number(trimmed.replace(/,/g, ''))
  if (Number.isFinite(numeric) && trimmed !== '') {
    return numeric
  }

  return trimmed
}

export function CSVUpload({ onDataLoaded, hasData, fileName, rowCount }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv')) {
        setError('Only CSV files are supported. Please upload a valid .csv file.')
        return
      }

      setIsLoading(true)
      setError(null)

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            setError('Failed to parse CSV. Please check the file format.')
            setIsLoading(false)
            return
          }

          if (results.data.length === 0) {
            setError('The CSV file is empty. Please upload a file with data.')
            setIsLoading(false)
            return
          }

          const headers = Object.keys(results.data[0] || {})
          if (!headers.length) {
            setError('The CSV file does not expose any columns.')
            setIsLoading(false)
            return
          }

          const parsed: AspenRow[] = results.data.map((row, rowIndex) => {
            const stableRow: AspenRow = {}

            for (const header of headers) {
              const rawValue = row[header]
              stableRow[header] = normalizeCell(rawValue)
            }

            if (!('Run_ID' in stableRow) && !('Run' in stableRow) && !('ID' in stableRow) && !('Sample_ID' in stableRow)) {
              stableRow.Run_ID = `ROW-${rowIndex + 1}`
            }

            return stableRow
          })

          onDataLoaded(parsed, file.name)
          setIsLoading(false)
        },
        error: (err) => {
          setError(`Parse error: ${err.message}`)
          setIsLoading(false)
        },
      })
    },
    [onDataLoaded]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      // Reset so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [processFile]
  )

  return (
    <section aria-label="CSV Upload">
      {!hasData ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload CSV file by clicking or dragging"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          className={cn(
            'surface-panel group relative flex min-h-[470px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border p-5 text-center outline-none transition-[border-color,background-color,transform] duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 sm:p-8',
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'hover:border-primary/45 hover:bg-card/80',
            isLoading && 'pointer-events-none opacity-70'
          )}
        >
          <div className="absolute inset-4 rounded-xl border border-dashed border-border transition-colors group-hover:border-primary/45" />
          <div className="relative z-10 flex max-w-md flex-col items-center">
            <div className={cn('flex size-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/5 transition-transform group-hover:-translate-y-0.5', isDragging && 'border-primary bg-primary/20')}>
              {isLoading ? <RefreshCw className="size-7 animate-spin" /> : <UploadCloud className="size-7" />}
            </div>

            <p className="mt-6 text-xl font-semibold tracking-tight text-foreground">
              {isLoading ? 'Preparing your workspace…' : isDragging ? 'Release to upload' : 'Drop your simulation CSV here'}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">We’ll detect the schema and build KPIs, charts, and a searchable data workspace automatically.</p>

            <span className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-colors group-hover:bg-primary/90">
              Browse CSV file
            </span>

            <div className="mt-6 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border bg-muted/70 px-2.5 py-1">.CSV only</span>
              <span className="rounded-full border border-border bg-muted/70 px-2.5 py-1">Dynamic columns</span>
              <span className="rounded-full border border-border bg-muted/70 px-2.5 py-1">Processed in session</span>
            </div>
          </div>

          {error && (
            <div className="relative z-10 mt-5 flex max-w-lg items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".csv" className="sr-only" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="surface-panel flex h-full flex-col justify-between gap-6 rounded-2xl p-6 sm:p-7">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10">
                <FileText className="size-5 text-accent" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <CheckCircle2 className="size-3" /> Valid dataset
              </span>
            </div>
            <div className="mt-5 min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Current dataset</p>
              <p className="mt-2 truncate text-base font-semibold text-foreground" title={fileName ?? undefined}>{fileName}</p>
              <p className="mt-1 text-sm text-muted-foreground">Ready for analysis and export</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-5">
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{rowCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">simulation runs</p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="shrink-0 gap-2">
              <RefreshCw className="size-4" />
              Replace data
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="sr-only" onChange={handleFileChange} />
        </div>
      )}
    </section>
  )
}
