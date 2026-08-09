import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

function buildDatasetContext(data: Record<string, unknown> | undefined, fileName: string | null) {
  if (!data || !Array.isArray(data.rows) || !data.rows.length) {
    return 'No dataset is loaded in the current chat session.'
  }

  const rows = data.rows as Array<Record<string, unknown>>
  const temperature = rows.map((row) => Number(row.Temperature ?? 0))
  const pressure = rows.map((row) => Number(row.Pressure ?? 0))
  const yieldValues = rows.map((row) => Number(row.Yield ?? 0))
  const conversionValues = rows.map((row) => Number(row.Conversion ?? 0))

  const avgYield = yieldValues.reduce((sum, value) => sum + value, 0) / yieldValues.length
  const avgConversion = conversionValues.reduce((sum, value) => sum + value, 0) / conversionValues.length

  return [
    `The user uploaded the Aspen file "${fileName ?? 'unnamed dataset'}".`,
    `The current dataset includes ${rows.length} simulation runs across the dashboard data model.`,
    `Temperature range is ${Math.min(...temperature)} to ${Math.max(...temperature)} °C.`,
    `Pressure range is ${Math.min(...pressure)} to ${Math.max(...pressure)} bar.`,
    `Average yield is ${avgYield.toFixed(2)}%.`,
    `Average conversion is ${avgConversion.toFixed(2)}%.`,
  ].join(' ')
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    const model = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free'
    const openRouterUrl = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions'

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'OpenRouter API key is not configured. Set OPENROUTER_API_KEY in the server environment.',
        },
        { status: 500 }
      )
    }

    const body = (await request.json()) as {
      messages?: ChatMessage[]
      fileName?: string | null
      dataset?: Record<string, unknown>
    }

    const incomingMessages = Array.isArray(body.messages) ? body.messages : []

    const datasetContext = buildDatasetContext(body.dataset, body.fileName ?? null)

    const openRouterMessages = [
      {
        role: 'system',
        content: `You are an Aspen Process Analytics Analyst. You are helping the user analyze the uploaded Aspen Plus/HYSYS simulation dataset. Answer using the current file context only. The uploaded file name is ${body.fileName ?? 'not provided'}. ${datasetContext}`,
      },
      ...incomingMessages,
    ]

    const upstreamResponse = await fetch(openRouterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Aspen Process Analytics Dashboard',
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: openRouterMessages,
      }),
    })

    if (!upstreamResponse.ok) {
      const errorMessage = await upstreamResponse.text().catch(() => '')

      return NextResponse.json(
        {
          error: 'OpenRouter returned an error while generating the chat response.',
          details: errorMessage,
          status: upstreamResponse.status,
        },
        { status: upstreamResponse.status >= 500 ? 502 : 400 }
      )
    }

    if (!upstreamResponse.body) {
      return NextResponse.json(
        {
          error: 'OpenRouter returned an empty streaming response body.',
        },
        { status: 502 }
      )
    }

    return new NextResponse(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'

    return NextResponse.json(
      {
        error: 'The chat request could not be executed.',
        details: message,
      },
      { status: 500 }
    )
  }
}
