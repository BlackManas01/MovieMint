// src/components/HeroSection.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  ArrowRight,
  CalendarIcon,
  ClockIcon,
  StarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import timeFormat from "../lib/timeFormat";

const HERO_UPCOMING_COUNT = 3;
const AUTO_SLIDE_DELAY = 7000;

const HeroSection = () => {
  const navigate = useNavigate();
  const { axios, image_base_url } = useAppContext();

  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  // displayIndex is based on the "extendedSlides" array:
  // [ last, ...slides, first ]
  const [displayIndex, setDisplayIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch upcoming movies once
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const { data } = await axios.get("/api/show/upcoming");

        if (data?.success && Array.isArray(data.movies)) {
          const today = new Date().toISOString().split("T")[0];

          const futureMovies = data.movies
            .filter((m) => m.release_date >= today)
            .sort(
              (a, b) => new Date(a.release_date) - new Date(b.release_date)
            )
            .slice(0, HERO_UPCOMING_COUNT);

          setUpcoming(futureMovies);
          if (futureMovies.length === 1) setDisplayIndex(0);
        }
      } catch (err) {
        console.error("Hero fetch error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcoming();
  }, [axios]);

  const slides = upcoming;

  // Extended slides for seamless loop:
  // [lastSlide, ...slides, firstSlide]
  const extendedSlides =
    slides.length > 1
      ? [slides[slides.length - 1], ...slides, slides[0]]
      : slides;

  // Go to next slide
  const handleNext = useCallback(() => {
    // Do not move when:
    // - There is 0 or 1 slide
    // - A transition is already running
    if (slides.length <= 1 || isTransitioning) return;

    setIsTransitioning(true);
    setDisplayIndex((prev) => prev + 1);
  }, [slides.length, isTransitioning]);

  // Go to previous slide
  const handlePrev = useCallback(() => {
    if (slides.length <= 1 || isTransitioning) return;

    setIsTransitioning(true);
    setDisplayIndex((prev) => prev - 1);
  }, [slides.length, isTransitioning]);

  // Auto slide with delay, also respects transition lock
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      // Only move automatically when we are not in the middle of an animation
      if (!isTransitioning) {
        handleNext();
      }
    }, AUTO_SLIDE_DELAY);

    return () => clearInterval(timer);
  }, [handleNext, slides.length, isPaused, isTransitioning]);

  // Fix index when we hit the cloned slides at edges
  const handleTransitionEnd = () => {
    setIsTransitioning(false);
    if (slides.length <= 1) return;

    if (displayIndex === 0) {
      // We moved to the cloned "last" at the beginning → jump to real last
      setDisplayIndex(slides.length);
    } else if (displayIndex === slides.length + 1) {
      // We moved to the cloned "first" at the end → jump to real first
      setDisplayIndex(1);
    }
  };

  // Render a single hero slide
  const renderSlide = (movie) => {
    const releaseDate = movie?.release_date || "N/A";
    const runtime = movie.runtime ? timeFormat(movie.runtime) : "";
    const rating = "N/A";
    const bgImage = movie.backdrop_path || movie.poster_path;

    return (
      <div
        className="relative min-w-full h-full flex items-center px-6 md:px-16 lg:px-36"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.9) 15%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.9)), url("${image_base_url + bgImage
            }")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-2xl space-y-4 mt-20">
          <p className="text-xs uppercase tracking-[0.3em] text-primary opacity-90">
            Upcoming
          </p>
          <h1 className="text-4xl md:text-[56px] font-semibold">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-gray-200 text-sm">
            <div className="flex items-center gap-1">
              <CalendarIcon className="w-4 h-4" />
              {releaseDate}
            </div>

            {runtime && (
              <div className="flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                {runtime}
              </div>
            )}

            <div className="flex items-center gap-1">
              <StarIcon className="w-4 h-4 text-primary fill-primary" />
              {rating}
            </div>
          </div>

          <p className="max-w-xl text-gray-300 text-sm md:text-base line-clamp-4">
            {movie.overview}
          </p>

          <button
            onClick={() => {
              navigate(`/upcoming/${movie.id}`);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2 px-7 py-3 text-sm bg-teal-700 hover:bg-teal-600 transition rounded-full font-medium cursor-pointer"
          >
            View Details
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Full-screen skeleton while loading */}
      {loading ? (
        <div className="absolute inset-0 bg-black flex items-center px-6 md:px-16 lg:px-36 animate-pulse">
          <div className="space-y-5 max-w-2xl mt-28">
            {/* Title skeleton */}
            <div className="h-10 w-64 bg-gray-800 rounded-lg" />

            {/* Genre & rating row skeleton */}
            <div className="flex gap-4">
              <div className="h-4 w-24 bg-gray-800 rounded-md" />
              <div className="h-4 w-20 bg-gray-800 rounded-md" />
              <div className="h-4 w-20 bg-gray-800 rounded-md" />
            </div>

            {/* Overview skeleton */}
            <div className="space-y-3">
              <div className="h-3 w-80 bg-gray-800 rounded-md" />
              <div className="h-3 w-[22rem] bg-gray-800 rounded-md" />
              <div className="h-3 w-[18rem] bg-gray-800 rounded-md" />
            </div>

            {/* Button skeleton */}
            <div className="h-11 w-40 bg-gray-800 rounded-full" />
          </div>
        </div>
      ) : (
        <>
          {/* Slider track */}
          <div
            className="flex h-full"
            style={{
              transform: `translateX(-${displayIndex * 100}%)`,
              transition: isTransitioning ? "transform 0.55s ease-out" : "none",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {extendedSlides.map((m, i) => (
              <React.Fragment key={i}>{renderSlide(m)}</React.Fragment>
            ))}
          </div>

          {/* Left arrow */}
          <button
            onClick={handlePrev}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="hidden md:flex items-center justify-center
                       w-10 h-10 rounded-full cursor-pointer
                       bg-gray-800/70 hover:bg-gray-600
                       transition duration-200 
                       absolute left-6 top-1/2 -translate-y-1/2 text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Right arrow */}
          <button
            onClick={handleNext}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="hidden md:flex items-center justify-center
                       w-10 h-10 rounded-full cursor-pointer
                       bg-gray-800/70 hover:bg-gray-600
                       transition duration-200 
                       absolute right-6 top-1/2 -translate-y-1/2 text-white"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
};

export default HeroSection;
