// components/TrailersSection.jsx - YouTube trailer carousel with play/pause functionality
import React, { useEffect, useState, useCallback } from "react";
import { PlayCircleIcon, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useAppContext } from "../context/AppContext";

const VISIBLE_COUNT = 5;

// Extract the YouTube video id from a watch/share/embed URL.
const getYouTubeId = (url = "") => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
};

const TrailersSection = () => {
  const { axios, image_base_url } = useAppContext();

  const [trailers, setTrailers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const currentTrailer =
    trailers.length > 0 ? trailers[currentIndex % trailers.length] : null;

  const fetchTrailers = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/show/trailers");

      if (data?.success && Array.isArray(data.trailers)) {
        setTrailers(data.trailers);
      } else {
        setTrailers([]);
      }
    } catch (err) {
      console.error("Trailer fetch error:", err.message);
      setTrailers([]);
    } finally {
      setLoading(false);
    }
  }, [axios]);


  useEffect(() => {
    fetchTrailers();
  }, [fetchTrailers, attempt]);

  const handleNext = useCallback(() => {
    if (!trailers.length) return;
    setCurrentIndex((prev) => (prev + 1) % trailers.length);
  }, [trailers.length]);

  const handlePrev = useCallback(() => {
    if (!trailers.length) return;
    setCurrentIndex((prev) => (prev - 1 + trailers.length) % trailers.length);
  }, [trailers.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (!trailers.length) return;
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [trailers.length, handleNext, handlePrev]);

  const getVisibleTrailers = () => {
    if (!trailers.length) return [];

    if (trailers.length <= VISIBLE_COUNT) {
      return trailers.map((t, idx) => ({ trailer: t, index: idx }));
    }

    const half = Math.floor(VISIBLE_COUNT / 2);
    const vis = [];

    for (let offset = -half; offset <= half; offset++) {
      const idx = (currentIndex + offset + trailers.length) % trailers.length;
      vis.push({ trailer: trailers[idx], index: idx });
    }

    return vis;
  };

  const visibleTrailers = getVisibleTrailers();
  const showSkeleton = loading && !currentTrailer;

  return (
    <section className="px-6 md:px-16 lg:px-24 xl:px-44 py-20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between max-w-[960px] mx-auto">
        <p className="text-shade font-semibold text-xl">
          Now Playing &amp; Upcoming Movies Trailers
        </p>
      </div>

      {/* Main player */}
      <div className="relative mt-6">
        {showSkeleton ? (
          <div className="mx-auto max-w-full w-[960px] h-[540px] bg-gray-800 rounded-xl animate-pulse" />
        ) : currentTrailer ? (
          <>
            <div className="relative mx-auto max-w-full w-[960px] h-[540px] rounded-xl overflow-hidden bg-black">
              <a
                href={`https://www.youtube.com/watch?v=${getYouTubeId(currentTrailer.videoUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group absolute inset-0 h-full w-full cursor-pointer"
                aria-label={`Play trailer on YouTube: ${currentTrailer.title}`}
              >
                <img
                  src={`https://img.youtube.com/vi/${getYouTubeId(currentTrailer.videoUrl)}/maxresdefault.jpg`}
                  onError={(e) => {
                    e.currentTarget.src = `https://img.youtube.com/vi/${getYouTubeId(currentTrailer.videoUrl)}/hqdefault.jpg`;
                  }}
                  alt={currentTrailer.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30 transition group-hover:from-black/60" />
                {/* Play button */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-black shadow-[0_10px_40px_-8px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-110">
                    <PlayCircleIcon className="h-9 w-9" />
                  </span>
                </span>
                {/* Title chip bottom-left */}
                <span className="absolute left-4 bottom-4 right-4 text-left text-white text-sm md:text-base font-semibold truncate drop-shadow">
                  {currentTrailer.title}
                </span>
              </a>
            </div>
            <div className="max-w-[960px] mx-auto mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm md:text-base text-gray-200 font-medium truncate">
                {currentTrailer.title}
              </p>

              <div className="flex items-center gap-2">
                {currentTrailer.source && (
                  <span className="text-[11px] md:text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300 uppercase tracking-wide">
                    {currentTrailer.source === "now" ? "Now Playing" : "Upcoming"}
                  </span>
                )}
                {getYouTubeId(currentTrailer.videoUrl) && (
                  <a
                    href={`https://www.youtube.com/watch?v=${getYouTubeId(currentTrailer.videoUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] md:text-xs px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition"
                  >
                    Watch on YouTube
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            className="mx-auto max-w-[960px] h-[200px]
                 bg-gray-900/60 rounded-xl
                 flex items-center justify-center
                 text-gray-400 text-sm"
          >
            Trailers coming soon 🎬
          </div>
        )}
      </div>

      {/* Thumbnails row */}
      <div className="relative mt-8 max-w-4xl mx-auto">
        {/* Left arrow */}
        <button
          onClick={handlePrev}
          className="absolute left-[-50px] top-1/2 -translate-y-1/2
                     p-2.5 rounded-full bg-gray-800 hover:bg-gray-700 z-50 
                     transition cursor-pointer disabled:opacity-30"
          disabled={trailers.length <= 1}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Thumbnails */}
        <div className="flex gap-4.5 justify-center">
          {showSkeleton
            ? Array(VISIBLE_COUNT)
              .fill(null)
              .map((_, idx) => (
                <div
                  key={idx}
                  className="h-28 md:h-36 w-24 sm:w-32 md:w-40 lg:w-44 
                               bg-gray-800 rounded-lg animate-pulse"
                />
              ))
            : visibleTrailers.map(({ trailer, index }) => {
              const isActive = index === currentIndex;

              return (
                <div
                  key={`${trailer.id}-${index}`}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative h-28 md:h-36 
                                w-24 sm:w-32 md:w-40 lg:w-44 
                                cursor-pointer group
                                transition-transform duration-300
                                ${isActive
                      ? "scale-110 opacity-100 z-10"
                      : "scale-95 opacity-60 grayscale"
                    }`}
                >
                  <img
                    src={image_base_url + trailer.image}
                    alt={trailer.title}
                    className="rounded-lg w-full h-full object-cover brightness-95
                                 group-hover:brightness-100 group-hover:scale-105
                                 transition-transform duration-300"
                    loading="lazy"
                  />
                  <PlayCircleIcon
                    strokeWidth={1.6}
                    className="absolute top-1/2 left-1/2 w-6 h-6 md:w-8 md:h-8 
                                 transform -translate-x-1/2 -translate-y-1/2"
                  />
                </div>
              );
            })}
        </div>

        {/* Right arrow */}
        <button
          onClick={handleNext}
          className="absolute right-[-50px] top-1/2 -translate-y-1/2
                     p-2.5 rounded-full bg-gray-800 hover:bg-gray-700 z-50 
                     transition cursor-pointer disabled:opacity-30"
          disabled={trailers.length <= 1}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
};

export default TrailersSection;