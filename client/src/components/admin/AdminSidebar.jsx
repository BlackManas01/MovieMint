// components/admin/AdminSidebar.jsx - Admin panel sidebar with navigation links
import { LayoutDashboardIcon, ListIcon, ListCollapseIcon, TicketIcon, Trash2Icon } from 'lucide-react'
import React from 'react'
import { NavLink } from 'react-router-dom'

const AdminSidebar = () => {
  const adminNavlinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboardIcon },
    { name: 'List Shows', path: '/admin/list-shows', icon: ListIcon },
    { name: 'Show Details', path: '/admin/show-details', icon: ListCollapseIcon },
    { name: 'List Bookings', path: '/admin/list-bookings', icon: TicketIcon },
    { name: 'Recycle Bin', path: '/admin/recycle-bin', icon: Trash2Icon },
  ]

  return (
    <div className='h-[calc(100vh-64px)] md:flex flex-col pt-6 max-w-13 md:max-w-64 w-full border-r border-white/10 bg-black/40 backdrop-blur-xl text-sm'>
      {/* Profile chip */}
      <div className='hidden md:flex items-center gap-3 px-5 pb-5 mb-2 border-b border-white/10'>
        <div className='flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary font-semibold shadow-[0_0_25px_-8px_rgba(212,162,144,0.7)]'>
          A
        </div>
        <div>
          <p className='font-semibold text-white leading-tight'>Admin User</p>
          <p className='text-[11px] text-gray-500'>Administrator</p>
        </div>
      </div>

      <p className='hidden md:block px-5 text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-2'>Menu</p>

      <div className='w-full flex flex-col gap-1 px-2 md:px-3'>
        {adminNavlinks.map((link, index) => (
          <NavLink
            key={index}
            to={link.path}
            end
            className={({ isActive }) =>
              `group relative flex items-center max-md:justify-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary border border-primary/25 shadow-[0_8px_30px_-12px_rgba(212,162,144,0.7)]'
                : 'text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <link.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                <p className='max-md:hidden font-medium'>{link.name}</p>
                {isActive && (
                  <span className='hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-primary to-primary-dull' />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className='mt-auto hidden md:block px-5 py-4 border-t border-white/10'>
        <p className='text-[11px] text-gray-500'>MovieMint Admin</p>
        <p className='text-[10px] text-gray-600'>v1.0 · Luxury Suite</p>
      </div>
    </div>
  )
}

export default AdminSidebar
