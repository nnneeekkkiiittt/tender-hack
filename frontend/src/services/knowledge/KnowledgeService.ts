import type { KnowledgeArticle } from '@/types'

export interface KnowledgeService {
  list(): Promise<KnowledgeArticle[]>
}
