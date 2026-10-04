import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * There is no Postgres in this environment, so `supabase/verify.sql` cannot be
 * executed before it reaches the dashboard. It has already shipped one typo
 * (`rowsecurity` instead of `relrowsecurity`) that only surfaced as a 42703
 * when a human ran it.
 *
 * This pins every catalogue column the script touches against the real
 * Postgres catalogue definitions, so the next typo fails here instead of in the
 * SQL editor.
 */

const verify = readFileSync('supabase/verify.sql', 'utf8')

/** Columns referenced from each system catalogue / view, from PG 15–17 docs. */
const CATALOG_COLUMNS: Record<string, Set<string>> = {
  pg_class: new Set([
    'oid', 'relname', 'relnamespace', 'relkind', 'relrowsecurity',
    'relforcerowsecurity', 'relowner', 'relispartition', 'reltablespace',
  ]),
  pg_namespace: new Set(['oid', 'nspname']),
  pg_policy: new Set(['oid', 'polname', 'polrelid', 'polcmd', 'polqual', 'polwithcheck']),
  pg_policies: new Set([
    'schemaname', 'tablename', 'policyname', 'permissive', 'roles', 'cmd',
    'qual', 'with_check',
  ]),
  pg_proc: new Set(['oid', 'proname', 'pronamespace', 'prosecdef', 'proconfig', 'prorettype']),
  pg_trigger: new Set([
    'oid', 'tgname', 'tgrelid', 'tgenabled', 'tgisinternal', 'tgtype',
  ]),
  pg_publication_tables: new Set(['pubname', 'schemaname', 'tablename']),
  storage: new Set(['id', 'public', 'file_size_limit']),
  buckets: new Set(['id', 'public', 'file_size_limit']),
}

describe('verify.sql uses real catalogue columns', () => {
  it('every <catalogue>.<column> reference exists', () => {
    // An alias may legitimately appear for more than one relation (CTEs reuse
    // short names), so collect every candidate and only complain when the
    // column is unknown for all of them.
    const aliases = new Map<string, string[]>()
    const aliasRe = /\b(?:from|join)\s+(pg_\w+|storage)\s+(\w+)/g
    let match: RegExpExecArray | null
    while ((match = aliasRe.exec(verify)) !== null) {
      const alias = match[2] as string
      const catalogue = match[1] as string
      aliases.set(alias, [...(aliases.get(alias) ?? []), catalogue])
    }
    aliases.set('buckets', ['storage'])

    expect([...aliases.keys()].length).toBeGreaterThan(4)

    const unknown: string[] = []
    const columnRe = /\b(\w+)\.(\w+)\b/g
    while ((match = columnRe.exec(verify)) !== null) {
      const [full, alias, column] = match
      const catalogues = aliases.get(alias as string)
      if (!catalogues) continue
      const known = catalogues.some((name) => CATALOG_COLUMNS[name]?.has(column as string))
      if (!known) {
        const where = catalogues.join(', ')
        unknown.push(`${full}  (no known column "${column}" on ${where})`)
      }
    }

    expect(unknown, `unknown catalogue columns in verify.sql:\n${unknown.join('\n')}`).toEqual([])
  })

  it('does not use the bare "rowsecurity" typo', () => {
    expect(verify).not.toMatch(/\browsecurity\b/)
    expect(verify).toMatch(/\brelrowsecurity\b/)
  })

  it('keeps every check read-only', () => {
    const writeVerbs =
      /^\s*(insert\s+into|update\s+\w+\s+set|delete\s+from|create\s|drop\s|alter\s|truncate\s|grant\s|revoke\s)/i
    // Comments are prose and legitimately contain words like "create".
    const code = verify.replace(/--[^\n]*/g, '')
    const offenders = code
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0 && writeVerbs.test(statement))

    expect(
      offenders,
      `verify.sql must not modify anything, found: ${offenders.join(' | ').slice(0, 200)}`,
    ).toEqual([])
  })

  it('covers the failure modes we have actually hit', () => {
    // Each of these was a real bug; a check for it must not be deleted.
    expect(verify).toContain('relrowsecurity')          // 42703 typo
    expect(verify).toContain('n.nspname')              // helpers moved to `private`
    expect(verify).toContain('prosecdef')              // SECURITY DEFINER recursion
    expect(verify).toContain('with_check')             // half-applied policy rewrite
    expect(verify).toMatch(/has_schema_privilege/)     // anon reaching `private`
  })
})