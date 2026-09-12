import { expect, test } from '@playwright/test'

test('moderation preserves draft and prevents writes/escalation', async ({ page }) => {
  test.skip(process.env.E2E_MODERATION !== 'true', 'Opt-in: creates a synthetic account and claim')
  test.setTimeout(480000)
  const headers = { 'X-Requested-With': 'tender' }
  const registration = await page.request.post('/api/auth/register', {
    headers, data: { name: `moderation-${Date.now()}`, password: 'moderation-test-password-123' },
  })
  expect(registration.status()).toBe(201)
  await page.goto('/app')
  const input = page.getByLabel('Ваш вопрос', { exact: true })
  await input.fill('Какого хуя не работает?')
  let responsePromise = page.waitForResponse(r => r.url().endsWith('/api/tickets') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  let response = await responsePromise
  expect(response.status()).toBe(422)
  expect((await response.json()).detail.code).toBe('MESSAGE_BLOCKED')
  await expect(input).toHaveValue('Какого хуя не работает?')
  await expect(page.getByRole('alert')).toContainText('ненормативная лексика')
  expect((await (await page.request.get('/api/tickets')).json()).items).toHaveLength(0)
  await input.fill('Как загрузить машиночитаемую доверенность в профиль пользователя?')
  responsePromise = page.waitForResponse(r => r.url().endsWith('/api/tickets') && r.request().method() === 'POST', { timeout: 450000 })
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  response = await responsePromise
  expect(response.status()).toBe(201)
  const claim = await response.json()
  expect(claim.handling_level).toBe(0)
  await expect(page).toHaveURL(new RegExp(`/tickets/${claim.id}$`))
  const path = `/api/tickets/${claim.id}`
  const before = await (await page.request.get(path + '/messages')).json()
  const followup = page.getByLabel('Сообщение', { exact: true })
  await followup.fill('х.у.й')
  responsePromise = page.waitForResponse(r => r.url().endsWith(path + '/messages') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  expect((await responsePromise).status()).toBe(422)
  await expect(followup).toHaveValue('х.у.й')
  expect(await (await page.request.get(path + '/messages')).json()).toEqual(before)
  expect((await (await page.request.get(path)).json()).handling_level).toBe(0)
  await followup.fill('Уточните, пожалуйста.')
  responsePromise = page.waitForResponse(r => r.url().endsWith(path + '/messages') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  expect((await responsePromise).status()).toBe(201)
  await expect(followup).toHaveValue('')
  expect((await (await page.request.get(path)).json()).handling_level).toBe(1)
})
