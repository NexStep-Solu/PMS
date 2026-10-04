import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1)
  const unit = BYTE_UNITS[exponent] ?? 'B'
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${unit}`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/** Stable, readable colour index derived from a string (avatar fallbacks). */
export function stringHash(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const output = {} as Record<K, T[]>
  for (const item of items) {
    const bucket = key(item)
    output[bucket] ??= []
    output[bucket].push(item)
  }
  return output
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Normalise a form value for a nullable column.
 *
 * `??` is not enough here: `''` is neither null nor undefined, so
 * `value ?? null` happily sends an empty string to Postgres and you get
 * `invalid input syntax for type uuid: ""`. Selects and date pickers produce
 * empty strings far more often than you would expect.
 */
export function nullable<T>(value: T | null | undefined | ''): T | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && (value as string).trim() === '') return null
  return value as T
}

/** Like {@link nullable}, but `undefined` is preserved as `undefined`. */
export function optionalNullable<T>(value: T | null | undefined | ''): T | null | undefined {
  if (value === undefined) return undefined
  return nullable(value)
}
