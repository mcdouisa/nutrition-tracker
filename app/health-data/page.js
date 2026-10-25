'use client'

import { LegalPage, Section, List } from '../components/LegalPage'
import { LEGAL, contactLine } from '../../lib/legal'

export default function HealthDataNotice() {
  const email = contactLine()
  return (
    <LegalPage title="Consumer Health Data Notice">
      <Section title="Why this notice exists">
        <p>Some states, including Washington (My Health My Data Act), Nevada and Connecticut, give you specific rights over "consumer health data." This notice explains how {LEGAL.appName}, run by {LEGAL.operator}, handles it. It is part of our Privacy Policy.</p>
      </Section>

      <Section title="Health data we collect">
        <List items={[
          'Food and nutrition you log (calories, protein, sugar and any nutrients you choose to track).',
          'Water intake, habits, body weight, and workouts.',
          'Setup details such as age range, sex, activity level, weight and goals.',
          'Food and label photos and voice notes you choose to send for nutrition estimates.',
        ]} />
      </Section>

      <Section title="Where it comes from">
        <p>Only from you, when you enter it, scan it, photograph it or say it in the app.</p>
      </Section>

      <Section title="Why we collect and use it">
        <p>Only to provide the features you use: tracking, progress, reports, nutrition estimates, groups you join, and keeping the service secure. We collect it only with your consent, which you give in the app before using Lytz.</p>
      </Section>

      <Section title="Who we share it with">
        <List items={[
          'Google Firebase (storage and sign-in) and Vercel (hosting), to run the app.',
          'Groq, only the food text, photo or voice note you send for an estimate, to produce that estimate.',
          'Members of a group you join, only what you choose to share with that group.',
        ]} />
        <p>We do not sell consumer health data, and we do not share it for advertising.</p>
      </Section>

      <Section title="Your rights">
        <List items={[
          'Confirm whether we collect or share your health data, and get a list of who we shared it with.',
          'Access it: Reports → Export → Download all days (CSV).',
          'Delete it: Goals → App settings → Delete account and data.',
          'Withdraw your consent: delete your data as above. You can stop using the app at any time.',
          `Ask us anything or appeal a decision: ${email}.`,
        ]} />
        <p>We'll respond within 45 days (sooner where the law requires) and won't treat you differently for exercising these rights.</p>
      </Section>
    </LegalPage>
  )
}
