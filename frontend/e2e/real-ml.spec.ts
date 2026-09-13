import { expect, test } from '@playwright/test'

test.use({ actionTimeout: 60000 })

test('real local ML: cited answer, shared reactions, staff handoff, automatic L3', async ({ page, browser, baseURL }) => {
  test.skip(process.env.E2E_REAL_ML !== 'true', 'Opt-in: requires the populated local ML deployment')
  test.setTimeout(600000)
  const headers = { 'X-Requested-With': 'tender' }
  const name = `ml-prototype-${Date.now()}`
  const registered = await page.request.post('/api/auth/register', {
    headers, data: { name, password: 'prototype-check-password-123' },
  })
  expect(registered.status()).toBe(201)
  await page.goto('/app')
  await page.getByLabel('Ваш вопрос', { exact: true }).fill('Как загрузить машиночитаемую доверенность в профиль пользователя?')
  const started = Date.now()
  const created = page.waitForResponse(r => r.url().endsWith('/api/tickets') && r.request().method() === 'POST', { timeout: 450000 })
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  const response = await created
  expect(response.status()).toBe(201)
  const claim = await response.json()
  expect(claim.handling_level).toBe(0)
  await expect(page).toHaveURL(new RegExp(`/tickets/${claim.id}$`))
  const path = `/api/tickets/${claim.id}`
  const messages = (await (await page.request.get(path + '/messages')).json()).items
  const ai = messages.find((m: { author_kind: string }) => m.author_kind === 'AI')
  expect(ai.text).not.toContain('Mock AI')
  expect(ai.text).toMatch(/xml/i)
  expect(ai.text).toContain('Операции с МЧД')
  expect(ai.sources.length).toBeGreaterThan(0)
  expect(ai.ml_context).toBeNull()
  console.log(JSON.stringify({ manualClaim: claim.id, username: name, seconds: (Date.now() - started) / 1000, answer: ai.text, sources: ai.sources }))
  await page.screenshot({ path: '/tmp/tender-real-ml-answer.png', fullPage: true })
  await page.reload()
  const reaction = page.getByRole('region', { name: 'Оценка ответа AI' })
  await reaction.getByRole('radio', { name: 'Хорошо' }).check()
  await reaction.getByRole('button', { name: 'Отправить оценку' }).click()
  await expect(reaction.getByText('Оценка сохранена')).toBeVisible()
  expect((await (await page.request.get(path)).json()).handling_level).toBe(0)
  await reaction.getByRole('radio', { name: 'Плохо' }).check()
  await expect(reaction.getByRole('button', { name: 'Отправить оценку' })).toBeDisabled()
  await reaction.getByLabel('Ответ устарел', { exact: true }).check()
  await reaction.getByRole('button', { name: 'Отправить оценку' }).click()
  await expect.poll(async () => (await (await page.request.get(path)).json()).handling_level).toBe(1)
  await page.request.post(path + '/messages', { headers, data: { text: 'Уточните, пожалуйста.' } })
  expect((await (await page.request.get(path)).json()).handling_level).toBe(1)

  const staffContext = await browser.newContext({ baseURL })
  const staff = await staffContext.newPage()
  try {
    const login = await staff.request.post('/api/auth/demo/supportL1', { headers })
    expect(login.status()).toBe(200)
    await staff.goto(`/support/tickets/${claim.id}`)
    await expect(staff.getByRole('region', { name: 'Контекст AI' })).toBeVisible()
    await staff.getByRole('button', { name: 'Взять в работу', exact: true }).click()
    await staff.getByPlaceholder('Написать ответ пользователю...').fill('Проверка L1: передаём вопрос профильному специалисту.')
    await staff.getByRole('button', { name: 'Отправить', exact: true }).click()
    await staff.getByTitle('Передать диалог оператору L2', { exact: true }).click()
    await staff.getByRole('dialog').getByRole('button', { name: 'Передать на L2', exact: true }).click()
    await expect.poll(async () => (await (await page.request.get(path)).json()).handling_level).toBe(2)
    await staff.screenshot({ path: '/tmp/tender-real-ml-support.png', fullPage: true })
    for (const level of [2, 3]) {
      // Fresh staff browser session for each queue; no mock data or API replies.
      expect((await staff.request.post(`/api/auth/demo/supportL${level}`, { headers })).status()).toBe(200)
      await staff.goto(`/support/tickets/${claim.id}`)
      await staff.getByRole('button', { name: 'Взять в работу', exact: true }).click()
      await staff.getByPlaceholder('Написать ответ пользователю...').fill(`Проверка L${level}: ответ сотрудника сохранён.`)
      await staff.getByRole('button', { name: 'Отправить', exact: true }).click()
      await expect(staff.getByText(`Проверка L${level}: ответ сотрудника сохранён.`, { exact: true })).toBeVisible()
      if (level === 2) {
        await staff.getByTitle('Передать диалог оператору L3', { exact: true }).click()
        await staff.getByRole('dialog').getByRole('button', { name: 'Передать на L3', exact: true }).click()
        await expect.poll(async () => (await (await page.request.get(path)).json()).handling_level).toBe(3)
      } else {
        await staff.getByRole('button', { name: 'Отметить решённым', exact: true }).click()
        await expect.poll(async () => (await (await page.request.get(path)).json()).status).toBe('DONE')
      }
    }
    await page.reload()
    await expect(page.getByText('Проверка L3: ответ сотрудника сохранён.', { exact: true })).toBeVisible()
    const humanReaction = page.getByRole('region', { name: 'Оценка работы сотрудника' })
    await humanReaction.getByRole('radio', { name: 'Хорошо' }).check()
    await humanReaction.getByRole('button', { name: 'Отправить оценку' }).click()
    await expect(humanReaction.getByText('Оценка сохранена')).toBeVisible()

    const incidentStart = Date.now()
    const incidentResponse = await page.request.post('/api/tickets', {
      headers, data: { text: 'Упал сервер портала, сервис недоступен всем пользователям.' }, timeout: 180000,
    })
    expect(incidentResponse.status()).toBe(201)
    const incident = await incidentResponse.json()
    expect(incident.handling_level).toBe(3)
    const incidentPath = `/api/tickets/${incident.id}`
    const history = (await (await page.request.get(incidentPath + '/messages')).json()).items
    expect(history.map((m: { author_kind: string }) => m.author_kind)).toEqual(['USER', 'AI', 'SYSTEM'])
    expect(history[2].text).toContain('L3')
    await page.request.put(`${incidentPath}/messages/${history[1].id}/feedback`, {
      headers, data: { like: false, reasons: ['INCORRECT ANSWER'] },
    })
    await page.request.post(incidentPath + '/messages', { headers, data: { text: 'Жду специалиста.' } })
    expect((await (await page.request.get(incidentPath)).json()).handling_level).toBe(3)
    await staff.request.post('/api/auth/demo/supportL3', { headers })
    await staff.goto(`/support/tickets/${incident.id}`)
    await expect(staff.getByRole('region', { name: 'Контекст AI' })).toContainText(/технический/i)
    await expect(staff.getByRole('button', { name: 'Взять в работу', exact: true })).toBeVisible()
    console.log(JSON.stringify({ incidentClaim: incident.id, seconds: (Date.now() - incidentStart) / 1000, level: 3 }))
  } finally {
    await staffContext.close()
  }
})
