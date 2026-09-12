import type { KnowledgeService } from './KnowledgeService'
import type { KnowledgeArticle } from '@/types'
import { KNOWLEDGE_ARTICLES } from '@/mock/knowledge.mock'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class DemoKnowledgeService implements KnowledgeService {
  async list(): Promise<KnowledgeArticle[]> {
    await wait(250)
    return KNOWLEDGE_ARTICLES
  }
}
