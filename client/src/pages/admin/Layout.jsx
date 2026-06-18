// pages/admin/Layout.jsx - Admin layout wrapper with top navigation and route outlet
import React, { useEffect } from 'react'
import AdminNavbar from '../../components/admin/AdminNavbar'
import { Outlet } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import Loading from '../../components/Loading'

const Layout = () => {

  const { isAdmin, fetchIsAdmin } = useAppContext()

  useEffect(() => {
    fetchIsAdmin()
  }, [])

  return isAdmin ? (
    <div className="relative min-h-screen bg-[#070b0a] text-white overflow-hidden">
      {/* Ambient warm glows */}
      <div className="pointer-events-none fixed -top-32 -right-24 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-40 -left-24 h-96 w-96 rounded-full bg-purple-500/10 blur-[120px]" />

      <AdminNavbar />
      <main className="relative max-w-6xl mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>
    </div>
  ) : <Loading />
}

export default Layout
