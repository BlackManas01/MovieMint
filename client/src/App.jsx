import { SignIn } from '@clerk/clerk-react'
import { Toaster } from 'react-hot-toast'
import { Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/Footer'
import Loading from './components/Loading'
import Navbar from './components/Navbar'
import { useAppContext } from './context/AppContext'
import Favorite from './pages/Favorite'
import Home from './pages/Home'
import MovieDetails from './pages/MovieDetails'
import Movies from './pages/Movies'
import MyBookings from './pages/MyBookings'
import SeatLayout from './pages/SeatLayout'
import Upcoming from './pages/Upcoming'
import UpcomingMovieDetails from './pages/UpcomingMovieDetails'
import Dashboard from './pages/admin/Dashboard'
import Layout from './pages/admin/Layout'
import ListBookings from './pages/admin/ListBookings'
import ListShows from './pages/admin/ListShows'
import ShowDetails from './pages/admin/ShowDetails'
import ReviewYourBooking from './pages/ReviewYourBooking'
import PaymentSuccess from './pages/PaymentSuccess'

const App = () => {

  const isAdminRoute = useLocation().pathname.startsWith('/admin')

  const { user } = useAppContext()

  return (
    <>
      <Toaster />
      {!isAdminRoute && <Navbar />}
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/movies' element={<Movies />} />
        <Route path='/upcoming' element={<Upcoming />} />
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
        </Route>
      </Routes>
      {!isAdminRoute && <Footer />}
    </>
  )
}

export default App
