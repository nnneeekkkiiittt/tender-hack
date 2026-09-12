import { TestAccountMenu } from '@/components/demo/TestAccountMenu'
import React from 'react'
import { Outlet } from 'react-router-dom'

// The content column uses `m-auto` (not `justify-center` on the flex
// container) so short pages like /login are vertically centered when they
// fit the viewport, while longer pages like /register naturally sit flush
// at the top instead of being centered off-screen — auto margins never go
// negative, so both routes start from the same, predictable position and
// /login never grows a scrollbar it doesn't need.
export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="absolute right-4 top-4 z-40">
        <TestAccountMenu />
      </div>
      <div className="flex w-full flex-col px-6 py-10 sm:px-12 lg:w-[480px] lg:shrink-0 xl:w-[520px]">
        <div className="m-auto w-full">
          <Outlet />
        </div>
      </div>

      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <img
          src="/images/red-square.jpg"
          alt="Московский Кремль и Красная площадь"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/0 to-black/10"
          aria-hidden
        />
        <div className="absolute left-12 top-12 max-w-xs rounded-lg bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
          <p className="text-xl font-medium leading-snug text-primary">
            «Развиваем открытые закупки вместе»
          </p>
        </div>
      </div>
    </div>
  )
}
