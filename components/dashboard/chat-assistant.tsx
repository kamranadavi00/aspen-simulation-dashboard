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
import { cn } from '@/lib/utils'

interface ChatAssistantProps {
  data: AspenRow[]
  fileName: string | null
}

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

function average(rows: AspenRow[], key: keyof AspenRow) {
  if (!rows.length) return 0
  const total = rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0)
  return total / rows.length
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

  const bestYieldRun = data.reduce((best, row) => (row.Yield > best.Yield ? row : best), data[0])

  const columns = Object.keys(data[0] ?? {})

  return {
    rowCount: data.length,
    columns,
    avgYield: average(data, 'Yield'),
    avgConversion: average(data, 'Conversion'),
    avgEnergy: average(data, 'Energy'),
    avgFeedRate: average(data, 'Feed_Rate'),
    maxYield: Math.max(...data.map((row) => row.Yield)),
    maxConversion: Math.max(...data.map((row) => row.Conversion)),
    minEnergy: Math.min(...data.map((row) => row.Energy)),
    temperatureRange: `${Math.min(...data.map((row) => row.Temperature))} - ${Math.max(...data.map((row) => row.Temperature))} °C`,
    pressureRange: `${Math.min(...data.map((row) => row.Pressure))} - ${Math.max(...data.map((row) => row.Pressure))} bar`,
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
              ? { ...message, content: errorText }
              : message
          )
        )
        return
      }

      if (!response.body) {
        setMessages((current) =>
          current.map((message) =>
            message.id === streamingAssistantId
              ? { ...message, content: 'The model returned an empty response stream.' }
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
                    ? { ...message, content: `${message.content}${delta}` }
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
                    ? { ...message, content: `${message.content}${delta}` }
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
            ? { ...message, content: `I ran into a stream/network error: ${errorText}` }
            : message
        )
      )
    }
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {isOpen && (
          <section className="w-[min(92vw,390px)] h-[min(78vh,720px)] max-h-[720px] min-h-[520px] sm:h-[660px] sm:max-h-[680px] md:h-[720px] md:max-h-[760px] flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Aspen Analyst</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {fileName ? 'File Context' : 'No file loaded'}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="icon-sm" onClick={() => setIsOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-background px-4 py-3">
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'border border-border bg-muted text-foreground rounded-bl-md'
                      )}
                    >
                      {message.role === 'assistant' ? (
                        <div className="markdown-render markdown-render-assistant prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || '...'}</ReactMarkdown>
                        </div>
                      ) : (
                        <span>{message.content}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="border-t border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={data.length ? 'Ask about the uploaded file...' : 'Upload data to start'}
                  disabled={!data.length}
                  className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <Button type="submit" size="sm" disabled={!data.length || !input.trim()} className="gap-1.5">
                  <Send className="size-3.5" />
                  Send
                </Button>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>{data.length ? `${summary.rowCount.toLocaleString()} runs` : 'Awaiting upload'}</span>
                <span className="font-mono">context: {fileName ?? 'No file'}</span>
              </div>
            </form>
          </section>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            'flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary/90',
            !data.length && 'cursor-not-allowed opacity-80'
          )}
          aria-label="Open Aspen analyst chat"
        >
          <MessageCircle className="size-6" />
        </button>
      </div>
    </>
  )
}
