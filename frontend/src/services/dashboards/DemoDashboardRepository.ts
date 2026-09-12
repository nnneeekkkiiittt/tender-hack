import type { DashboardRepository } from './DashboardRepository'
import type { CreateDashboardPayload, DashboardTemplate } from '@/types'
import { demoStorage, DEMO_STORAGE_KEYS } from '@/lib/storage'
import { generateId } from '@/lib/utils'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const SEED_DASHBOARDS: DashboardTemplate[] = [
  {
    id: 'dash_ai_efficiency',
    name: 'Эффективность AI',
    description: 'Сколько обращений закрывает AI и по каким темам чаще всего приходится подключать оператора',
    ownerId: 'demo',
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    widgets: [
      { id: 'w1', title: 'Обращения по подтемам', metric: 'claims_count', dimension: 'subtopic', visualization: 'bar' },
      { id: 'w2', title: 'AI resolution по подтемам', metric: 'ai_resolved_percentage', dimension: 'subtopic', visualization: 'bar' },
    ],
  },
  {
    id: 'dash_support_load',
    name: 'Работа поддержки',
    description: 'Нагрузка по операторам и текущие аномалии',
    ownerId: 'demo',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    widgets: [{ id: 'w1', title: 'Обращения по операторам', metric: 'claims_count', dimension: 'operator', visualization: 'table' }],
  },
]

function loadAll(): DashboardTemplate[] {
  return demoStorage.get<DashboardTemplate[]>(DEMO_STORAGE_KEYS.dashboards, SEED_DASHBOARDS)
}

function saveAll(items: DashboardTemplate[]) {
  demoStorage.set(DEMO_STORAGE_KEYS.dashboards, items)
}

export class DemoDashboardRepository implements DashboardRepository {
  async list(): Promise<DashboardTemplate[]> {
    await wait(200)
    return [...loadAll()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  async get(id: string): Promise<DashboardTemplate | null> {
    await wait(150)
    return loadAll().find((d) => d.id === id) ?? null
  }

  async create(payload: CreateDashboardPayload): Promise<DashboardTemplate> {
    await wait(250)
    const nowIso = new Date().toISOString()
    const dashboard: DashboardTemplate = {
      id: generateId('dash'),
      name: payload.name,
      description: payload.description,
      ownerId: 'demo',
      createdAt: nowIso,
      updatedAt: nowIso,
      widgets: payload.widgets.map((w) => ({ ...w, id: generateId('w') })),
    }
    saveAll([dashboard, ...loadAll()])
    return dashboard
  }

  async update(id: string, payload: CreateDashboardPayload): Promise<DashboardTemplate> {
    await wait(250)
    const all = loadAll()
    const idx = all.findIndex((d) => d.id === id)
    if (idx === -1) throw new Error('Dashboard not found')
    const updated: DashboardTemplate = {
      ...all[idx],
      name: payload.name,
      description: payload.description,
      widgets: payload.widgets.map((w) => ({ ...w, id: generateId('w') })),
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    saveAll(all)
    return updated
  }

  async remove(id: string): Promise<void> {
    await wait(150)
    saveAll(loadAll().filter((d) => d.id !== id))
  }

  async getEmbedUrl(): Promise<string> {
    throw new Error('Metabase недоступен в demo mode — виджеты рендерятся локально')
  }
}
