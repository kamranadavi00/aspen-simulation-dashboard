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
            'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-16 text-center cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'border-border bg-card hover:border-primary/60 hover:bg-muted/40',
            isLoading && 'pointer-events-none opacity-70'
          )}
        >
          <div
            className={cn(
              'flex size-16 items-center justify-center rounded-full border border-border bg-muted transition-colors',
              isDragging && 'border-primary bg-primary/20'
            )}
          >
            {isLoading ? (
              <RefreshCw className="size-7 animate-spin text-primary" />
            ) : (
              <UploadCloud className={cn('size-7 text-muted-foreground transition-colors', isDragging && 'text-primary')} />
            )}
          </div>

          <div>
            <p className="text-base font-semibold text-foreground">
              {isLoading ? 'Parsing CSV...' : 'Drop your Aspen CSV file here'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or <span className="text-primary font-medium">click to browse</span> — .csv files only
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono">CSV</span>
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono">Dynamic Schema</span>
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono">KPI + Charts</span>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive max-w-lg">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".csv" className="sr-only" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-400" />
                <p className="text-sm font-semibold text-foreground">{fileName}</p>
              </div>
              <p className="text-xs text-muted-foreground">{rowCount.toLocaleString()} simulation runs loaded</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              <span>{error}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 gap-2 border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-4" />
            Replace Dataset
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" className="sr-only" onChange={handleFileChange} />
        </div>
      )}
    </section>
  )
}
