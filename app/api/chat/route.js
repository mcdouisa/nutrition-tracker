import { NextResponse } from 'next/server'

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
        max_tokens: 500
      })
    })

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

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
