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
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: messages,
          temperature: 0.7,
          max_tokens: 400 // Reduced for faster responses
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

      const content = data.choices?.[0]?.message?.content || ''

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
