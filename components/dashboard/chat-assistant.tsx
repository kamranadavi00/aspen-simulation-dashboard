'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, Bot, ChartSpline, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatasetChart } from './charts'
import { InlineDataTable } from './data-table'
import { InlineKPICards } from './kpi-cards'
import type { DatasetSchema } from '@/lib/analysis'
import {
  selectTableRows,
  validateChatDataResponse,
  type ChatDataResponse,
} from '@/lib/chat'
import type { AspenRow } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ChatAssistantProps {
  data: AspenRow[]
  schema: DatasetSchema | null
  fileName: string | null
}

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  response?: ChatDataResponse
  warnings?: string[]
  loading?: boolean
}

interface ChatApiPayload {
  response?: unknown
  warnings?: unknown
  error?: unknown
}

function welcomeMessage(data: AspenRow[], fileName: string | null): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: data.length
      ? `I’m reviewing ${fileName ?? 'your dataset'} with ${data.length.toLocaleString()} loaded runs. Ask about the data, KPIs, charts, insights, or operating points.`
      : 'Upload a CSV file to begin a file-aware conversation.',
  }
}

function AssistantResult({ message, data }: { message: ChatMessage; data: AspenRow[] }) {
  const response = message.response

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="markdown-render markdown-render-assistant prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {response?.answer || message.content || '...'}
        </ReactMarkdown>
      </div>

      {response?.kpis?.length ? <InlineKPICards kpis={response.kpis} /> : null}

      {response?.charts?.map((chart, index) => (
        <div key={`${chart.title}-${index}`} className="overflow-hidden rounded-xl border border-border bg-background/45">
          <div className="flex items-start gap-2 border-b border-border/80 px-3 py-2.5">
            <ChartSpline className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{chart.title}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{chart.y} by {chart.x} · {chart.type}</p>
            </div>
          </div>
          <DatasetChart data={data} x={chart.x} y={chart.y} type={chart.type} className="h-56 px-1 py-3" />
        </div>
      ))}

      {response?.tables?.map((table, index) => (
        <InlineDataTable
          key={`${table.title ?? 'table'}-${index}`}
          title={table.title}
          columns={table.columns}
          data={selectTableRows(data, table.rowIndexes ?? [])}
        />
      ))}

      {message.warnings?.length ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-[11px] leading-4 text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{message.warnings.join(' ')}</span>
        </div>
      ) : null}
    </div>
  )
}

export function ChatAssistant({ data, schema, fileName }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(data, fileName)])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const activeRequestRef = useRef<AbortController | null>(null)

  const columns = useMemo(
    () => [...new Set(data.flatMap((row) => Object.keys(row)))],
    [data],
  )
  const numericColumns = schema?.numericColumns ?? []

  useEffect(() => {
    if (!isOpen || !chatContainerRef.current) return

    const frame = window.requestAnimationFrame(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isOpen, messages])

  useEffect(() => {
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setMessages([welcomeMessage(data, fileName)])
    setInput('')
    setIsSending(false)
  }, [data, fileName])

  useEffect(() => () => activeRequestRef.current?.abort(), [])

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const question = input.trim()
    if (!question || !data.length || isSending) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    }
    const assistantId = crypto.randomUUID()

    const history = messages
      .filter((message) => message.id !== 'welcome' && !message.loading)
      .map((message) => ({
        role: message.role,
        content: message.role === 'assistant' && message.response
          ? JSON.stringify(message.response)
          : message.content,
      }))

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: 'assistant', content: '', loading: true },
    ])
    setInput('')
    setIsSending(true)

    const controller = new AbortController()
    activeRequestRef.current = controller

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history,
          fileName,
          dataset: {
            rows: data,
            columns,
            schema,
          },
        }),
        signal: controller.signal,
      })

      const payload = await response.json().catch(() => ({
        error: 'The chat server returned an unreadable response.',
      })) as ChatApiPayload

      if (!response.ok) {
        const errorText = typeof payload.error === 'string'
          ? payload.error
          : 'Unable to contact the chat service.'

        setMessages((current) => current.map((message) => (
          message.id === assistantId
            ? { ...message, content: errorText, loading: false }
            : message
        )))
        return
      }

      const clientValidated = validateChatDataResponse(
        payload.response,
        columns,
        numericColumns,
        data.length,
      )
      const serverWarnings = Array.isArray(payload.warnings)
        ? payload.warnings.filter((warning): warning is string => typeof warning === 'string')
        : []
      const warnings = [...new Set([...serverWarnings, ...clientValidated.warnings])]

      setMessages((current) => current.map((message) => (
        message.id === assistantId
          ? {
              ...message,
              content: clientValidated.response.answer,
              response: clientValidated.response,
              warnings: warnings.length ? warnings : undefined,
              loading: false,
            }
          : message
      )))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return

      const errorText = error instanceof Error
        ? error.message
        : 'Network error while contacting the OpenRouter chat service.'

      setMessages((current) => current.map((message) => (
        message.id === assistantId
          ? { ...message, content: `I ran into a network error: ${errorText}`, loading: false }
          : message
      )))
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null
        setIsSending(false)
      }
    }
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close analyst panel"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        {isOpen && (
          <section
            id="analyst-panel"
            aria-label="Aspen analyst chat"
            className="surface-panel fixed inset-x-3 bottom-20 top-20 flex flex-col overflow-hidden rounded-2xl bg-background shadow-2xl shadow-black/40 sm:inset-auto sm:bottom-20 sm:right-6 sm:h-[min(760px,calc(100vh-7rem))] sm:w-[min(720px,calc(100vw-3rem))]"
          >
            <div className="flex items-center justify-between border-b border-border/80 bg-card/95 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                  <Bot className="size-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Aspen analyst</p>
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{fileName ?? 'No dataset loaded'}</p>
                </div>
              </div>

              <Button variant="ghost" size="icon-sm" aria-label="Close analyst" onClick={() => setIsOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div ref={chatContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-5 sm:px-4">
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn('flex items-end gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {message.role === 'assistant' && (
                      <div className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
                        <Bot className="size-3.5" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'min-w-0 rounded-2xl px-3.5 py-2.5 text-xs leading-5 shadow-sm',
                        message.role === 'user'
                          ? 'max-w-[84%] rounded-br-md bg-primary text-primary-foreground shadow-primary/10'
                          : 'w-[calc(100%-2.25rem)] rounded-bl-md border border-border bg-card text-foreground',
                      )}
                    >
                      {message.role === 'assistant' ? (
                        message.loading ? (
                          <div className="chat-assistant-loading-wrap" aria-label="Assistant is typing">
                            <span className="chat-assistant-loading-dot" />
                            <span className="chat-assistant-loading-dot" />
                            <span className="chat-assistant-loading-dot" />
                          </div>
                        ) : (
                          <AssistantResult message={message} data={data} />
                        )
                      ) : (
                        <span>{message.content}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="border-t border-border/80 bg-card/95 p-3.5">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={data.length ? 'Ask about the uploaded file...' : 'Upload data to start'}
                  disabled={!data.length || isSending}
                  aria-label="Ask the Aspen analyst"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background/80 px-3.5 text-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <Button type="submit" size="icon" disabled={!data.length || !input.trim() || isSending} aria-label="Send question">
                  <Send className="size-4" />
                </Button>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
                <span>{data.length ? `${data.length.toLocaleString()} complete rows in context` : 'Awaiting dataset upload'}</span>
                <span>Esc to close</span>
              </div>
            </form>
          </section>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            'flex h-12 items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xl shadow-black/25 transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25',
            isOpen && 'bg-secondary text-foreground hover:bg-secondary/80',
            !data.length && 'opacity-80',
          )}
          aria-label={isOpen ? 'Close Aspen analyst chat' : 'Open Aspen analyst chat'}
          aria-expanded={isOpen}
          aria-controls="analyst-panel"
        >
          {isOpen ? <X className="size-5" /> : <MessageCircle className="size-5" />}
          <span className="hidden sm:inline">{isOpen ? 'Close' : 'Ask analyst'}</span>
        </button>
      </div>
    </>
  )
}
