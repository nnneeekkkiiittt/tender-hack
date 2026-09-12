import { API_URL } from '@/config/env'

export type Role = 'user' | 'admin' | 'supportL1' | 'supportL2' | 'supportL3'
export interface User {
  id: string
  name: string
  role: Role
}
export type Status = 'NEW' | 'IN WORK' | 'DONE' | 'CANCELLED'
export const statuses: Record<Status, string> = {
  NEW: 'Новое',
  'IN WORK': 'В работе',
  DONE: 'Решено',
  CANCELLED: 'Отменено',
}
export const topics = {
  TECHNICAL: 'Технический вопрос',
  DOCUMENTS: 'Документы',
  PROCUREMENT: 'Закупки',
  ACCOUNT: 'Личный кабинет',
  CONTRACT: 'Контракт',
  OTHER: 'Другое',
}
export type Topic = keyof typeof topics
export const reasons = {
  'SLOW WORK': 'Медленная работа',
  'INCORRECT ANSWER': 'Неверный ответ',
  'IRRELEVANT ANSWER': 'Ответ не по теме',
  'RUDE BEHAVIOUR': 'Грубое общение',
}
export interface Ticket {
  id: string
  author_id: string
  author_name: string
  title: string
  topic: Topic
  subtopic: string | null
  status: Status
  operator_id: string | null
  operator_name: string | null
  handling_level: 0 | 1 | 2 | 3
  created_at: string
  updated_at: string
  assigned_at: string | null
  resolved_at: string | null
  cancelled_at: string | null
}
export interface MlContext {
  user_query: string
  classified_line: 'L1' | 'L2' | 'L3' | 'OUT_OF_SCOPE'
  confidence: number
  topic: string
  subtopic: string | null
  escalation_reason: string | null
  sources_found: { doc_name: string; breadcrumb: string; page: number | null; page_end?: number | null; score: number }[]
}
export interface Message {
  id: string
  author_id: string | null
  author_name: string | null
  author_kind: string
  text: string
  sent_at: string
  sources: string[]
  disliked: boolean
  liked: boolean
  reaction: Rating | null
  ml_context?: MlContext | null
}
export interface MessagePage {
  items: Message[]
  next_before: string | null
}
export interface Page<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}
export interface ReactionInput {
  like: boolean
  reasons: string[]
}
export interface Rating extends ReactionInput {
  id: string
  claim_id: string
  submitted_by: string
  target_kind: 'AI_MESSAGE' | 'OPERATOR'
  message_id: string | null
  operator_id: string | null
  like: boolean
  reasons: string[]
}
export interface Answer {
  answer: string
  sources: string[]
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL(API_URL.replace(/\/$/, '') + path, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value))
  })
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'tender' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = payload?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((item: { msg: string }) => item.msg).join('; ')
          : `Ошибка сервера (${response.status})`
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'))
    throw new ApiError(response.status, message)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
