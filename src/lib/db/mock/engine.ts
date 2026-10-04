/**
 * Minimal PostgREST-compatible query evaluator for the in-memory demo backend.
 *
 * Supports exactly the surface the PMS uses: filters, `or()` strings,
 * ordering, limit/offset, `count: 'exact'`, `single()`/`maybeSingle()` and
 * embedded resources via `alias:table!hint(columns)`.
 */

import type { Row } from '../contract'
import { resolveRelation } from './relations'

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'not_in'
  | 'is'
  | 'not_is'
  | 'contains'
  | 'overlaps'

export interface Filter {
  op: FilterOp
  column: string
  value: unknown
}

export type QueryMode = 'select' | 'insert' | 'update' | 'delete'
export type SingleMode = 'single' | 'maybeSingle' | null

export interface QueryPlan {
  table: string
  mode: QueryMode
  /** Raw select expression; `null` means "return no rows". */
  select: string | null
  countExact: boolean
  filters: Filter[]
  orFilters: string[]
  order: { column: string; ascending: boolean }[]
  limit: number | null
  offset: number
  single: SingleMode
  insertRows: Row[] | null
  patch: Row | null
}

export interface Store {
  table(name: string): Row[]
  rows(table: string, filter: (row: Row) => boolean): Row[]
}

export interface QueryOutcome {
  data: Row[]
  count: number
}

/* ------------------------------------------------------------------ */
/* SQL LIKE                                                            */
/* ------------------------------------------------------------------ */

/**
 * Both wildcards are accepted because PostgREST uses `*` inside an `or(...)`
 * expression while a plain `like` uses SQL's `%`. The demo has to behave like the
 * real API here, or a query that works against Supabase silently matches nothing
 * in demo mode.
 */
function likeToRegExp(pattern: string, flags: 'i' | ''): RegExp {
  let out = ''
  for (const char of pattern) {
    if (char === '%' || char === '*') out += '[\\s\\S]*'
    else if (char === '_') out += '[\\s\\S]'
    else out += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, flags)
}

/* ------------------------------------------------------------------ */
/* Small parsing helpers                                                */
/* ------------------------------------------------------------------ */

function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of input) {
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    if (char === separator && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter((part) => part.length > 0)
}

function readValue(row: Row, path: string): unknown {
  if (!path.includes('.')) return row[path]
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Row)[key]
    return undefined
  }, row)
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

function matchesFilter(row: Row, filter: Filter): boolean {
  const value = readValue(row, filter.column)
  const target = filter.value

  switch (filter.op) {
    case 'eq':
      return value === target
    case 'neq':
      return value !== target
    case 'gt':
      return value !== null && value !== undefined && compare(value, target) > 0
    case 'gte':
      return value !== null && value !== undefined && compare(value, target) >= 0
    case 'lt':
      return value !== null && value !== undefined && compare(value, target) < 0
    case 'lte':
      return value !== null && value !== undefined && compare(value, target) <= 0
    case 'like':
      return typeof value === 'string' && likeToRegExp(String(target), '').test(value)
    case 'ilike':
      return typeof value === 'string' && likeToRegExp(String(target), 'i').test(value)
    case 'in':
      return Array.isArray(target) && target.includes(value as never)
    case 'not_in':
      return Array.isArray(target) && !target.includes(value as never)
    case 'is':
      return target === null ? value === null || value === undefined : value === target
    case 'not_is':
      return target === null ? value !== null && value !== undefined : value !== target
    case 'contains':
      if (Array.isArray(value)) return (target as unknown[]).every((v) => value.includes(v))
      return typeof value === 'string' && value.includes(String(target))
    case 'overlaps':
      return Array.isArray(value) && Array.isArray(target)
        ? target.some((v) => value.includes(v))
        : false
    default:
      return false
  }
}

export function rowMatches(row: Row, filters: Filter[], orFilters: string[]): boolean {
  return filters.every((filter) => matchesFilter(row, filter)) && orFilters.every((expr) => matchesOr(row, expr))
}

/**
 * Evaluates the subset of PostgREST `or=` syntax the app emits:
 * `or=(a.eq.1,b.eq.2)` — at least one branch has to match.
 */
function matchesOr(row: Row, expression: string): boolean {
  const branches = splitTopLevel(expression, ',')
  if (branches.length === 0) return true
  return branches.some((branch) => {
    const match = /^([A-Za-z0-9_.]+)\.(eq|neq|gt|gte|lt|lte|like|ilike|is|not\.is|not\.eq)\.(.*)$/.exec(
      branch,
    )
    if (!match) return false
    const column = match[1]
    const op = match[2]
    const raw = match[3]
    if (!column || !op) return false
    const opKey: FilterOp = op === 'not.is' ? 'not_is' : op === 'not.eq' ? 'neq' : (op as FilterOp)
    return matchesFilter(row, { op: opKey, column, value: raw === 'null' ? null : raw })
  })
}

/* ------------------------------------------------------------------ */
/* Projection                                                           */
/* ------------------------------------------------------------------ */

interface EmbedSpec {
  alias: string
  /** Table the embedded rows come from. */
  table: string
  /** Column read from the base row. */
  baseColumn: string
  /** Column compared against `baseColumn` on the embedded table. */
  targetColumn: string
  cardinality: 'one' | 'many'
}

/**
 * Parses embedded resource specs out of a select expression.
 * `assignee:profiles!tasks_assignee_id_fkey(full_name)` means: on the base
 * table, find the FK pointing at `profiles` (disambiguated by the hint) and
 * embed the matching row(s) under the alias `assignee`.
 */
function compileEmbeds(baseTable: string, expression: string): EmbedSpec[] {
  const specs: EmbedSpec[] = []
  for (const part of splitTopLevel(expression, ',')) {
    const openIndex = part.indexOf('(')
    if (openIndex === -1) continue
    const target = part.slice(0, openIndex).trim()
    const aliasWithTarget = target.includes(':') ? target : target
    const colonIndex = aliasWithTarget.indexOf(':')
    const alias = colonIndex === -1 ? undefined : aliasWithTarget.slice(0, colonIndex).trim()
    const rawTarget = colonIndex === -1 ? aliasWithTarget : aliasWithTarget.slice(colonIndex + 1).trim()
    const bangIndex = rawTarget.indexOf('!')
    const parentTable = bangIndex === -1 ? rawTarget : rawTarget.slice(0, bangIndex).trim()
    const hint = bangIndex === -1 ? undefined : rawTarget.slice(bangIndex + 1).trim()

    // Many-to-one: the base table holds the foreign key.
    // Many-to-one: the base table holds the foreign key.
    const relation = resolveRelation(baseTable, parentTable, hint)
    if (relation) {
      specs.push({
        alias: alias && alias.length > 0 ? alias : parentTable,
        table: parentTable,
        baseColumn: relation.childColumn,
        targetColumn: relation.parentColumn,
        cardinality: 'one',
      })
    }

    // One-to-many: the named table holds the foreign key back to the base row.
    const reverse = resolveRelation(parentTable, baseTable, hint)
    if (reverse) {
      specs.push({
        alias: alias && alias.length > 0 ? alias : parentTable,
        table: parentTable,
        baseColumn: reverse.parentColumn,
        targetColumn: reverse.childColumn,
        cardinality: 'many',
      })
    }
  }
  return specs
}

function project(row: Row, expression: string, store: Store, table: string): Row {
  const trimmed = expression.trim()
  if (!trimmed || trimmed === '*') return { ...row }

  const parts = splitTopLevel(trimmed, ',')

  // `*, rel(...)` — a bare `*` selects every column of the base row.
  const wantsAllColumns = parts.some((part) => part === '*')
  const output: Row = wantsAllColumns ? { ...row } : {}

  for (const part of parts) {
    if (part === '*') continue
    const openIndex = part.indexOf('(')
    if (openIndex !== -1) continue
    const colonIndex = part.indexOf(':')
    const path = colonIndex === -1 ? part : part.slice(0, colonIndex)
    const alias = colonIndex === -1 ? part : part.slice(colonIndex + 1)
    if (!path) continue
    output[alias] = readValue(row, path)
  }

  for (const embed of compileEmbeds(table, trimmed)) {
    const key = readValue(row, embed.baseColumn)
    const matches = (candidate: Row) => candidate[embed.targetColumn] === key

    output[embed.alias] =
      embed.cardinality === 'one'
        ? key === null || key === undefined
          ? null
          : (store.rows(embed.table, matches)[0] ?? null)
        : store.rows(embed.table, matches)
  }

  return output
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export function execute(plan: QueryPlan, store: Store): QueryOutcome {
  const table = store.table(plan.table)

  if (plan.mode === 'insert') {
    const now = new Date().toISOString()
    const inserted: Row[] = (plan.insertRows ?? []).map((input) => {
      const row: Row = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...input }
      if (typeof row.created_at === 'undefined') row.created_at = now
      return row
    })
    table.unshift(...inserted)
    const wantsRows = plan.select !== null
    return {
      data: wantsRows ? inserted.map((row) => project(row, plan.select ?? '*', store, plan.table)) : [],
      count: inserted.length,
    }
  }

  let matched = table.filter((row) => rowMatches(row, plan.filters, plan.orFilters))

  const count = matched.length

  if (plan.order.length > 0) {
    matched = [...matched].sort((a, b) => {
      for (const { column, ascending } of plan.order) {
        const result = compare(readValue(a, column), readValue(b, column))
        if (result !== 0) return ascending ? result : -result
      }
      return 0
    })
  }

  if (plan.offset > 0) matched = matched.slice(plan.offset)
  if (plan.limit !== null) matched = matched.slice(0, plan.limit)

  if (plan.mode === 'update' && plan.patch) {
    const now = new Date().toISOString()
    matched.forEach((row) => {
      Object.assign(row, plan.patch)
      row.updated_at = now
    })
  }

  const wantsRows = plan.select !== null
  const data = wantsRows
    ? matched.map((row) => project(row, plan.select ?? '*', store, plan.table))
    : []

  if (plan.mode === 'delete') {
    for (const row of matched) {
      const index = table.indexOf(row)
      if (index >= 0) table.splice(index, 1)
    }
  }

  return { data, count: wantsRows ? count : matched.length }
}

/** Normalises PostgREST `filter(column, op, value)` strings into filter ops. */
export function normaliseFilterOp(operator: string): FilterOp {
  const map: Record<string, FilterOp> = {
    eq: 'eq',
    '=': 'eq',
    neq: 'neq',
    '!=': 'neq',
    gt: 'gt',
    '>': 'gt',
    gte: 'gte',
    '>=': 'gte',
    lt: 'lt',
    '<': 'lt',
    lte: 'lte',
    '<=': 'lte',
    like: 'like',
    ilike: 'ilike',
    in: 'in',
    'in.(a,b)': 'in',
    'not.in': 'not_in',
    is: 'is',
    'not.is': 'not_is',
    contains: 'contains',
    overlaps: 'overlaps',
  }
  const normalised = operator.replace(/\s+/g, '')
  const direct = map[normalised] ?? map[normalised.toLowerCase()]
  if (direct) return direct
  if (normalised.startsWith('not.in')) return 'not_in'
  if (normalised.startsWith('not.is')) return 'not_is'
  if (normalised.startsWith('not.eq')) return 'neq'
  return 'eq'
}

/** Parses `'(a,b)'` / `'a,b'` payloads produced by `in.()` filters. */
export function parseListValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  return value
    .replace(/^\((.*)\)$/, '$1')
    .replace(/^\[(.*)\]$/, '$1')
    .split(',')
    .map((item) => item.trim().replace(/^"|"$/g, ''))
}