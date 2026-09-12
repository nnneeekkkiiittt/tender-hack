# ПОРТАЛ поставщиков — TenderHack Frontend

Интеллектуальная платформа поддержки пользователей Портала поставщиков Москвы.
Хакатонный frontend: React + TypeScript + Vite + Tailwind CSS, полностью
работоспособный в **DEMO MODE** без backend и архитектурно готовый к
подключению реального API без переделки UI.

## Стек

- React 18 + TypeScript + Vite
- React Router (маршрутизация, role-based protected routes)
- Tailwind CSS (design tokens под палитру Портала поставщиков)
- TanStack Query (загрузка/кэш данных через сервисный слой)
- Zustand (auth store, UI store, chat store)
- Recharts (аналитика администратора)
- Lucide React (иконки)

## Быстрый старт

```bash
npm install
cp .env.example .env
npm run dev
```

Откройте http://localhost:5173 — вы попадёте на `/login`. Введите любой
email/пароль (DEMO MODE не проверяет их) и нажмите «Войти», либо
воспользуйтесь плавающей панелью **Demo mode** внизу экрана, чтобы мгновенно
переключиться между ролями Пользователь / Саппорт / Администратор.

Для сборки:

```bash
npm run build
npm run preview
```

## DEMO MODE vs API MODE

Режим переключается переменной окружения:

```
VITE_APP_MODE=demo   # без backend, все данные — mock + localStorage
VITE_APP_MODE=api    # обращения идут в VITE_API_URL через fetch
```

`.env.example` уже содержит оба параметра. В DEMO MODE:

- нет настоящей аутентификации — вход всегда переводит в роль `USER`;
  переключение ролей выполняется через **Demo Role Switcher**
  (`src/components/demo/DemoRoleSwitcher.tsx`), плавающую панель внизу экрана;
- созданные тикеты, изменения статусов/приоритетов и добавленные сотрудники
  сохраняются в `localStorage` (см. `src/lib/storage.ts`), а не на сервере;
- ответы AI-ассистента — детерминированные заготовки по ключевым словам
  (`src/services/ai/DemoAiService.ts`), чтобы демо-сценарий был воспроизводим.

## Архитектура: services / repositories

Страницы и компоненты **никогда** не обращаются к `fetch`/`localStorage`
напрямую и не хранят mock-массивы внутри JSX. Вся бизнес-логика спрятана за
интерфейсами в `src/services/*`, у каждого — Demo- и Api-реализация:

```
src/
  types/            # доменные типы — контракт между UI и services
  mock/             # чистые mock-данные (без побочных эффектов)
  lib/storage.ts    # обёртка над localStorage (только для DEMO MODE)
  services/
    auth/           # AuthService: DemoAuthService / ApiAuthService
    tickets/        # TicketRepository: Demo.../Api...
    users/          # UserRepository (поставщики)
    employees/      # EmployeeRepository (сотрудники поддержки)
    analytics/      # AnalyticsService
    knowledge/      # KnowledgeService (база знаний)
    ai/             # AiService (демо-ответы ассистента)
  api/              # тонкие ре-экспорты активного сервиса + fetch-клиент
  store/            # Zustand: authStore, uiStore, chatStore
  components/       # ui/, layout/, tickets/, chat/, admin/, demo/
  layouts/          # AuthLayout, UserLayout, SupportLayout, AdminLayout
  routes/           # ProtectedRoute (RBAC), AppRoutes
  pages/            # auth/, user/, support/, admin/
```

Каждый сервис экспортируется как **единственный активный экземпляр**,
выбранный по `VITE_APP_MODE` (см., например, `src/services/tickets/index.ts`).
Компонент импортирует `ticketRepository` и не знает, идёт ли внутри fetch к
реальному backend или чтение localStorage.

### Как подключить backend

1. В `ApiTicketRepository` / `ApiAuthService` / … (уже созданы как заглушки)
   реализованы вызовы через `src/api/client.ts` (`fetch` с `VITE_API_URL`).
   При необходимости поправьте пути/формат payload под реальный контракт.
2. Установите `VITE_APP_MODE=api` и `VITE_API_URL=<адрес вашего backend>`.
3. Уберите Demo Role Switcher, если реальный логин уже выдаёт роль
   (`isDemoMode` в `src/config/env.ts` автоматически скрывает его в API MODE).
4. UI-компоненты и страницы менять не требуется — они работают только через
   интерфейсы `AuthService` / `TicketRepository` / … .

Реальный backend должен возвращать пользователя в виде:

```ts
{ id, name, email, role: 'USER' | 'SUPPORT' | 'ADMIN' }
```

## Роли и переключение

- **USER** — регистрация, AI-чат, создание и просмотр обращений.
- **SUPPORT** — рабочая очередь заявок, AI-анализ, переписка, смена статуса.
- **ADMIN** — статистика, аналитика, управление пользователями и сотрудниками.

`ProtectedRoute` (`src/routes/ProtectedRoute.tsx`) закрывает `/app/*` для не-USER,
`/support/*` — для не-SUPPORT, `/admin/*` — для не-ADMIN, и редиректит на
домашний экран текущей роли при попытке зайти в чужую область.

## Маршруты

```
/login
/register

/app                        — главная/чат (USER)
/tickets                    — мои заявки (USER)
/tickets/:id                — заявка + переписка (USER)
/knowledge                  — база знаний (USER)

/support                    — все заявки (SUPPORT)
/support/mine                — мои заявки (SUPPORT)
/support/control            — на контроле (SUPPORT)
/support/knowledge          — база знаний (SUPPORT)
/support/tickets/:id        — обработка заявки, AI-анализ (SUPPORT)

/admin                       — общая статистика (ADMIN)
/admin/tickets, /admin/tickets/:id
/admin/users                — поставщики
/admin/employees            — сотрудники поддержки + модалка добавления
/admin/analytics            — расширенная аналитика (Recharts)
/admin/settings
```

## Демо-сценарий (для показа на хакатоне)

1. **USER**: `/login` → «Войти» → главная `/app` → задать вопрос («Как
   принять участие в закупке?») → получить ответ → нажать 👎 → «Создать
   обращение в поддержку» → тикет появляется в «Мои заявки».
2. Через нижнюю панель **Demo mode** переключиться на **Саппорт** →
   `/support` → открыть созданный тикет → увидеть AI-анализ → ответить →
   сменить статус на «Решена».
3. Вернуться на роль **Пользователь** → открыть тот же тикет в «Мои заявки»
   → увидеть новый ответ и статус.
4. Переключиться на **Администратора** → `/admin` — KPI, графики → `/admin/analytics`
   → `/admin/employees` → «Добавить сотрудника» → сотрудник появляется в таблице.

## Демо-данные

Стартовые mock-данные лежат в `src/mock/*.mock.ts` (тикеты, пользователи,
сотрудники, аналитика, база знаний). Все ФИО, организации и email —
вымышленные демо-данные.

## Известные ограничения демо

- AI-ответы — заготовки по ключевым словам, а не реальная LLM-интеграция.
- `localStorage` используется только для демонстрационного состояния
  (тикеты, сотрудники) — не как замена настоящей аутентификации.
- Вложения к сообщениям — декоративные (в demo-данных есть примеры файлов,
  но реальной загрузки файлов нет).
