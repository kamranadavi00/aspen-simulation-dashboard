'use client'

import { useRef, useState } from 'react'
import { Download, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PDFExportProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>
  chartsRef: React.RefObject<HTMLDivElement | null>
  fileName: string | null
}

async function exportToPDF(
  element: HTMLDivElement | null,
  filename: string,
  onStart: () => void,
  onEnd: () => void
) {
  if (!element) return
  onStart()

  try {
    const [html2canvas, { default: jsPDF }] = await Promise.all([
      import('html2canvas').then((m) => m.default),
      import('jspdf'),
    ])

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0a0d16', // match background token
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10

    const imgWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let y = margin

    if (imgHeight <= pageHeight - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
    } else {
      // Multi-page: slice image across pages
      const totalPagesNeeded = Math.ceil(imgHeight / (pageHeight - margin * 2))
      const sliceHeight = canvas.height / totalPagesNeeded

      for (let i = 0; i < totalPagesNeeded; i++) {
        if (i > 0) {
          pdf.addPage()
          y = margin
        }
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sliceHeight
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, i * sliceHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        const sliceData = sliceCanvas.toDataURL('image/png')
        pdf.addImage(sliceData, 'PNG', margin, y, imgWidth, pageHeight - margin * 2)
      }
    }

    pdf.save(filename)
  } catch (err) {
    console.error('[v0] PDF export error:', err)
  } finally {
    onEnd()
  }
}

export function PDFExport({ dashboardRef, chartsRef, fileName }: PDFExportProps) {
  const [exportingFull, setExportingFull] = useState(false)
  const [exportingCharts, setExportingCharts] = useState(false)

  const baseName = fileName?.replace(/\.csv$/i, '') ?? 'aspen-dashboard'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={exportingFull}
        onClick={() =>
          exportToPDF(
            dashboardRef.current,
            `${baseName}-full-dashboard.pdf`,
            () => setExportingFull(true),
            () => setExportingFull(false)
          )
        }
        className="h-9 gap-2 border-border bg-muted text-muted-foreground hover:text-foreground"
      >
        {exportingFull ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {exportingFull ? 'Exporting...' : 'Export Full Dashboard'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={exportingCharts}
        onClick={() =>
          exportToPDF(
            chartsRef.current,
            `${baseName}-charts.pdf`,
            () => setExportingCharts(true),
            () => setExportingCharts(false)
          )
        }
        className="h-9 gap-2 border-border bg-muted text-muted-foreground hover:text-foreground"
      >
        {exportingCharts ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileDown className="size-4" />
        )}
        {exportingCharts ? 'Exporting...' : 'Export Charts Only'}
      </Button>
    </div>
  )
}
