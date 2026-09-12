import { expect, test } from '@playwright/test'

test('fresh demo: seeded accounts, queues, real or explicitly mocked answer', async ({ page }) => {
  test.skip(process.env.E2E_DEMO !== 'true', 'Opt-in: isolated seeded demo deployment')
  test.setTimeout(600000)
  const headers = { 'X-Requested-With': 'tender' }
  await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined }))
  await page.goto('/login')
  await page.getByRole('button', { name: 'Демо', exact: true }).click()
  await page.locator('#test-account-menu').getByRole('button', { name: /Consumer/ }).click()
  await expect(page).toHaveURL(/\/app$/)
  const claims = (await (await page.request.get('/api/tickets')).json()).items
  expect(claims.filter((c: { title: string }) => c.title.startsWith('[Демо]'))).toHaveLength(5)
  for (const role of ['supportL1', 'supportL2', 'supportL3']) {
    await page.request.post(`/api/auth/demo/${role}`, { headers, data: {} })
    const queue = (await (await page.request.get('/api/tickets?unassigned=true')).json()).items
    expect(queue.some((c: { title: string }) => c.title.startsWith('[Демо]'))).toBe(true)
    expect(queue.every((c: { handling_level: number }) => c.handling_level === Number(role.slice(-1)))).toBe(true)
  }
  await page.request.post('/api/auth/demo/user', { headers, data: {} })
  await page.goto('/app')
  const request = page.waitForResponse(r => r.url().endsWith('/api/tickets') && r.request().method() === 'POST', { timeout: 450000 })
  await page.getByLabel('Ваш вопрос', { exact: true }).fill('Как загрузить машиночитаемую доверенность в профиль пользователя?')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  const response = await request
  expect(response.status()).toBe(201)
  const claim = await response.json()
  expect(claim.handling_level).toBe(0)
  const messages = (await (await page.request.get(`/api/tickets/${claim.id}/messages`)).json()).items
  const ai = messages.find((m: { author_kind: string }) => m.author_kind === 'AI')
  if (process.env.E2E_REAL_ML === 'true') {
    expect(ai.text).not.toContain('Mock AI')
    expect(ai.text).toMatch(/xml/i)
    expect(ai.sources.length).toBeGreaterThan(0)
  } else {
    expect(ai.text).toContain('Mock AI')
  }
  console.log(JSON.stringify({ claim: claim.id, answer: ai.text, sources: ai.sources }))
  await expect(page.getByRole('region', { name: 'Оценка ответа AI' })).toBeVisible()
})
