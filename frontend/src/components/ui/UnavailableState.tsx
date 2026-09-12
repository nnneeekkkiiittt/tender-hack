export function UnavailableState({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <div className="mt-6 rounded-lg border border-border bg-white p-8 text-sm text-ink-muted">
        Раздел пока недоступен. Статистика будет подключена из отдельного сервиса; демонстрационные
        показатели не отображаются.
      </div>
    </div>
  )
}
