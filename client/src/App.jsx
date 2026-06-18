// App.jsx - Root component: defines all routes (public, user, admin) and layout structure
import { SignIn } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { Route, Routes, useLocation, Navigate } from 'react-router-dom'
import Footer from './components/Footer'
import Loading from './components/Loading'
import Navbar from './components/Navbar'
import PendingPaymentBanner from './components/PendingPaymentBanner'
import ScrollToTop from './components/ScrollToTop'
import { useAppContext } from './context/AppContext'
import Favorite from './pages/Favorite'
import Home from './pages/Home'
import MovieDetails from './pages/MovieDetails'
import Movies from './pages/Movies'
import MyBookings from './pages/MyBookings'
import SeatLayout from './pages/SeatLayout'
import UpcomingMovieDetails from './pages/UpcomingMovieDetails'
import Dashboard from './pages/admin/Dashboard'
import Layout from './pages/admin/Layout'
import ListBookings from './pages/admin/ListBookings'
import ListShows from './pages/admin/ListShows'
import ShowDetails from './pages/admin/ShowDetails'
import RecycleBin from './pages/admin/RecycleBin'
import ReviewYourBooking from './pages/ReviewYourBooking'
import PaymentSuccess from './pages/PaymentSuccess'
import NotFound from './pages/NotFound'

const App = () => {

  // Hide navbar/footer on admin routes (admin has its own layout)
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  // Per-route document titles
  useEffect(() => {
    const p = location.pathname
    let title = ''
    if (p === '/') title = 'Book Movie Tickets'
    else if (p.startsWith('/movies/') && p.split('/').length > 3) title = 'Select Seats'
    else if (p.startsWith('/movies/')) title = 'Movie Details'
    else if (p === '/movies') title = 'Now Showing'
    else if (p.startsWith('/upcoming')) title = 'Coming Soon'
    else if (p === '/favorite') title = 'Your Favorites'
    else if (p === '/my-bookings') title = 'My Bookings'
    else if (p.startsWith('/review-booking')) title = 'Review Booking'
    else if (p.startsWith('/payment-success')) title = 'Payment Successful'
    else if (p.startsWith('/admin')) title = 'Admin'
    document.title = title ? `${title} · MovieMint` : 'MovieMint — Book Movie Tickets'
  }, [location.pathname])

  const { user } = useAppContext()

  return (
    <>
      <ScrollToTop />
      <Toaster />
      {!isAdminRoute && <Navbar />}
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/movies' element={<Movies />} />
        <Route path='/upcoming' element={<Navigate to="/movies" replace />} />
        <Route path="/upcoming/:id" element={<UpcomingMovieDetails />} />
        <Route path='/movies/:id' element={<MovieDetails />} />
        <Route path='/movies/:id/:date' element={<SeatLayout />} />
        <Route path="/review-booking" element={<ReviewYourBooking />} />
        <Route path='/review-booking/:bookingId' element={<ReviewYourBooking />} />
        <Route path='/my-bookings' element={<MyBookings />} />
        <Route path='/loading/:nextUrl' element={<Loading />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />

        <Route path='/favorite' element={<Favorite />} />
        <Route path='/admin/*' element={user ? <Layout /> : (
          <div className='min-h-screen flex justify-center items-center'>
            <SignIn fallbackRedirectUrl={'/admin'} />
          </div>
        )}>
          <Route index element={<Dashboard />} />
          <Route path="list-shows" element={<ListShows />} />
          <Route path="list-bookings" element={<ListBookings />} />
          <Route path="show-details" element={<ShowDetails />} />
          <Route path="recycle-bin" element={<RecycleBin />} />
        </Route>
        <Route path='*' element={<NotFound />} />
      </Routes>
      {!isAdminRoute && <Footer />}
      <PendingPaymentBanner />
    </>
  )
}

export default App
