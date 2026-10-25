/** @type {import('next').NextConfig} */

// Browser security headers on every page and API route
const securityHeaders = [
  // Nobody can embed Lytz in a frame (stops click-tricking)
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Browsers must not guess file types
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs to other sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Only Lytz itself may use the camera and microphone; nothing else is allowed
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
  // Always use HTTPS
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
