// lib/theme.js — shared design tokens for every Lytz screen
// One quiet dark palette; color is reserved for meaning (done, over, water, categories).

export const FONT = "'Geist', -apple-system, BlinkMacSystemFont, sans-serif"

export const DARK = {
  bg:     '#0B0C0E',
  card:   '#15171A',
  card2:  '#1D2024',
  border: '#25282D',
  text:   '#F2F3F5',
  soft:   '#B4B8BF',
  muted:  '#8B9098',
  faint:  '#5A5F66',
  // Per-metric / per-category colors, cycled in order
  hues:   ['#E9E4D8', '#E58A5C', '#D77BB8', '#7CC8FF', '#B9A3FF', '#F2C94C'],
}

export const LIGHT = {
  bg:     '#F4F4F2',
  card:   '#FFFFFF',
  card2:  '#ECECEA',
  border: '#E2E2DF',
  text:   '#141518',
  soft:   '#3E4249',
  muted:  '#62666D',
  faint:  '#9A9EA4',
  hues:   ['#8A7F66', '#D0652F', '#B5509A', '#2E7BD6', '#7A5CE0', '#B8860B'],
}

// Status colors shared by both themes
export const DONE = '#B8F06A'      // goal reached, primary action
export const DONE_INK = '#0B0C0E'  // text on DONE
export const OVER = '#FF6B3D'      // limit exceeded, destructive
export const WARN = '#F2C94C'
export const WATER = '#2E7BD6'
export const SKY = '#7CC8FF'
export const VIOLET = '#B9A3FF'
export const CORAL = '#E58A5C'

// Token object in the shape the workout/groups pages were written against
export const C = {
  bg:         DARK.bg,
  card:       DARK.card,
  card2:      DARK.card2,
  border:     DARK.border,
  white:      DARK.text,
  text:       DARK.text,
  soft:       DARK.soft,
  muted:      DARK.muted,
  faint:      DARK.faint,
  accent:     DONE,
  accentInk:  DONE_INK,
  accentBg:   'rgba(184,240,106,0.12)',
  accentGlow: 'transparent',
  success:    DONE,
  successBg:  'rgba(184,240,106,0.12)',
  danger:     OVER,
  dangerBg:   'rgba(255,107,61,0.12)',
  purple:     VIOLET,
  purpleBg:   'rgba(185,163,255,0.12)',
  orange:     CORAL,
  orangeBg:   'rgba(229,138,92,0.12)',
}

export const font = { heading: FONT, body: FONT, mono: "'Geist Mono', ui-monospace, monospace" }
