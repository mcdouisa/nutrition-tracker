import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Food search for the one-step "What did you eat?" sheet.
// Returns a few likely matches, each with one serving's values for the user's own metrics.
export async function POST(request) {
  try {
    const { query, metrics } = await request.json()
    const q = String(query || '').trim().slice(0, 120)
    if (q.length < 2) return NextResponse.json({ results: [] })

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
    }

    const metricList = (Array.isArray(metrics) && metrics.length > 0 ? metrics : [
      { key: 'calories', name: 'Calories', unit: '' },
      { key: 'protein', name: 'Protein', unit: 'g' },
    ]).slice(0, 20)
    const keys = Object.fromEntries(metricList.map(m => [String(m.key), 0]))
    const described = metricList.map(m => `${m.key} = ${m.name}${m.unit ? ` (${m.unit})` : ''}`).join('; ')

    const system = `You are a precise nutrition database (USDA values for generic foods, official published data for brands and restaurants).
Given a food search, return the 4 most likely matches, most common first: generic versions before brands, and include a popular brand or restaurant version when the search names one.
Each match has one realistic serving with a household measure and weight, e.g. "1 cup (170 g)" or "1 sandwich".
Give values for that one serving for these metrics: ${described}.
"Added sugar" means sugar added during processing, not natural sugar. Never inflate values.
Reply with JSON only, no prose: {"results":[{"name":"...","serving":"...","values":${JSON.stringify(keys)}}]}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'system', content: system }, { role: 'user', content: q }],
          temperature: 0.1,
          max_tokens: 1500
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await response.json()
      if (!response.ok) {
        return NextResponse.json({ error: data.error?.message || 'Search failed' }, { status: response.status })
      }

      const content = data.choices?.[0]?.message?.content || ''
      const start = content.indexOf('{')
      const end = content.lastIndexOf('}')
      if (start < 0 || end < start) return NextResponse.json({ results: [] })

      const parsed = JSON.parse(content.slice(start, end + 1))
      const results = (parsed.results || []).slice(0, 4).map(r => ({
        name: String(r.name || '').slice(0, 80),
        serving: String(r.serving || '1 serving').slice(0, 40),
        values: Object.fromEntries(metricList.map(m => {
          const v = Number(r.values?.[m.key])
          return [m.key, Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0]
        }))
      })).filter(r => r.name)

      return NextResponse.json({ results })
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        return NextResponse.json({ error: 'Search timed out. Try again.' }, { status: 408 })
      }
      throw err
    }
  } catch (error) {
    console.error('Food search error:', error)
    return NextResponse.json({ error: 'Could not search right now.' }, { status: 500 })
  }
}
