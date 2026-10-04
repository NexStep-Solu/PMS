import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Supabase decides where confirmation/recovery links land using two dashboard
 * settings (Site URL and the Redirect URLs allowlist) plus the email template.
 * Our half of that is which path we *ask* for — and it must always be derived
 * from the current origin, because the app runs on localhost in development and
 * on a Vercel domain in production.
 *
 * A hardcoded host here would silently send every user's email to the wrong
 * place, which is exactly the class of bug these tests exist to prevent.
 */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

const files = sourceFiles('src').filter(
  (file) => !file.includes(`${'/'}test${'/'}`) && !file.includes('demo-accounts'),
)

describe('auth redirects are derived from the current origin', () => {
  it('no source file hardcodes a host or port for auth', () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      // Ignore the demo-credentials doc block and comment prose.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')

      if (/https?:\/\/localhost(:\d+)?/.test(code)) offenders.push(`${file}: localhost`)
      if (/:\/\/[a-z0-9-]+\.(supabase|vercel)\.app/.test(code)) {
        offenders.push(`${file}: hardcoded host`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('the two auth flows send origin-relative paths', () => {
    const queries = readFileSync('src/features/auth/queries.ts', 'utf8')
    expect(queries).toContain('window.location.origin')
    expect(queries).toContain('/reset-password')

    const register = readFileSync('src/features/auth/components/register-form.tsx', 'utf8')
    expect(register).toContain('window.location.origin')
    expect(register).toContain('/app/dashboard')
  })
})

describe('recovery landing route', () => {
  it('is mounted outside the auth guard so the recovery session survives', () => {
    const router = readFileSync('src/app/router.tsx', 'utf8')

    const resetRoute = router.indexOf('path="/reset-password"')
    expect(resetRoute).toBeGreaterThan(-1)

    // The guard wraps /app; the recovery route must appear before it.
    const guard = router.indexOf('<Route element={<RequireAuth />}>')
    expect(resetRoute).toBeGreaterThan(-1)
    expect(resetRoute).toBeLessThan(guard)
  })
})