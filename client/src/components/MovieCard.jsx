// src/components/MovieCard.jsx
import { StarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import timeFormat from "../lib/timeFormat";
import MovieCardSkeleton from "./MovieCardSkeleton"; // use your existing skeleton

/**
 * MovieCard
 *
 * Props:
 *  - movie: movie object (required)
 *  - isUpcoming: boolean (default false)
 *  - loading: boolean (default false) -> if true, render MovieCardSkeleton
 *
 * Notes:
 *  - If runtime is missing in the provided movie object, the component
 *    will call `/api/show/now-playing/:id` (fast details) once to fetch runtime.
 *    This keeps the UI showing runtime instead of `N/A`.
 */
const MovieCard = ({ movie, isUpcoming = false, loading = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { image_base_url, axios } = useAppContext();

  // If parent tells us to show loading, render skeleton (no extra network)
  if (loading) return <MovieCardSkeleton />;

  const movieId = movie?._id || movie?.id;
  if (!movieId) return null;

  const handleClick = () => {
    // Remember where we came from so the detail page's Back returns here (loop-proof).
    const from = location.pathname + location.search;
    navigate(isUpcoming ? `/upcoming/${movieId}` : `/movies/${movieId}`, { state: { from } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : "";

  const imagePath = movie.backdrop_path || movie.poster_path || "";

  /**
   * Resolve runtime (in minutes) from several possible fields.
   * Return a number or null.
   */
  const resolveRuntimeMinutesFromMovie = (m) => {
    if (!m) return null;
    const candidates = [
      m?.runtime,
      m?.run_time,
      m?.duration,
      m?.length,
      m?.runtimeMinutes,
      m?.runTime,
    ];
    for (const c of candidates) {
      if (c == null) continue;
      const n = Number(c);
      if (!Number.isFinite(n) || n <= 0) continue;
      // If backend accidentally gave seconds (very large), convert to minutes
      if (n > 1000) return Math.round(n / 60);
      return Math.round(n);
    }
    return null;
  };

  // Local runtime state: try to use movie prop first, otherwise fetch
  const initialRuntime = resolveRuntimeMinutesFromMovie(movie);
  const [runtimeMinutes, setRuntimeMinutes] = useState(initialRuntime);
  const [fetchingRuntime, setFetchingRuntime] = useState(false);

  useEffect(() => {
    // If parent updates movie prop, try to resolve again
    const r = resolveRuntimeMinutesFromMovie(movie);
    setRuntimeMinutes(r);
  }, [movie]);

  useEffect(() => {
    let mounted = true;

    // If runtime already found, nothing to do
    if (runtimeMinutes) return;

    // Avoid repeated fetches
    if (fetchingRuntime) return;

    // Lazy fetch from fast TMDB backend endpoint only when runtime missing
    const fetchRuntime = async () => {
      try {
        setFetchingRuntime(true);
        const res = await axios.get(`/api/show/now-playing/${movieId}`); // same endpoint used elsewhere
        if (!mounted) return;
        if (res?.data?.success && res.data.movie) {
          const m = res.data.movie;
          const r = resolveRuntimeMinutesFromMovie(m);
          if (r) setRuntimeMinutes(r);
        }
      } catch (err) {
        // silent fail — we simply won't show runtime if fetch fails
        // console.debug("MovieCard runtime fetch failed:", err?.message || err);
      } finally {
        if (mounted) setFetchingRuntime(false);
      }
    };

    fetchRuntime();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, runtimeMinutes]);

  const runtimeLabel = runtimeMinutes ? timeFormat(runtimeMinutes) : null;

  return (
    <div
      className="group w-66 overflow-hidden rounded-2xl bg-white/[0.03] border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_60px_-30px_rgba(168,85,247,0.7)] will-change-transform"
    >
      {/* Poster */}
      <div className="relative cursor-pointer overflow-hidden" onClick={handleClick}>
        {imagePath ? (
          <img
            loading="lazy"
            src={image_base_url + imagePath}
            alt={movie.title}
            className="h-72 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-72 w-full bg-white/5 flex items-center justify-center text-xs text-gray-500">No image</div>
        )}
        {/* bottom scrim so the poster fades into the card body */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 surface-fade-up" />
      </div>

      {/* Body */}
      <div className="p-3 pt-2.5">
        {/* Movie Name */}
        <p className="font-semibold truncate">{movie.title}</p>

        {/* Release / runtime info */}
        <p className="text-sm text-gray-400 mt-1">
          {isUpcoming ? (
            `Releasing on: ${movie.release_date}`
          ) : (
            <>
              {releaseYear}
              {movie.genres?.length ? " • " : ""}
              {movie.genres?.slice(0, 2).map((g) => g.name).join(" | ")}
              {runtimeLabel ? ` • ${runtimeLabel}` : ""}
            </>
          )}
        </p>

        {/* Button + Rating */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={handleClick}
            className="px-4 py-2 text-xs rounded-full font-medium cursor-pointer transition text-black bg-primary hover:bg-primary-dull"
          >
            {isUpcoming ? "View Details" : "Buy Tickets"}
          </button>

          {!isUpcoming && (
            <p className="flex items-center gap-1 text-sm text-gray-400 pr-1">
              <StarIcon className="w-4 h-4 text-amber-400 fill-amber-400" />
              {movie.vote_average?.toFixed ? movie.vote_average.toFixed(1) : movie.vote_average}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
