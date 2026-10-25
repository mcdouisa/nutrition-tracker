'use client'

import Link from 'next/link'
import { LegalPage, Section, List } from '../components/LegalPage'
import { LEGAL, contactLine } from '../../lib/legal'

export default function PrivacyPolicy() {
  const email = contactLine()
  return (
    <LegalPage title="Privacy Policy">
      <Section title="Who we are">
        <p>{LEGAL.appName} is a nutrition, habit and workout tracker run by {LEGAL.operator} ("we", "us"). This policy explains what we collect, why, who helps us run the app, and the choices you have. Questions or requests: <strong>{email}</strong>.</p>
      </Section>

      <Section title="What we collect">
        <List items={[
          'Account details: your email address and password (passwords are handled by Google Firebase Authentication; we never see them).',
          'What you log: foods and nutrition amounts, water, habits, body weight, goals, saved meals, workouts, programs and notes.',
          'Setup answers you choose to give, such as age range, sex, activity level, weight and goals.',
          'Content you send to the AI: food descriptions, food or label photos, and voice notes (turned into text).',
          'Group activity, if you join a group: your display name, check-ins, and anything you choose to share with that group (for example, weight).',
          'Feedback and bug reports you send, with your email so we can reply.',
          'Basic technical data needed to run the service, such as server logs from our hosting provider.',
        ]} />
        <p>We do not use advertising, ad tracking, or analytics that follow you across other apps or sites.</p>
      </Section>

      <Section title="How we use it">
        <List items={[
          'To provide the app: save and sync your logs, show your progress and reports, and run features you use.',
          'To estimate nutrition from text, photos, barcodes and voice when you ask.',
          'To keep the service secure, prevent abuse, and fix problems.',
          'To answer your feedback and support requests.',
        ]} />
        <p>We do not sell your personal information, and we do not use your health information for advertising.</p>
      </Section>

      <Section title="Who helps us run Lytz">
        <p>We share information only with service providers that process it for us under their terms, and only what each needs:</p>
        <List items={[
          'Google Firebase (Google LLC): account sign-in and secure storage of your data.',
          'Vercel Inc.: hosting the app and its servers.',
          'Groq, Inc.: AI processing of the food text, photos and voice notes you choose to send. We send the content of that request and the names of the nutrients you track, not your email or history.',
          'Open Food Facts: when you scan a barcode, the barcode number is looked up in their public database. Product data © Open Food Facts contributors, available under the Open Database License (ODbL).',
        ]} />
        <p>We may also disclose information if the law requires it, to protect someone's safety, or as part of transferring the app to a new owner (who would be bound by this policy).</p>
      </Section>

      <Section title="Groups and public programs">
        <p>Anything you share in a group is visible to that group's members. Weight sharing is off unless you turn it on. Workout programs you publish to Discover are visible to other Lytz users.</p>
      </Section>

      <Section title="How long we keep it">
        <p>We keep your information while you have an account. When you delete your account, we delete your logs, settings, profile, group memberships, public programs and feedback right away from the app's database; copies in our providers' backups expire on their normal schedules.</p>
      </Section>

      <Section title="Your choices and rights">
        <List items={[
          'Download your data: Reports → Export → Download all days (CSV).',
          'Correct your data: edit any entry, goal or setting in the app.',
          'Delete your account and data: Goals → App settings → Delete account and data. Without an account, you can delete everything stored on your device the same way.',
          'Withdraw consent for health data: delete your data as above, or email us.',
          `Other requests (for example, under California, Washington, Colorado, Connecticut, Nevada, Utah or other state privacy laws): email ${email}. We'll respond within the time the law requires and won't treat you differently for asking. You can appeal a decision by replying to our answer.`,
        ]} />
      </Section>

      <Section title="Data on your device">
        <p>Lytz keeps a copy of your data on your device so it works offline. Signing out erases it from that device. If you use Lytz without an account, your data lives only on that device.</p>
      </Section>

      <Section title="Security">
        <p>Data is sent over encrypted connections and stored with access rules so each person can only reach their own data. No system is perfectly secure; if a breach affects your information, we'll notify you as the law requires.</p>
      </Section>

      <Section title="Children">
        <p>Lytz is not for children under {LEGAL.minimumAge}. If you're under 18, you need a parent or guardian's permission. If you believe a child under {LEGAL.minimumAge} has given us information, email {email} and we'll delete it.</p>
      </Section>

      <Section title="Health information">
        <p>Some of what you log is health-related. Our <Link href="/health-data" style={{ color: 'inherit' }}>Consumer Health Data Notice</Link> explains exactly how we handle it.</p>
      </Section>

      <Section title="Changes">
        <p>If we change this policy in a meaningful way, we'll ask you to review and accept it again in the app before you continue.</p>
      </Section>
    </LegalPage>
  )
}
