# Портал поставщиков — frontend

React 18, TypeScript, Vite, Tailwind, TanStack Query. API mode использует исходные страницы `src/pages/`, макеты `src/layouts/`, навигацию и компоненты `src/components/`. Слой `src/services/` адаптирует их к FastAPI; типы HTTP-контракта и защищённый fetch находятся в `src/api/contracts.ts`. Отдельный заменяющий интерфейс удалён.

## Запуск

```sh
npm ci --registry=https://registry.npmjs.org
npm run dev
```

Откройте http://localhost:5173. Backend должен работать на порту 8000: Vite перенаправляет `/api` к нему. Полный запуск через Docker и первоначальное создание администратора описаны в [основном README](../README.md).

По умолчанию включён **API mode**: настоящая регистрация по имени пользователя, cookie-сессии, обращения, переписка, назначения, завершение/отмена, оценки операторов и управление сотрудниками. Модель и RAG подключаются через отдельный AI-сервис; при его отсутствии вопрос сохраняется, и следующее сообщение передаёт тот же чат поддержке L1.

`VITE_API_URL` по умолчанию `/api`. При отдельном домене backend настройте CORS/origin и cookie-политику; предпочтителен same-origin proxy.

## Демонстрационный режим

Явно установите `VITE_APP_MODE=demo`, чтобы открыть те же макеты с демонстрационными сервисами и переключателем ролей. Этот режим помечен предупреждением, не использует настоящую аутентификацию и не является API-контрактом. В нём сохранены демонстрационные поля, статусы и аналитика. Mock-данные сохранены для демонстрации и не отображаются в API mode.

В API mode `/admin/analytics` теперь подключён к отдельному analytics-сервису (Go, см. `../analytics`) — реальные метрики по операторам, темам и эскалациям, плюс пользовательские дашборды поверх Metabase. Общий дашборд `/admin` (KPI, backlog, категории) и статистика саппорта по-прежнему демонстрационные и до отдельного сервиса недоступны в API mode. Настройки, уведомления и вложения отключены. Главная страница сохраняет исходный дизайн, но открывает единый чат AI → L1 → L2 → L3. AI отвечает один раз, дизлайк или follow-up передаёт чат L1, а назначенный сотрудник нажимает «Эскалировать» для перехода на следующую линию.

## Проверки

`npm run lint` и `npm run build` проверяют весь frontend. `npm run test:e2e` запускает Chromium-сценарий на тестовом стенде; нужны установленный браузер Playwright и `E2E_ADMIN_PASSWORD`. Параметры `E2E_BASE_URL` и `E2E_ADMIN_USERNAME` необязательны. Тест создаёт данные, поэтому используйте отдельную тестовую БД.

## Analytics development

`/admin/analytics` (Операторы+AI / Темы / Эскалации / Мои дашборды) — отдельный контур, независимый от основного backend'а:

```
PostgreSQL ← analytics (Go, порт 8080) ← frontend (VITE_ANALYTICS_API_URL)
PostgreSQL ← Metabase (порт 3000)      ← frontend (VITE_METABASE_URL, только embed-ссылки)
```

### Запуск

1. PostgreSQL с уже наполненными таблицами `users`/`claims`/`messages`/`reactions` (та же база, что использует основной backend).
2. `cd analytics && go run ./cmd/main.go` (см. `analytics/.env.example` для переменных подключения к БД и CORS).
3. Metabase (`docker run -p 3000:3000 metabase/metabase`, или через `docker-compose.yml` в корне репозитория) — подключите его к той же PostgreSQL через Admin → Databases и запомните числовой `id` подключения, это `METABASE_DATABASE_ID`.
4. В Metabase создайте статический API-ключ (Admin → API Keys) — это `METABASE_API_KEY`; включите Static Embedding (Admin → Embedding) и скопируйте секрет — это `METABASE_EMBEDDING_SECRET`. Оба остаются только в `analytics/.env`, во frontend не передаются.
5. `cp .env.example .env` в этой папке и укажите:
   ```
   VITE_APP_MODE=api
   VITE_ANALYTICS_API_URL=http://localhost:8080
   VITE_METABASE_URL=http://localhost:3000
   ```

### Что где

- Метрики по операторам/темам/эскалациям — только с backend'а (`/api/v1/metrics/*`), формулы не дублируются во frontend.
- Пользовательские дашборды (`DashboardTemplate`) хранятся в Postgres (`dashboard_templates`, миграция `analytics/migrations/0001_dashboard_templates.sql`) — сохраняется только конфигурация (метрика/dimension/визуализация), не результат запроса. При каждом открытии дашборда Metabase выполняет запрос заново.
- Виджет получает данные через подписанный (JWT, `/embed/question/...`) URL, который выдаёт `GET /api/v1/dashboards/:id/widgets/:widgetId/embed-url` — секрет подписи никогда не покидает backend.
- Первый рабочий дашборд «Обращения и эффективность AI» создаётся один раз через `POST /api/v1/metabase/bootstrap`.
- В DEMO MODE Metabase не требуется: дашборды хранятся в `localStorage`, виджеты рисуются локальным Recharts-рендерером на demo-данных.

