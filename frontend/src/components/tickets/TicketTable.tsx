import React from 'react'
import { Link } from 'react-router-dom'
import type { Ticket } from '@/types'
import { TicketStatusBadge } from './TicketStatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { formatDate } from '@/lib/utils'

interface TicketTableProps {
  tickets: Ticket[]
  basePath: string
  showUser?: boolean
}

export function TicketTable({ tickets, basePath, showUser = true }: TicketTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">№</th>
            <th className="px-4 py-3 font-medium">Тема</th>
            {showUser && <th className="px-4 py-3 font-medium">Пользователь</th>}
            <th className="px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 font-medium">Приоритет</th>
            <th className="px-4 py-3 font-medium">Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-gray-50/70"
            >
              <td className="px-4 py-3.5 align-middle">
                <Link to={`${basePath}/${ticket.id}`} className="font-medium text-primary hover:underline">
                  {ticket.number}
                </Link>
              </td>
              <td className="px-4 py-3.5 align-middle">
                <Link to={`${basePath}/${ticket.id}`} className="block max-w-xs truncate text-ink hover:text-primary">
                  {ticket.title}
                </Link>
              </td>
              {showUser && (
                <td className="px-4 py-3.5 align-middle text-ink-muted">{ticket.userOrganization}</td>
              )}
              <td className="px-4 py-3.5 align-middle">
                <TicketStatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3.5 align-middle">
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td className="px-4 py-3.5 align-middle text-ink-muted">{formatDate(ticket.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
