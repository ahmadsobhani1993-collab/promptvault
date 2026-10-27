// pf_li is a non-httpOnly flag cookie set by middleware when a session cookie exists.
// It lets the client skip auth requests for anonymous visitors.
export function hasLoginHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').includes('pf_li=1')
}