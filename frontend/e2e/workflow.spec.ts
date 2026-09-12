import { test, expect, type Page } from '@playwright/test'

test('original layouts, paginated queues and older claim messages', async ({ page, baseURL }) => {
  // Public HTTP origins lack randomUUID, unlike localhost/HTTPS.
  await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined }))
  const name = `pages-${Date.now()}`
  const headers = { 'X-Requested-With': 'tender' }
  expect(
    (
      await page.request.post(`${baseURL}/api/auth/register`, {
        headers,
        data: { name, password: 'paging-password-123' },
      })
    ).ok(),
  ).toBe(true)
  const ids: string[] = []
  for (let n = 0; n < 21; n++) {
    const response = await page.request.post(`${baseURL}/api/tickets`, {
      headers,
      data: { text: `Page claim ${n}`, topic: 'TECHNICAL' },
    })
    expect(response.status()).toBe(201)
    ids.push((await response.json()).id)
  }
  for (let n = 0; n < 52; n++) {
    expect(
      (
        await page.request.post(`${baseURL}/api/tickets/${ids[0]}/messages`, {
          headers,
          data: { text: `History message ${n}` },
        })
      ).status(),
    ).toBe(201)
  }
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Чем я могу помочь?' })).toBeVisible()
  expect((await page.locator('aside').boundingBox())?.width).toBe(256)
  expect((await page.locator('header').boundingBox())?.height).toBe(64)
  await expect(page.getByRole('button', { name: 'Как принять участие в закупке?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Уведомления' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Добавить вложение' })).toBeDisabled()
  await page.screenshot({ path: '/tmp/tender-adapted-home.png', fullPage: true })
  await page.getByRole('link', { name: 'Мои заявки', exact: true }).click()
  await expect(page.getByText('Всего: 21')).toBeVisible()
  await expect(page.getByText('Page claim 0', { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await page.getByText('Page claim 0', { exact: true }).click()
  await expect(page.getByText('History message 51', { exact: true })).toBeVisible()
  await expect(page.getByText('Page claim 0', { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: 'Загрузить предыдущие сообщения' }).click()
  await expect(page.getByText('Page claim 0', { exact: true })).toBeVisible()
  await expect(page.getByText('History message 51', { exact: true })).toHaveCount(1)
  await page.getByRole('link', { name: 'Мои заявки', exact: true }).click()
  await page.getByRole('button', { name: 'Создать заявку', exact: true }).click()
  await page.getByLabel('Ваш вопрос', { exact: true }).fill('Freshly created claim')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(page).toHaveURL(/\/tickets\/\d+$/)
  await page.getByRole('link', { name: 'Мои заявки', exact: true }).click()
  await expect(page.getByText('Всего: 22')).toBeVisible()
  await expect(page.getByText('Freshly created claim', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Открыть меню' }).click()
  await page.getByRole('link', { name: 'Мои заявки', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Закрыть меню' })).not.toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('admin keeps original navigation and explicitly unavailable analytics/settings', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Имя пользователя', { exact: true }).fill('administrator')
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Общая статистика' })).toBeVisible()
  await expect(page.getByText(/Раздел пока недоступен/)).toBeVisible()
  await page.getByRole('link', { name: 'Аналитика', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Аналитика' })).toBeVisible()
  await expect(page.getByText(/Раздел пока недоступен/)).toBeVisible()
  await page.getByRole('link', { name: 'Настройки', exact: true }).click()
  await expect(page.getByLabel('Название организации')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled()
  await page.getByRole('link', { name: 'Пользователи', exact: true }).click()
  await expect(
    page.getByRole('columnheader', { name: 'Организация', exact: true }),
  ).not.toBeVisible()
  await page.screenshot({ path: '/tmp/tender-adapted-users.png', fullPage: true })
})

test('one persistent chat: dislike hands off to L1 without another form', async ({ page }) => {
  const headers = { 'X-Requested-With': 'tender' }
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers,
        data: { name: `dislike-${Date.now()}`, password: 'test-password-123' },
      })
    ).status(),
  ).toBe(201)
  await page.goto('/app')
  await expect(page.getByRole('link', { name: /без AI/ })).toHaveCount(0)
  await page.getByLabel('Ваш вопрос', { exact: true }).fill('Первый вопрос')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(page).toHaveURL(/\/tickets\/\d+$/)
  const url = page.url()
  await expect(page.getByText(/Демонстрационный ответ/)).toBeVisible()
  await expect(page.getByLabel('Уровень обработки')).toHaveText('AI')
  await page.reload()
  const aiFeedback = page.getByRole('region', { name: 'Оценка ответа AI' })
  await aiFeedback.getByRole('radio', { name: 'Хорошо', exact: true }).check()
  await aiFeedback.getByRole('button', { name: 'Отправить оценку', exact: true }).click()
  await expect(aiFeedback.getByText('Оценка сохранена', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Уровень обработки')).toHaveText('AI')
  await page.reload()
  await expect(aiFeedback.getByRole('radio', { name: 'Хорошо', exact: true })).toBeChecked()
  await aiFeedback.getByRole('radio', { name: 'Плохо', exact: true }).check()
  await expect(
    aiFeedback.getByRole('button', { name: 'Отправить оценку', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Уровень обработки')).toHaveText('AI')
  await aiFeedback.getByRole('checkbox', { name: 'Неверный ответ', exact: true }).check()
  await aiFeedback.getByRole('button', { name: 'Отправить оценку', exact: true }).click()
  await expect(page.getByLabel('Уровень обработки')).toContainText('Поддержка L1')
  await expect(
    page.getByText('Обращение передано в поддержку L1. История сохранена.'),
  ).toBeVisible()
  await page.getByLabel('Сообщение', { exact: true }).fill('Уточнение после дизлайка')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(page.getByText('Уточнение после дизлайка', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(url)
  await expect(page.getByText('Первый вопрос', { exact: true })).toBeVisible()
  await expect(page.getByText(/Демонстрационный ответ/)).toHaveCount(1)
  await expect(page.getByLabel('Уровень обработки')).toContainText('Поддержка L1')
  await expect(aiFeedback.getByRole('radio', { name: 'Плохо', exact: true })).toBeChecked()
  await expect(
    aiFeedback.getByRole('checkbox', { name: 'Неверный ответ', exact: true }),
  ).toBeChecked()
  await aiFeedback.getByRole('radio', { name: 'Хорошо', exact: true }).check()
  await aiFeedback.getByRole('button', { name: 'Отправить оценку', exact: true }).click()
  await expect(aiFeedback.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByLabel('Уровень обработки')).toContainText('Поддержка L1')
  const claims = await (await page.request.get('/api/tickets')).json()
  expect(claims.total).toBe(1)
})

test('mobile: follow-up hands off to L1 and cancellation preserves history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers: { 'X-Requested-With': 'tender' },
        data: { name: `mobile-${Date.now()}`, password: 'test-password-123' },
      })
    ).status(),
  ).toBe(201)
  await page.goto('/app')
  await page.getByLabel('Ваш вопрос', { exact: true }).fill('Подпись не работает')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(page).toHaveURL(/\/tickets\/\d+$/)
  await page.getByLabel('Сообщение', { exact: true }).fill('Нужен специалист')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(page.getByLabel('Уровень обработки')).toContainText('Поддержка L1')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Отменить обращение', exact: true }).click()
  await expect(page.getByText('Отменена', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Сообщение', { exact: true })).not.toBeVisible()
  await expect(page.getByText('Нужен специалист', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Оценка работы сотрудника' })).not.toBeVisible()
})

test('register → AI → L1 → L2 → L3 → resolve → feedback → password recovery', async ({
  browser,
  baseURL,
}) => {
  const suffix = Date.now().toString(),
    name = `user-${suffix}`,
    operator = `operator-${suffix}`,
    middle = `middle-${suffix}`,
    senior = `senior-${suffix}`
  const password = 'test-password-123'
  const contexts = await Promise.all(
    Array.from({ length: 5 }, () => browser.newContext({ baseURL })),
  )
  const [admin, user, support, intermediate, second] = await Promise.all(
    contexts.map((context) => context.newPage()),
  )
  const errors: string[] = []
  for (const page of [admin, user, support, second])
    page.on('pageerror', (error) => errors.push(error.message))
  const login = async (page: Page, username: string, secret: string) => {
    await page.goto('/login')
    await page.getByLabel('Имя пользователя', { exact: true }).fill(username)
    await page.getByLabel('Пароль', { exact: true }).fill(secret)
    await page.getByRole('button', { name: 'Войти', exact: true }).click()
    await expect(page.locator('header').getByText(username, { exact: true })).toBeVisible()
  }
  try {
    const adminPassword = process.env.E2E_ADMIN_PASSWORD
    if (!adminPassword) throw new Error('Set E2E_ADMIN_PASSWORD for an isolated test deployment')
    await login(admin, process.env.E2E_ADMIN_USERNAME || 'administrator', adminPassword)
    await admin.getByRole('link', { name: 'Сотрудники', exact: true }).click()
    for (const [staff, level] of [
      [operator, 'supportL1'],
      [middle, 'supportL2'],
      [senior, 'supportL3'],
    ]) {
      await admin.getByRole('button', { name: 'Добавить сотрудника' }).click()
      const dialog = admin.getByRole('dialog')
      await dialog.getByLabel('Имя пользователя', { exact: true }).fill(staff)
      await dialog.getByLabel('Уровень поддержки').selectOption(level)
      await dialog.getByLabel('Начальный пароль').fill(password)
      await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      await expect(admin.getByRole('cell', { name: staff, exact: true })).toBeVisible()
    }
    await user.goto('/register')
    await user.getByLabel('Имя пользователя', { exact: true }).fill(name)
    await user.getByLabel('Пароль', { exact: true }).fill(password)
    await user.getByLabel('Подтверждение пароля', { exact: true }).fill(password)
    await user.getByRole('checkbox', { name: 'Я принимаю пользовательское соглашение' }).check()
    await user.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click()
    await user
      .getByLabel('Ваш вопрос', { exact: true })
      .fill('Не удаётся подписать документ. Нужна помощь.')
    await user.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(user).toHaveURL(/\/tickets\/\d+$/)
    await user.getByLabel('Сообщение', { exact: true }).fill('AI не помог, проверьте настройки')
    await user.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(user.getByLabel('Уровень обработки')).toContainText('Поддержка L1')
    const id = user.url().split('/').pop()
    await user.reload()
    await expect(
      user.getByText('Не удаётся подписать документ. Нужна помощь.', { exact: true }),
    ).toBeVisible()
    await login(support, operator, password)
    await support.goto(`/support/tickets/${id}`)
    await expect(support.getByText('Краткий анализ', { exact: true })).not.toBeVisible()
    await expect(support.getByRole('link', { name: 'На контроле', exact: true })).not.toBeVisible()
    await support.getByLabel('Сообщение', { exact: true }).fill('Проверим настройки подписи.')
    await support.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(support.locator('main').getByText(operator, { exact: true }).last()).toBeVisible()
    await support.getByRole('button', { name: 'Эскалировать', exact: true }).click()
    await expect(support.getByLabel('Уровень обработки')).toContainText('Поддержка L2')
    await expect(support.getByLabel('Сообщение', { exact: true })).not.toBeVisible()
    await login(intermediate, middle, password)
    await intermediate.goto(`/support/tickets/${id}`)
    await intermediate.getByRole('button', { name: 'Взять в работу', exact: true }).click()
    await intermediate.getByLabel('Сообщение', { exact: true }).fill('Проверка L2, нужен L3')
    await intermediate.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(intermediate.getByText('Проверка L2, нужен L3', { exact: true })).toBeVisible()
    await intermediate.getByRole('button', { name: 'Эскалировать', exact: true }).click()
    await expect(intermediate.getByLabel('Уровень обработки')).toContainText('Поддержка L3')
    await login(second, senior, password)
    await second.goto(`/support/tickets/${id}`)
    await second.getByRole('button', { name: 'Взять в работу', exact: true }).click()
    await expect(
      second.getByRole('button', { name: 'Отметить решённым', exact: true }),
    ).toBeVisible()
    await expect(
      second.getByRole('button', { name: 'Эскалировать', exact: true }),
    ).not.toBeVisible()
    await second.getByLabel('Категория', { exact: true }).selectOption('DOCUMENTS')
    await second.getByLabel('Подкатегория', { exact: true }).fill('Электронная подпись')
    await second.getByRole('button', { name: 'Сохранить категорию', exact: true }).click()
    await expect(second.getByText('Электронная подпись', { exact: true })).toBeVisible()
    await second
      .getByLabel('Сообщение', { exact: true })
      .fill('Обновите сертификат и повторите подписание.')
    await second.getByRole('button', { name: 'Отправить', exact: true }).click()
    await user.bringToFront()
    await expect(
      user.getByText('Обновите сертификат и повторите подписание.', { exact: true }),
    ).toBeVisible({
      timeout: 10000,
    })
    await second.getByRole('button', { name: 'Отметить решённым', exact: true }).click()
    await expect(
      user.getByText('Обращение закрыто. История доступна для чтения.', { exact: true }),
    ).toBeVisible({ timeout: 10000 })
    const operatorFeedback = user.getByRole('region', { name: 'Оценка работы сотрудника' })
    await operatorFeedback.getByRole('radio', { name: 'Плохо', exact: true }).check()
    await expect(
      operatorFeedback.getByText('Что не понравилось? Выберите хотя бы одну причину.'),
    ).toBeVisible()
    await expect(
      operatorFeedback.getByRole('button', { name: 'Отправить оценку', exact: true }),
    ).toBeDisabled()
    await operatorFeedback.getByRole('checkbox', { name: 'Медленная работа', exact: true }).check()
    await operatorFeedback.getByRole('button', { name: 'Отправить оценку', exact: true }).click()
    await expect(operatorFeedback.getByText('Оценка сохранена', { exact: true })).toBeVisible()
    await user.reload()
    await expect(operatorFeedback.getByRole('radio', { name: 'Плохо', exact: true })).toBeChecked()
    await expect(
      operatorFeedback.getByRole('checkbox', { name: 'Медленная работа', exact: true }),
    ).toBeChecked()
    await user.screenshot({ path: '/tmp/tender-operational-smoke.png', fullPage: true })
    await user.locator('header').getByRole('button').filter({ hasText: name }).click()
    await user.getByRole('button', { name: 'Изменить пароль', exact: true }).click()
    await user.getByLabel('Текущий пароль', { exact: true }).fill(password)
    await user.getByLabel('Новый пароль', { exact: true }).fill('changed-password-123')
    await user
      .getByRole('dialog')
      .getByRole('button', { name: 'Изменить пароль', exact: true })
      .click()
    await expect(user.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
    await login(user, name, 'changed-password-123')
    await admin.getByRole('link', { name: 'Пользователи', exact: true }).click()
    await admin.getByLabel('Поиск по имени пользователя').fill(name)
    await admin
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Сбросить пароль' })
      .click()
    const reset = admin.getByRole('dialog')
    await reset.getByLabel('Новый пароль', { exact: true }).fill('reset-password-123')
    await reset.getByRole('button', { name: 'Сбросить пароль', exact: true }).click()
    await expect(reset).not.toBeVisible()
    await user.reload()
    await expect(user.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
    await login(user, name, 'reset-password-123')
    expect(errors).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
