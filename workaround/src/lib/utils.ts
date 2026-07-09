import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const delta = Date.now() - Date.parse(iso)
  if (delta >= YEAR_MS) return `${Math.floor(delta / YEAR_MS)}y ago`
  if (delta >= MONTH_MS) return `${Math.floor(delta / MONTH_MS)}mo ago`
  if (delta >= DAY_MS) return `${Math.floor(delta / DAY_MS)}d ago`
  return 'today'
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}
