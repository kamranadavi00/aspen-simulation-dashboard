'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bot,
  MessageCircle,
  Send,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AspenRow } from '@/lib/types'
import { cn, toFiniteNumber } from '@/lib/utils'

interface ChatAssistantProps {
  data: AspenRow[]
  fileName: string | null
}

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  loading?: boolean
}

function average(rows: AspenRow[], key: keyof AspenRow) {
  const values = rows.map((row) => toFiniteNumber(row[key])).filter((value): value is number => value !== null)
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function computeDatasetSummary(data: AspenRow[], fileName: string | null) {
  if (!data.length) {
    return {
      rowCount: 0,
      columns: [],
      avgYield: 0,
      avgConversion: 0,
      avgEnergy: 0,
      avgFeedRate: 0,
      maxYield: 0,
      maxConversion: 0,
      minEnergy: 0,
      temperatureRange: '0 - 0 °C',
      pressureRange: '0 - 0 bar',
      bestYieldRun: null as AspenRow | null,
      fileName,
    }
  }

  const numericValues = (key: keyof AspenRow) =>
    data.map((row) => toFiniteNumber(row[key])).filter((value): value is number => value !== null)

  const yields = numericValues('Yield')
  const conversions = numericValues('Conversion')
  const energy = numericValues('Energy')
  const temperatures = numericValues('Temperature')
  const pressures = numericValues('Pressure')

  const bestYieldRun = data.reduce((best, row) =>
    (toFiniteNumber(row.Yield) ?? Number.NEGATIVE_INFINITY) > (toFiniteNumber(best.Yield) ?? Number.NEGATIVE_INFINITY) ? row : best
  , data[0])

  const columns = Object.keys(data[0] ?? {})

  return {
    rowCount: data.length,
    columns,
    avgYield: average(data, 'Yield'),
    avgConversion: average(data, 'Conversion'),
    avgEnergy: average(data, 'Energy'),
    avgFeedRate: average(data, 'Feed_Rate'),
    maxYield: yields.length ? Math.max(...yields) : 0,
    maxConversion: conversions.length ? Math.max(...conversions) : 0,
    minEnergy: energy.length ? Math.min(...energy) : 0,
    temperatureRange: temperatures.length ? `${Math.min(...temperatures)} - ${Math.max(...temperatures)} °C` : 'N/A',
    pressureRange: pressures.length ? `${Math.min(...pressures)} - ${Math.max(...pressures)} bar` : 'N/A',
    bestYieldRun,
    fileName,
  }
}

export function ChatAssistant({ data, fileName }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: data.length
        ? `I’m reviewing ${fileName ?? 'your dataset'} with ${data.length.toLocaleString()} loaded runs. Ask about the data, KPIs, charts, insights, or operating points.`
        : 'Upload a CSV file to begin a file-aware conversation.',
    },
  ])
  const [input, setInput] = useState('')

  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  const summary = useMemo(() => computeDatasetSummary(data, fileName), [data, fileName])

  function scrollToBottom() {
    if (!chatContainerRef.current) return

    const element = chatContainerRef.current
    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    if (isOpen) {
      const frame = window.requestAnimationFrame(scrollToBottom)
      return () => window.cancelAnimationFrame(frame)
    }
  }, [isOpen, messages])

  useEffect(() => {
    setMessages((current) => current.map((message) =>
      message.id === 'welcome'
        ? {
            ...message,
            content: data.length
              ? `I’m reviewing ${fileName ?? 'your dataset'} with ${data.length.toLocaleString()} loaded runs. Ask about the data, KPIs, charts, insights, or operating points.`
              : 'Upload a CSV file to begin a file-aware conversation.',
          }
        : message
    ))
  }, [data.length, fileName])

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

    const nextQuestion = input.trim()
    if (!nextQuestion) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: nextQuestion,
    }

    const streamingAssistantId = crypto.randomUUID()
    const streamingAssistantMessage: ChatMessage = {
      id: streamingAssistantId,
      role: 'assistant',
      content: '',
      loading: true,
    }

    const pendingMessages = [...messages, userMessage]

    setMessages((current) => [...current, userMessage, streamingAssistantMessage])
    setInput('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: pendingMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          dataset: { rows: data },
          fileName,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'The chat server could not process the request.' }))
        const errorText = typeof payload?.error === 'string' ? payload.error : 'Unable to contact the chat service.'

        setMessages((current) =>
          current.map((message) =>
            message.id === streamingAssistantId
              ? { ...message, content: errorText, loading: false }
              : message
          )
        )
        return
      }

      if (!response.body) {
        setMessages((current) =>
          current.map((message) =>
            message.id === streamingAssistantId
              ? { ...message, content: 'The model returned an empty response stream.', loading: false }
              : message
          )
        )
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue

          const raw = trimmed.slice(5).trim()
          if (!raw || raw === '[DONE]') continue

          try {
            const payload = JSON.parse(raw) as {
              choices?: Array<{
                delta?: {
                  content?: string
                }
              }>
            }

            const delta = payload.choices?.[0]?.delta?.content
            if (delta) {
              setMessages((current) =>
                current.map((message) =>
                  message.id === streamingAssistantId
                    ? { ...message, content: `${message.content}${delta}`, loading: false }
                    : message
                )
              )
            }
          } catch (error) {
            console.warn('OpenRouter stream payload could not be parsed.', error)
          }
        }
      }

      if (buffer.trim()) {
        const lines = buffer.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const raw = trimmed.slice(5).trim()
          if (!raw || raw === '[DONE]') continue

          try {
            const payload = JSON.parse(raw) as {
              choices?: Array<{
                delta?: {
                  content?: string
                }
              }>
            }
            const delta = payload.choices?.[0]?.delta?.content
            if (delta) {
              setMessages((current) =>
                current.map((message) =>
                  message.id === streamingAssistantId
                    ? { ...message, content: `${message.content}${delta}`, loading: false }
                    : message
                )
              )
            }
          } catch (error) {
            console.warn('OpenRouter final stream payload could not be parsed.', error)
          }
        }
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Network error while contacting the OpenRouter chat service.'
      setMessages((current) =>
        current.map((message) =>
          message.id === streamingAssistantId
            ? { ...message, content: `I ran into a stream/network error: ${errorText}`, loading: false }
            : message
        )
      )
    }
  }

  return (
    <>
      {isOpen && <button type="button" aria-label="Close analyst panel" className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] sm:hidden" onClick={() => setIsOpen(false)} />}
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        {isOpen && (
          <section id="analyst-panel" aria-label="Aspen analyst chat" className="surface-panel fixed inset-x-3 bottom-20 top-20 flex flex-col overflow-hidden rounded-2xl bg-background shadow-2xl shadow-black/40 sm:inset-auto sm:bottom-20 sm:right-6 sm:h-[min(720px,calc(100vh-7rem))] sm:w-[410px]">
            <div className="flex items-center justify-between border-b border-border/80 bg-card/95 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                  <Bot className="size-4.5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Aspen analyst</p>
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-muted-foreground">
                    {fileName ?? 'No dataset loaded'}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="icon-sm" aria-label="Close analyst" onClick={() => setIsOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div ref={chatContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5">
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <div key={message.id} className={cn('flex items-end gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {message.role === 'assistant' && (
                      <div className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
                        <Bot className="size-3.5" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[84%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 shadow-sm',
                        message.role === 'user'
                          ? 'rounded-br-md bg-primary text-primary-foreground shadow-primary/10'
                          : 'rounded-bl-md border border-border bg-card text-foreground'
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
                          <div className="markdown-render markdown-render-assistant prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || '...'}</ReactMarkdown>
                          </div>
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
                  disabled={!data.length}
                  aria-label="Ask the Aspen analyst"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background/80 px-3.5 text-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <Button type="submit" size="icon" disabled={!data.length || !input.trim()} aria-label="Send question">
                  <Send className="size-4" />
                </Button>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
                <span>{data.length ? `${summary.rowCount.toLocaleString()} runs in context` : 'Awaiting dataset upload'}</span>
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
            !data.length && 'opacity-80'
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
