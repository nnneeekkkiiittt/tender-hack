import { clsx, type ClassValue } from 'clsx'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `Сегодня, ${time}`
  if (isYesterday) return `Вчера, ${time}`

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + `, ${time}`
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Открыта',
  IN_PROGRESS: 'В работе',
  WAITING_REPLY: 'Ожидает ответа',
  RESOLVED: 'Решена',
  CLOSED: 'Закрыта',
  CANCELLED: 'Отменена',
}

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
}

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  TECHNICAL: 'Технические вопросы',
  DOCUMENTS: 'Документы и требования',
  PROCUREMENT: 'Участие в закупке',
  ACCOUNT: 'Личный кабинет',
  CONTRACT: 'Контракты',
  OTHER: 'Прочее',
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Formats a duration in seconds as "4 мин 32 сек". The analytics backend's
 * SQL uses COALESCE(..., 0) when there are no samples, so an exact 0 is
 * indistinguishable from "no data" — a real operator interaction always
 * takes some non-zero time, so 0 is treated as no-data here. */
export function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds <= 0) return '—'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  if (minutes <= 0) return `${seconds} сек`
  return seconds > 0 ? `${minutes} мин ${seconds} сек` : `${minutes} мин`
}

/** Formats a duration in hours (as a float, e.g. 3.2) as "3 ч 12 мин".
 * Same 0-means-no-data convention as formatSeconds — see comment there. */
export function formatHours(totalHours: number | null | undefined): string {
  if (totalHours === null || totalHours === undefined || totalHours <= 0) return '—'
  const totalMinutes = Math.round(totalHours * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes} мин`
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`
}

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}
