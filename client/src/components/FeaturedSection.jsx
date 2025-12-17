// src/components/FeaturedSection.jsx
import { ArrowRight } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MovieCard from "./MovieCard";
// MovieCardSkeleton is no longer conditionally mounted here; MovieCard handles loading internally.
import { useAppContext } from "../context/AppContext";

/**
 * FeaturedSection
 * - Always renders fixed number of MovieCard slots (4).
 * - If shows not loaded or missing at a slot -> pass loading={true} so MovieCard shows skeleton.
 * - Resolves missing runtime values in background and patches movie objects passed to MovieCard.
 */
const FeaturedSection = () => {
  const navigate = useNavigate();
  const { shows = [], loadingShows = false, axios } = useAppContext();

  // local runtime cache: { [movieId]: minutes | null (fetched but missing) }
  const [runtimeCache, setRuntimeCache] = useState({});

  // helper: pick movie id from various shapes (movie doc or show doc)
  const getMovieId = (s) => s?._id || s?.id || s?.movie?._id || s?.movie?.id || null;

  // normalize runtime values to minutes (null when not resolvable)
  const normalizeToMinutes = (val) => {
    if (val == null) return null;
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num > 1000 ? Math.round(num / 60) : Math.round(num);
  };

  /**
   * Effect: find movie ids that are missing runtime and not yet attempted,
   * then fetch fast TMDB details for them with small concurrency.
   *
   * Note: runtimeCache is intentionally excluded from deps so the effect
   * only re-runs when `shows` changes (avoids runaway loops).
   */
  useEffect(() => {
    if (!shows || !shows.length) return;

    const queue = [];
    for (const s of shows.slice(0, 8)) {
      // only check top few to avoid big fanout
      const id = getMovieId(s);
      if (!id) continue;

      const movieObj = s.movie || s;
      const hasRuntime =
        movieObj &&
        (movieObj.runtime ||
          movieObj.run_time ||
          movieObj.duration ||
          movieObj.length ||
          movieObj.runtime === 0);

      // skip if runtime present OR we've already attempted fetch (present in runtimeCache)
      if (!hasRuntime && runtimeCache[id] === undefined) {
        queue.push(id);
      }
    }

    if (!queue.length) return;

    let cancelled = false;
    const CONCURRENCY = 3;
    const uniqueQueue = Array.from(new Set(queue));

    const worker = async () => {
      while (uniqueQueue.length && !cancelled) {
        const movieId = uniqueQueue.shift();
        try {
          const res = await axios.get(`/api/show/now-playing/${movieId}`);
          if (res?.data?.success && res.data.movie) {
            const raw = res.data.movie.runtime ?? res.data.movie.run_time ?? res.data.movie.duration ?? null;
            const minutes = normalizeToMinutes(raw);
            // set resolved (either minutes or null if unresolved)
            setRuntimeCache((prev) => ({ ...prev, [movieId]: minutes }));
          } else {
            setRuntimeCache((prev) => ({ ...prev, [movieId]: null }));
          }
        } catch (err) {
          // don't throw; mark attempted
          setRuntimeCache((prev) => ({ ...prev, [movieId]: null }));
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
    Promise.all(workers).catch(() => { });

    return () => {
      cancelled = true;
    };

    // intentionally excluding runtimeCache to avoid effect re-runs from our own setRuntimeCache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shows, axios]);

  /**
   * Build movie object with resolved runtime (if available in cache or original).
   * Returns an object safe to pass to MovieCard.
   */
  const withResolvedRuntime = (s) => {
    if (!s) return null;
    const movie = s.movie || s;
    const movieId = getMovieId(s);
    const runtimeOnObj =
      movie?.runtime ?? movie?.run_time ?? movie?.duration ?? movie?.length ?? null;

    const cached = movieId ? runtimeCache[movieId] : undefined;
    const resolved = cached === undefined ? runtimeOnObj : cached;

    const runtimeNormalized = normalizeToMinutes(resolved);
    // shallow copy so we don't mutate original
    return { ...movie, runtime: runtimeNormalized ?? movie.runtime };
  };

  // We'll always render 4 slots (stable component tree), mapping to either a real show or a skeleton-loading MovieCard.
  const SLOTS = 4;
  const slotsArray = Array.from({ length: SLOTS });

  return (
    <section className="px-6 md:px-16 lg:px-24 xl:px-44 pt-24 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-10">
        <p className="text-gray-300 font-semibold text-2xl ml-25">Now in Theaters</p>

        <button
          onClick={() => navigate("/movies")}
          className="group flex items-center gap-2 text-m text-gray-400 hover:text-white cursor-pointer mr-25"
        >
          View All
          <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 transition" />
        </button>
      </div>

      {/* Movie list: always render fixed slots */}
      <div className="flex flex-wrap justify-center gap-8">
        {slotsArray.map((_, idx) => {
          const showAtIdx = shows?.[idx] ?? null;
          if (loadingShows || !showAtIdx) {
            // show loading skeleton via MovieCard's loading prop
            // key must be stable per position to keep component instances stable across renders
            return <MovieCard key={`slot-${idx}`} loading={true} />;
          } else {
            const movieWithRuntime = withResolvedRuntime(showAtIdx);
            // prefer using movie id as key if present for stable identity
            const movieId = movieWithRuntime?._id || movieWithRuntime?.id || `slot-${idx}`;
            return <MovieCard key={movieId} movie={movieWithRuntime} />;
          }
        })}
      </div>

      {/* Show More btn → only if real data */}
      {!loadingShows && shows.length > 0 && (
        <div className="flex justify-center mt-14">
          <button
            onClick={() => {
              navigate("/movies");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="px-10 py-3 text-sm bg-teal-700 hover:bg-teal-600 transition rounded-full font-medium cursor-pointer"
          >
            Show More
          </button>
        </div>
      )}
    </section>
  );
};

export default FeaturedSection;
