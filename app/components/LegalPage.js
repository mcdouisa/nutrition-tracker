'use client'

// Shared layout for the Terms, Privacy Policy and Health Data Notice

import Link from 'next/link'
import { PageHeader } from './AppChrome'
import { DARK, FONT } from '../../lib/theme'
import { LEGAL } from '../../lib/legal'

export function LegalPage({ title, children }) {
  const T = DARK
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: T.bg, color: T.text, fontFamily: FONT }}>
      <PageHeader title={title} back="/" />
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '8px 16px 64px', fontSize: '15px', lineHeight: 1.6, color: T.soft }}>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: T.muted }}>
          Effective {LEGAL.effectiveDate} · Version {LEGAL.version}
        </p>
        {children}
        <nav aria-label="Legal documents" style={{ marginTop: '40px', paddingTop: '16px', borderTop: `1px solid ${T.border}`, display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px' }}>
          <Link href="/terms" style={{ color: T.soft }}>Terms of Service</Link>
          <Link href="/privacy" style={{ color: T.soft }}>Privacy Policy</Link>
          <Link href="/health-data" style={{ color: T.soft }}>Consumer Health Data Notice</Link>
        </nav>
      </main>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 500, color: DARK.text }}>{title}</h2>
      {children}
    </section>
  )
}

export const List = ({ items }) => (
  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
    {items.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}
  </ul>
)
