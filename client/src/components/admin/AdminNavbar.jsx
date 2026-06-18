// components/admin/AdminNavbar.jsx - Admin top navigation (horizontal menu + brand)
import React from 'react'
import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboardIcon, ListIcon, ListCollapseIcon, TicketIcon, Trash2Icon } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'

const links = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboardIcon },
  { name: 'Shows', path: '/admin/list-shows', icon: ListIcon },
  { name: 'Show Details', path: '/admin/show-details', icon: ListCollapseIcon },
  { name: 'Bookings', path: '/admin/list-bookings', icon: TicketIcon },
  { name: 'Recycle Bin', path: '/admin/recycle-bin', icon: Trash2Icon },
]

const AdminNavbar = () => {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-[#0a0f0d]/95 to-[#070b0a]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: brand */}
        <Link to="/" className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-black font-bold text-base shadow-[0_4px_20px_-4px_rgba(167,139,250,0.8)]">M</span>
          <span className="hidden sm:inline text-lg md:text-xl font-semibold tracking-tight whitespace-nowrap">
            <span className="text-white">Movie</span><span className="text-violet-400">Mint</span>
          </span>
          <span className="hidden md:inline-flex items-center text-[9px] uppercase tracking-[0.22em] px-2 py-0.5 rounded-full border border-violet-400/30 bg-violet-400/10 text-violet-300">Admin</span>
        </Link>

        {/* Center: nav */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/10 backdrop-blur border border-violet-300/20 rounded-full p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] shrink-0">
          {links.map((l) => (
            <NavLink
              key={l.path}
              to={l.path}
              end
              className={({ isActive }) =>
                `relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${isActive
                  ? 'bg-gradient-to-b from-violet-400/25 to-purple-400/5 text-violet-200 ring-1 ring-violet-400/30 shadow-[0_6px_20px_-10px_rgba(167,139,250,0.9)]'
                  : 'text-gray-400 hover:text-white'
                }`
              }
            >
              <l.icon className="w-4 h-4" />
              {l.name}
            </NavLink>
          ))}
        </nav>

        {/* Right: action */}
        <div className="flex-1 flex justify-end items-center gap-3">
          <ThemeToggle />
          <Link to="/" className="group inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-300 transition whitespace-nowrap">
            <span className="transition-transform group-hover:-translate-x-0.5">←</span> Back to site
          </Link>
        </div>
      </div>

      {/* Elegant accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

      {/* Mobile / tablet horizontal nav */}
      <nav className="lg:hidden flex items-center justify-center gap-2 overflow-x-auto no-scrollbar px-4 py-2.5">
        {links.map((l) => (
          <NavLink
            key={l.path}
            to={l.path}
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition ${isActive
                ? 'bg-violet-400/20 text-violet-300 border border-violet-400/30'
                : 'text-gray-400 bg-white/5 border border-transparent'
              }`
            }
          >
            <l.icon className="w-3.5 h-3.5" />
            {l.name}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

export default AdminNavbar
