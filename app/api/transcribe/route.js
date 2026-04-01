import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
    }

    const formData = await request.formData()
    const audio = formData.get('audio')

    if (!audio) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }

    const groqForm = new FormData()
    groqForm.append('file', audio)
    groqForm.append('model', 'whisper-large-v3-turbo')
    groqForm.append('response_format', 'json')
    groqForm.append('language', 'en')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: groqForm,
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Groq transcribe error:', data)
      return NextResponse.json(
        { error: data.error?.message || 'Transcription failed' },
        { status: response.status }
      )
    }

    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error('Transcribe route error:', error)
    return NextResponse.json({ error: 'Transcription failed. Please try again.' }, { status: 500 })
  }
}
