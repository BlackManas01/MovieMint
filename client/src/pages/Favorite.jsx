// pages/Favorite.jsx - Displays the user's saved favorite movies
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartIcon } from 'lucide-react'
import MovieCard from '../components/MovieCard'
import MovieCardSkeleton from '../components/MovieCardSkeleton'
import BlurCircle from '../components/BlurCircle'
import EmptyState from '../components/EmptyState'
import { useAppContext } from '../context/AppContext'

const Favorite = () => {

  const {favoriteMovies} = useAppContext()

  // Brief loading window so favorites can resolve before showing the empty state
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(t)
  }, [])

  if (loading && favoriteMovies.length === 0) {
    return (
      <div className='relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]'>
        <BlurCircle top="150px" left="0px"/>
        <BlurCircle bottom="50px" right="50px"/>
        <h1 className='text-shade text-2xl font-semibold my-4'>Your Favorite Movies</h1>
        <div className='flex flex-wrap max-sm:justify-center gap-8'>
          {Array.from({ length: 4 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return favoriteMovies.length > 0 ? (
    <div className='relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]'>

      <BlurCircle top="150px" left="0px"/>
      <BlurCircle bottom="50px" right="50px"/>

      <h1 className='text-shade text-2xl font-semibold my-4'>Your Favorite Movies</h1>
      <div className='flex flex-wrap max-sm:justify-center gap-8'>
        {favoriteMovies.map((movie)=> (
          <MovieCard movie={movie} key={movie._id}/>
        ))}
      </div>
    </div>
  ) : (
    <div className='flex items-center justify-center min-h-[80vh]'>
      <EmptyState
        icon={HeartIcon}
        title="No favorites yet"
        subtitle="Tap the heart on any movie to save it here for quick access."
        action={
          <Link
            to="/movies"
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-primary hover:bg-primary-dull text-black transition"
          >
            Browse Movies
          </Link>
        }
      />
    </div>
  )
}

export default Favorite

