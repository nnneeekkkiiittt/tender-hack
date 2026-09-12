import type { KnowledgeArticle } from '@/types'

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  { id: 'kb_1', title: 'Как подать заявку', excerpt: 'Пошаговая инструкция по подаче заявки на участие в закупке.', category: 'PROCUREMENT' },
  { id: 'kb_2', title: 'Вопрос по документам', excerpt: 'Какие документы требуются для регистрации и участия.', category: 'DOCUMENTS' },
  { id: 'kb_3', title: 'Требования к поставщику', excerpt: 'Квалификационные требования по категориям закупок.', category: 'PROCUREMENT' },
  { id: 'kb_4', title: 'Срок рассмотрения', excerpt: 'Сроки рассмотрения заявок и обращений в поддержку.', category: 'OTHER' },
  { id: 'kb_5', title: 'Техническая ошибка', excerpt: 'Что делать при технических сбоях на Портале.', category: 'TECHNICAL' },
  { id: 'kb_6', title: 'Как работает электронная подпись', excerpt: 'Требования к ЭЦП и порядок подписания документов.', category: 'TECHNICAL' },
]
