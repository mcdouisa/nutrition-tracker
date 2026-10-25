import { NextResponse } from 'next/server'
import { guardAiRequest, tooLarge, tooLargeResponse, aiErrorResponse } from '../../../lib/serverGuard'

// Voice notes are short; 10 MB is several minutes of audio
const MAX_AUDIO = 10 * 1024 * 1024

export async function POST(request) {
  if (tooLarge(request, MAX_AUDIO + 100_000)) return tooLargeResponse()
  const guard = await guardAiRequest(request)
  if (guard.response) return guard.response
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return aiErrorResponse(500)

    const formData = await request.formData()
    const audio = formData.get('audio')

    if (!audio || typeof audio === 'string') {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO) return tooLargeResponse()

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
      console.error('Groq transcribe error:', data?.error?.message || response.status)
      return aiErrorResponse(response.status === 429 ? 429 : 502)
    }

    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error('Transcribe route error:', error?.message)
    return NextResponse.json({ error: 'Transcription failed. Please try again.' }, { status: 500 })
  }
}
