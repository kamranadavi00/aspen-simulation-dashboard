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
        return typeof val === 'number' ? (
          <span className="font-mono text-sm tabular-nums">{val.toFixed(2)}</span>
        ) : (
          <span className="text-sm">{String(val)}</span>
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
    <section aria-label="Data Table" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Simulation Data</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search all columns..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 pl-8 text-sm bg-muted border-border"
            />
          </div>
          
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-border bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => {
                const allHidden = allColumns.every((c) => !c.getIsVisible())
                allColumns.forEach((c) => c.toggleVisibility(!allHidden))
              }}
            >
              <Eye className="size-4" />
              Columns ({visibleCount}/{allColumns.length})
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCSV(table.getFilteredRowModel().rows.map((r) => r.original), 'aspen-data.csv')}
            className="h-9 gap-2 border-border bg-muted text-muted-foreground hover:text-foreground"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-11 px-3 text-left align-middle font-medium"
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
                    className={cn('border-b border-border transition-colors hover:bg-muted/50', row.getIsSelected() && 'bg-muted/80')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{table.getRowModel().rows.length.toLocaleString()}</span> of{' '}
          <span className="font-semibold text-foreground">{table.getFilteredRowModel().rows.length.toLocaleString()}</span> filtered rows (
          <span className="font-semibold text-foreground">{data.length.toLocaleString()}</span> total)
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="size-8 p-0 border-border"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="size-8 p-0 border-border"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-1 px-2">
            <span className="font-medium text-foreground">{table.getState().pagination.pageIndex + 1}</span>
            <span>/</span>
            <span>{table.getPageCount()}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="size-8 p-0 border-border"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="size-8 p-0 border-border"
          >
            <ChevronsRight className="size-4" />
          </Button>

          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="ml-2 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}
