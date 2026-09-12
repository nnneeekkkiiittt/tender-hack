import React from 'react'
import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { useUiStore } from '@/store/uiStore'

export interface SidebarNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export interface SidebarNavGroup {
  title?: string
  items: SidebarNavItem[]
}

interface SidebarProps {
  groups: SidebarNavGroup[]
  footer?: React.ReactNode
  topSlot?: React.ReactNode
  children?: React.ReactNode
}

function NavItemLink({ item }: { item: SidebarNavItem }) {
  const Icon = item.icon
  const { setMobileSidebarOpen } = useUiStore()
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={() => setMobileSidebarOpen(false)}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'border-accent bg-accent/5 text-accent'
            : 'text-ink hover:bg-gray-50'
        )
      }
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span>{item.label}</span>
    </NavLink>
  )
}

function SidebarContent({ groups, footer, topSlot, children }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo />
      </div>
      {topSlot && <div className="px-3 pt-4">{topSlot}</div>}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {groups.map((group, i) => (
          <div key={i} className={i > 0 ? 'mt-5' : ''}>
            {group.title && (
              <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItemLink key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
        {children}
      </nav>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </div>
  )
}

export function Sidebar(props: SidebarProps) {
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUiStore()

  return (
    <>
      {/* Desktop — sticky to the viewport so it stays visible while the
          page content scrolls; its own nav list scrolls independently if
          it ever grows taller than the screen. */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:sticky lg:top-0 lg:block lg:h-screen">
        <SidebarContent {...props} />
      </aside>

      {/* Mobile drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-72 flex-col bg-white shadow-popover">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Закрыть меню"
              className="absolute right-3 top-4 rounded-md p-1.5 text-ink-muted hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent {...props} />
          </div>
        </div>
      )}
    </>
  )
}
