import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-roll-gray-100 dark:bg-roll-gray-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main className="min-h-screen min-w-0 flex-1 p-8 dark:text-roll-gray-100">
        <Outlet />
      </main>
    </div>
  )
}
