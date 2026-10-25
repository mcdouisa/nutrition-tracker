'use client'

import Link from 'next/link'
import { LegalPage, Section, List } from '../components/LegalPage'
import { LEGAL, contactLine } from '../../lib/legal'

export default function Terms() {
  const email = contactLine()
  return (
    <LegalPage title="Terms of Service">
      <Section title="The agreement">
        <p>These terms are an agreement between you and {LEGAL.operator}, who runs {LEGAL.appName}. By using Lytz you agree to them and to our <Link href="/privacy" style={{ color: 'inherit' }}>Privacy Policy</Link>. If you don't agree, please don't use Lytz.</p>
      </Section>

      <Section title="Who can use Lytz">
        <p>You must be at least {LEGAL.minimumAge}. If you're under 18, a parent or guardian must agree to these terms for you.</p>
      </Section>

      <Section title="Not medical advice">
        <p>Lytz is a tracking tool for general wellness and awareness. It does not diagnose, treat or prevent any condition, and it is not a substitute for a doctor, registered dietitian or other professional. Talk to a professional before changing your diet or exercise, especially if you are pregnant, have a medical condition, a history of disordered eating, or food allergies. If you think you're having a medical emergency, call your local emergency number.</p>
      </Section>

      <Section title="Estimates can be wrong">
        <p>Nutrition numbers from AI, photos, barcodes and food searches are estimates and may be inaccurate. Always check labels yourself, especially for allergens, and correct any numbers in the app. Don't rely on Lytz to decide whether a food is safe for you.</p>
      </Section>

      <Section title="Your account">
        <List items={[
          'Keep your password private; you are responsible for activity on your account.',
          'Give accurate information and keep your email up to date.',
          'You can delete your account at any time in App settings.',
        ]} />
      </Section>

      <Section title="Acceptable use">
        <p>Don't misuse Lytz. For example, don't:</p>
        <List items={[
          "access other people's data or accounts, or try to get around security or usage limits;",
          'use the AI features for anything other than food, nutrition and fitness tracking, or send them unlawful or harmful content;',
          'scrape, overload, reverse engineer or disrupt the service;',
          'post anything in groups or public programs that is unlawful, harassing, or infringes someone else\'s rights.',
        ]} />
        <p>We may suspend or close accounts that break these rules.</p>
      </Section>

      <Section title="Your content">
        <p>You own what you log and create. You give us permission to store and process it only to provide Lytz to you. If you publish a workout program to Discover, you let other Lytz users view and copy it within the app.</p>
      </Section>

      <Section title="The service">
        <p>Lytz is currently free. We may change, add or remove features, and we may stop offering the service; if we do, we'll give reasonable notice where we can so you can export your data. If we ever introduce paid features, we'll show the price and terms clearly before you pay.</p>
      </Section>

      <Section title="Disclaimers">
        <p>Lytz is provided "as is" and "as available." To the fullest extent the law allows, we disclaim all warranties, including fitness for a particular purpose, accuracy of nutrition information, and uninterrupted or error-free service.</p>
      </Section>

      <Section title="Limits on liability">
        <p>To the fullest extent the law allows, {LEGAL.operator} won't be liable for indirect, incidental, special, consequential or punitive damages, or for loss of data, health outcomes, or decisions you make based on information in Lytz. Our total liability for any claim is limited to the greater of $50 or the amount you paid us in the 12 months before the claim. Some places don't allow these limits, so they may not apply to you.</p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of the State of {LEGAL.state}, without regard to conflict-of-law rules. Disputes will be handled in the state or federal courts located in {LEGAL.state}, except where your local law gives you the right to bring a claim where you live.</p>
      </Section>

      <Section title="Changes to these terms">
        <p>If we change these terms in a meaningful way, we'll ask you to review and accept them again in the app before you continue.</p>
      </Section>

      <Section title="Contact">
        <p>{email}</p>
      </Section>
    </LegalPage>
  )
}
