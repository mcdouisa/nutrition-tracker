import { NextResponse } from 'next/server'

// Configure for edge runtime for faster cold starts on mobile PWAs
export const runtime = 'edge'

export async function POST(request) {
  try {
    const { messages } = await request.json()

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured. Get a free key at groq.com' },
        { status: 500 }
      )
    }

    // Create abort controller with 25 second timeout for mobile
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    try {
      // Use vision model when any message contains an image
      const hasImage = messages.some(m =>
        Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')
      )
      // gpt-oss is text-only, so photos go to Groq's vision model
      const model = hasImage
        ? 'qwen/qwen3.8-27b'
        : 'openai/gpt-oss-120b'

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: messages,
          temperature: 0.1,
          max_tokens: 1200
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        console.error('Groq API error:', data)
        return NextResponse.json(
          { error: data.error?.message || 'Failed to get AI response' },
          { status: response.status }
        )
      }

      // Strip any visible reasoning some models prepend
      const content = String(data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      return NextResponse.json({ content })

    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. Please try again.' },
          { status: 408 }
        )
      }
      throw fetchError
    }

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Connection error. Please check your internet and try again.' },
      { status: 500 }
    )
  }
}
