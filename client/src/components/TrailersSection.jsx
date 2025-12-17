import React, { useEffect, useState, useCallback } from "react";
import ReactPlayer from "react-player";
import { PlayCircleIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppContext } from "../context/AppContext";

const VISIBLE_COUNT = 5;

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
      // Global trailers from combined endpoint (now + upcoming)
      const { data } = await axios.get("/api/show/trailers");

      if (data?.success && Array.isArray(data.trailers) && data.trailers.length) {
        setTrailers(data.trailers);
        setCurrentIndex(0);
        setLoading(false);
      } else {
        throw new Error("Empty trailer list");
      }
    } catch (err) {
      console.error("Trailer fetch error:", err.message);

      if (!trailers.length) {
        setTimeout(() => setAttempt((a) => a + 1), 2000);
      } else {
        setLoading(false);
      }
    }
  }, [axios, trailers.length]);

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
        <p className="text-gray-300 font-medium text-lg">
          Now Playing &amp; Upcoming Movies Trailers
        </p>
      </div>

      {/* Main player */}
      <div className="relative mt-6">
        {showSkeleton ? (
          <div className="mx-auto max-w-full w-[960px] h-[540px] bg-gray-800 rounded-xl animate-pulse" />
        ) : currentTrailer ? (
          <>
            <ReactPlayer
              url={currentTrailer.videoUrl}
              controls
              playing={false}
              className="mx-auto max-w-full"
              width="960px"
              height="540px"
            />

            <div className="max-w-[960px] mx-auto mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm md:text-base text-gray-200 font-medium truncate">
                {currentTrailer.title}
              </p>

              {currentTrailer.source && (
                <span className="text-[11px] md:text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300 uppercase tracking-wide">
                  {currentTrailer.source === "now" ? "Now Playing" : "Upcoming"}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-full w-[960px] h-[200px] bg-gray-900/60 rounded-xl animate-pulse" />
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