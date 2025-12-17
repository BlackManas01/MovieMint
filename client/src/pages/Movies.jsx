// src/pages/Movies.jsx
import React, { useEffect, useState } from "react";
import MovieCard from "../components/MovieCard";
import BlurCircle from "../components/BlurCircle";
import { useAppContext } from "../context/AppContext";
import MovieCardSkeleton from "../components/MovieCardSkeleton";

const Movies = () => {
  const { shows, loadingShows } = useAppContext();

  // Local flag: after a short delay, show the "No movies" fallback
  const [showEmptyMessage, setShowEmptyMessage] = useState(false);

  useEffect(() => {
    // Reset whenever loading starts
    if (loadingShows) {
      setShowEmptyMessage(false);
      return;
    }

    // If shows is undefined/null we treat as still loading (skeleton)
    if (shows === undefined || shows === null) {
      setShowEmptyMessage(false);
      return;
    }

    // If we have an empty array, wait a short time before showing the empty state.
    if (Array.isArray(shows) && shows.length === 0) {
      // Wait 1.2s (tweakable) before showing "No movies available".
      const timer = setTimeout(() => {
        setShowEmptyMessage(true);
      }, 3000);

      return () => clearTimeout(timer);
    }

    // We have shows (non-empty) — never show the empty message.
    setShowEmptyMessage(false);
  }, [loadingShows, shows]);

  const Wrapper = ({ children }) => (
    <div className="relative mt-36 pb-28 px-6 md:px-16 lg:px-40 xl:px-44">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="50px" right="50px" />

      {/* Heading */}
      <h1 className="text-2xl font-medium my-6 ml-25">Now in Theaters</h1>

      {children}
    </div>
  );

  // While shows are loading OR we are waiting for the small delay (to avoid flash) -> skeletons
  const showSkeletons =
    loadingShows ||
    shows === undefined ||
    shows === null ||
    (Array.isArray(shows) && shows.length === 0 && !showEmptyMessage);

  if (showSkeletons) {
    return (
      <Wrapper>
        <div className="flex flex-wrap justify-center gap-8 mt-8">
          {[...Array(8)].map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      </Wrapper>
    );
  }

  // If loading finished AND shows array is empty AND delay elapsed -> show message
  if (Array.isArray(shows) && shows.length === 0 && showEmptyMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-3xl font-bold text-center">No movies available</h1>
      </div>
    );
  }

  // Normal list (shows is a non-empty array)
  return (
    <Wrapper>
      <div className="flex flex-wrap justify-center gap-8 mt-8">
        {shows.map((movie) => (
          <MovieCard movie={movie} key={movie._id || movie.id} />
        ))}
      </div>
    </Wrapper>
  );
};

export default Movies;
