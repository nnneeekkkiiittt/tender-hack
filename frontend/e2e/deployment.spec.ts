import { expect, test, type Page } from '@playwright/test'

const headers = { 'X-Requested-With': 'tender' }
test.beforeEach(() => test.skip(process.env.E2E_DEPLOYMENT !== 'true', 'Opt-in live deployment checks; creates synthetic data'))
test.use({ actionTimeout: 30000 })

async function demo(page: Page, label: string) {
  await page.getByRole('button', { name: 'Демо', exact: true }).click()
  await page.locator('#test-account-menu').getByRole('button', { name: new RegExp('^' + label + '\\b') }).click()
  await expect(page.locator('#test-account-menu')).not.toBeVisible()
}

test('registration, password login, permissions, demo chooser and mobile navigation', async ({ page }) => {
  test.setTimeout(180000)
  const name = `deploy-${Date.now()}`
  const password = 'deployment-check-password-123'
  await page.goto('/register')
  await page.getByLabel('Имя пользователя', { exact: true }).fill(name)
  await page.getByLabel('Пароль', { exact: true }).fill('short')
  await page.getByLabel('Подтверждение пароля').fill('short')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByLabel('Подтверждение пароля').fill(password)
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await expect(page).toHaveURL(/\/app$/)
  expect((await page.request.get('/api/v1/analytics/users')).status()).toBe(403)
  await page.request.post('/api/auth/logout', { headers })
  await page.goto('/login')
  await page.getByLabel('Имя пользователя', { exact: true }).fill(name)
  await page.getByLabel('Пароль', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Чем я могу помочь?' })).toBeVisible()
  for (const level of [1, 2, 3]) {
    await demo(page, `L${level}`)
    await expect(page).toHaveURL(/\/support$/)
    await expect(page.getByRole('link', { name: `Очередь L${level}`, exact: true })).toBeVisible()
    expect((await page.request.get('/api/v1/analytics/users')).status()).toBe(403)
  }
  await demo(page, 'Admin')
  await expect(page).toHaveURL(/\/admin$/)
  expect((await page.request.get('/api/v1/analytics/users')).status()).toBe(200)
  await demo(page, 'Consumer')
  await expect(page).toHaveURL(/\/app$/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Открыть меню' }).click()
  await page.getByRole('link', { name: 'Мои заявки', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Закрыть меню' })).not.toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/tender-deployment-mobile.png', fullPage: true })
})

test('admin analytics, real Metabase widget, dashboard edit and deletion', async ({ page }) => {
  test.setTimeout(240000)
  const pageErrors: string[] = []
  page.on('pageerror', e => pageErrors.push(e.message))
  expect((await page.request.get('/api/v1/analytics/users')).status()).toBe(401)
  expect((await page.request.post('/api/auth/demo/admin', { headers })).status()).toBe(200)
  for (const path of ['/admin', '/admin/tickets', '/admin/users', '/admin/employees', '/admin/analytics/dashboards']) {
    await page.goto(path)
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.getByText('Не удалось загрузить данные', { exact: true })).not.toBeVisible()
  }
  const failures: string[] = []
  page.on('response', r => { if (r.status() >= 400 && /api\//.test(r.url())) failures.push(`${r.status()} ${r.url().split('?')[0]}`) })
  await page.goto('/admin/analytics/dashboards/new')
  const name = `Deployment dashboard ${Date.now()}`
  await page.getByLabel('Название', { exact: true }).nth(0).fill(name)
  await page.getByLabel('Название', { exact: true }).nth(1).fill('Weekly claims')
  await page.getByRole('combobox').nth(1).selectOption('week')
  await page.getByRole('combobox').nth(2).selectOption('table')
  await page.getByRole('button', { name: 'Добавить виджет в дашборд' }).click()
  await page.getByRole('button', { name: 'Сохранить дашборд' }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  const id = page.url().split('/').at(-1)!
  await expect(page.locator('iframe')).toBeVisible({ timeout: 60000 })
  const frame = page.frameLocator('iframe')
  await expect(frame.getByText('value', { exact: true }).first()).toBeVisible({ timeout: 90000 })
  await page.screenshot({ path: '/tmp/tender-deployment-dashboard.png', fullPage: true })
  await page.goto(`/admin/analytics/dashboards/${id}/edit`)
  await page.getByLabel('Название', { exact: true }).nth(0).fill(name + ' edited')
  await page.getByRole('button', { name: 'Сохранить дашборд' }).click()
  await expect(page.getByRole('heading', { name: name + ' edited', exact: true })).toBeVisible()
  await page.goto('/admin/analytics/dashboards')
  page.once('dialog', d => d.accept())
  await page.getByText(name + ' edited', { exact: true }).locator('../..').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByText(name + ' edited', { exact: true })).not.toBeVisible()
  expect(pageErrors).toEqual([])
  expect(failures).toEqual([])
})

test('admin creates real L1/L2/L3 accounts; each can log in without the demo chooser', async ({ page, browser, baseURL }) => {
  test.setTimeout(180000)
  await page.request.post('/api/auth/demo/admin', { headers })
  await page.goto('/admin/employees')
  const stamp = Date.now()
  for (const level of [1, 2, 3]) {
    const name = `deploy-staff-l${level}-${stamp}`
    await page.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click()
    const modal = page.getByRole('dialog')
    await modal.getByLabel('Имя', { exact: true }).fill(name)
    await modal.getByLabel('Начальный пароль').fill('staff-check-password-123')
    await modal.getByLabel('Уровень поддержки').selectOption(`supportL${level}`)
    await modal.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(modal).not.toBeVisible()
    const context = await browser.newContext({ baseURL })
    try {
      const staff = await context.newPage()
      await staff.goto('/login')
      await staff.getByLabel('Имя пользователя', { exact: true }).fill(name)
      await staff.getByLabel('Пароль', { exact: true }).fill('staff-check-password-123')
      await staff.getByRole('button', { name: 'Войти', exact: true }).click()
      await expect(staff).toHaveURL(/\/support$/)
      await expect(staff.getByRole('link', { name: `Очередь L${level}`, exact: true })).toBeVisible()
      expect((await staff.request.get('/api/employees')).status()).toBe(403)
    } finally { await context.close() }
  }
})
