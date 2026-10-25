// lib/legal.js — the details the Terms, Privacy Policy and Health Data Notice use.
// Changing `version` makes everyone accept the documents again the next time they open Lytz.

export const LEGAL = {
  version: '2026-10-25',
  effectiveDate: 'October 25, 2026',
  appName: 'Lytz',
  operator: 'Isaac McDougal',
  state: 'Utah',
  minimumAge: 13,
  // REQUIRED before shipping: the public support address for privacy, deletion and help requests
  contactEmail: '',
}

export const contactLine = () =>
  LEGAL.contactEmail ? LEGAL.contactEmail : '[support email not set yet]'
