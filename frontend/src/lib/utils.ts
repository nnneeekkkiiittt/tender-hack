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

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}
