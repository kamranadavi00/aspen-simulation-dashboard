'use client'

import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AspenRow } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DataTableProps {
  data: AspenRow[]
}

function downloadCSV(data: AspenRow[], filename: string) {
  if (!data.length) return
  
  const headers = Object.keys(data[0])
  const csvRows = [headers.join(',')]
  
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h]
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : String(val)
    })
    csvRows.push(values.join(','))
  }
  
  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataTable({ data }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const columns = useMemo<ColumnDef<AspenRow>[]>(() => {
    if (!data.length) return []
    
    const keys = Object.keys(data[0])
    return keys.map((key) => ({
      accessorKey: key,
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-3 h-8 font-semibold text-muted-foreground hover:text-foreground gap-1"
        >
          {key}
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-1 size-3.5" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-1 size-3.5" />
          ) : (
            <ArrowUpDown className="ml-1 size-3.5 opacity-50" />
          )}
        </Button>
      ),
      cell: ({ getValue }) => {
        const val = getValue()
        if (val === null || typeof val === 'undefined' || val === '') {
          return <span className="text-muted-foreground/60">—</span>
        }
        return typeof val === 'number' ? (
          <span className="font-mono text-[13px] font-medium tabular-nums text-foreground">{val.toFixed(2)}</span>
        ) : (
          <span className="text-[13px] text-foreground/90">{String(val)}</span>
        )
      },
    }))
  }, [data])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const allColumns = table.getAllColumns().filter((col) => col.getCanHide())
  const visibleCount = allColumns.filter((c) => c.getIsVisible()).length

  if (!data.length) return null

  return (
    <section id="data-section" aria-label="Data Table" className="flex scroll-mt-28 flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Inspect every run</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Simulation data</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Search, sort, and export the complete result set.</p>
        </div>
        <span className="w-fit rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">{data.length.toLocaleString()} total rows</span>
      </div>

      <div className="surface-panel overflow-visible rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search all simulation data columns"
              placeholder="Search all columns"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <details className="group relative flex-1 sm:flex-none">
              <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-3 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 [&::-webkit-details-marker]:hidden">
                <Eye className="size-4" />
                Columns <span className="text-foreground">{visibleCount}/{allColumns.length}</span>
              </summary>
              <div className="absolute right-0 top-12 z-30 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between border-b border-border/70 px-2 pb-2 pt-1">
                  <span className="text-xs font-semibold text-foreground">Visible columns</span>
                  <button type="button" className="text-[11px] font-medium text-primary hover:underline" onClick={() => allColumns.forEach((column) => column.toggleVisibility(true))}>Show all</button>
                </div>
                <div className="mt-1">
                  {allColumns.map((column) => (
                    <label key={column.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                      <input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} className="size-4 accent-[var(--primary)]" />
                      <span className="truncate">{column.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <Button variant="outline" onClick={() => downloadCSV(table.getFilteredRowModel().rows.map((r) => r.original), 'aspen-data.csv')} className="flex-1 gap-2 sm:flex-none">
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border/90">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-12 px-4 text-left align-middle font-medium"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : 'auto' }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn('border-b border-border/60 transition-colors last:border-b-0 odd:bg-background/10 hover:bg-primary/[0.045]', row.getIsSelected() && 'bg-primary/10')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="whitespace-nowrap px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-40 text-center text-muted-foreground">
                    <Search className="mx-auto mb-3 size-5 opacity-50" />
                    No rows match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4 border-t border-border/80 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div aria-live="polite">
          Showing <span className="font-semibold text-foreground">{table.getRowModel().rows.length.toLocaleString()}</span> of{' '}
          <span className="font-semibold text-foreground">{table.getFilteredRowModel().rows.length.toLocaleString()}</span> filtered rows (
          <span className="font-semibold text-foreground">{data.length.toLocaleString()}</span> total)
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="size-9 p-0"
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="size-9 p-0"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex min-w-16 items-center justify-center gap-1 px-2">
            <span className="font-medium text-foreground">{table.getState().pagination.pageIndex + 1}</span>
            <span>/</span>
            <span>{table.getPageCount()}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="size-9 p-0"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="size-9 p-0"
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </Button>

          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="field-select ml-2 min-h-9 py-0 text-xs font-medium"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </div>
      </div>
      </div>
    </section>
  )
}
