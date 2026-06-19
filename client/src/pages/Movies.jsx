// pages/Movies.jsx - Now Showing / Coming Soon in one place, city-aware, with filters & sort
import React, { useEffect, useRef, useState } from "react";
import { FilmIcon, CalendarClockIcon, ChevronDown, AlertTriangleIcon } from "lucide-react";
import MovieCard from "../components/MovieCard";
import BlurCircle from "../components/BlurCircle";
import EmptyState from "../components/EmptyState";
import { useAppContext } from "../context/AppContext";
import MovieCardSkeleton from "../components/MovieCardSkeleton";
import { movieInCity } from "../lib/cities";
import { genreNames } from "../lib/genres";

const Movies = () => {
  const { shows, loadingShows, showsError, refetchShows, axios, city } = useAppContext();

  const [tab, setTab] = useState("now"); // "now" | "coming"
  const [activeGenre, setActiveGenre] = useState("All");
  const [sortBy, setSortBy] = useState("popularity");
  const [sortOpen, setSortOpen] = useState(false);
  const [showEmptyMessage, setShowEmptyMessage] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => sortRef.current && !sortRef.current.contains(e.target) && setSortOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Coming Soon data (fetched lazily on first open)
  const [upcoming, setUpcoming] = useState(null);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  useEffect(() => setActiveGenre("All"), [tab]);

  // Now-showing empty delay
  useEffect(() => {
    if (loadingShows || shows == null) {
      setShowEmptyMessage(false);
      return;
    }
    if (Array.isArray(shows) && shows.length === 0) {
      const t = setTimeout(() => setShowEmptyMessage(true), 3000);
      return () => clearTimeout(t);
    }
    setShowEmptyMessage(false);
  }, [loadingShows, shows]);

  // Fetch upcoming the first time the Coming Soon tab is opened
  useEffect(() => {
    if (tab !== "coming" || upcoming !== null) return;
    let active = true;
    setLoadingUpcoming(true);
    axios
      .get("/api/show/upcoming")
      .then(({ data }) =>
        active && setUpcoming(data?.success && Array.isArray(data.movies) ? data.movies : [])
      )
      .catch(() => active && setUpcoming([]))
      .finally(() => active && setLoadingUpcoming(false));
    return () => {
      active = false;
    };
  }, [tab, upcoming, axios]);

  const today = new Date().toISOString().split("T")[0];

  // Base list for the active tab
  const baseList =
    tab === "now"
      ? Array.isArray(shows)
        ? shows.filter((m) => movieInCity(m._id || m.id, city))
        : []
      : Array.isArray(upcoming)
        ? upcoming.filter((m) => (m.release_date || "") > today)
        : [];

  const genres = [
    "All",
    ...Array.from(new Set(baseList.flatMap((m) => genreNames(m)))).sort(),
  ];

  const visible = baseList
    .filter((m) =>
      activeGenre === "All" ? true : genreNames(m).includes(activeGenre)
    )
    .sort((a, b) => {
      if (sortBy === "rating") return (b.vote_average || 0) - (a.vote_average || 0);
      if (sortBy === "release") {
        const da = new Date(a.release_date || 0);
        const db = new Date(b.release_date || 0);
        // Coming Soon: soonest releasing first. Now Showing: newest first.
        return tab === "coming" ? da - db : db - da;
      }
      return (b.popularity || b.vote_count || 0) - (a.popularity || a.vote_count || 0);
    });

  const SORTS = [
    { value: "popularity", label: "Popularity" },
    { value: "rating", label: "Rating" },
    { value: "release", label: tab === "coming" ? "Release date (soonest)" : "Release date (newest)" },
  ];

  const isLoading =
    tab === "now"
      ? loadingShows
      : upcoming === null || loadingUpcoming;

  return (
    <div className="relative mt-28 pb-28 px-6 md:px-16 lg:px-40 xl:px-44">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="50px" right="50px" />

      {/* Heading */}
      <h1 className="text-shade text-2xl font-semibold mb-6">
        {tab === "now" ? `Now Showing in ${city}` : "Coming Soon"}
      </h1>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          ["now", "Now Showing"],
          ["coming", "Coming Soon"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition cursor-pointer ${
              tab === k
                ? "bg-primary text-black"
                : "bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters + sort */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-8">
        <div className="flex flex-wrap gap-2">
          {genres.slice(0, 9).map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                activeGenre === g
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-white/5 text-gray-300 border border-white/10 hover:border-primary/30"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div ref={sortRef} className="relative flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">Sort by</span>
          <button
            onClick={() => setSortOpen((o) => !o)}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-gray-200 hover:border-primary/40 transition cursor-pointer"
          >
            {SORTS.find((s) => s.value === sortBy)?.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[rgb(var(--surface-rgb)/0.97)] backdrop-blur-xl shadow-2xl p-1 z-50">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    setSortBy(s.value);
                    setSortOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition cursor-pointer ${
                    sortBy === s.value ? "bg-primary/15 text-primary" : "hover:bg-white/5 text-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-wrap justify-center gap-8">
          {[...Array(8)].map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      ) : tab === "now" && showsError ? (
        <EmptyState
          icon={AlertTriangleIcon}
          title="Couldn't load movies"
          subtitle="Something went wrong while fetching shows. Please check your connection and try again."
          action={
            <button
              onClick={() => refetchShows && refetchShows()}
              className="px-6 py-2.5 rounded-full text-sm font-medium bg-primary hover:bg-primary-dull text-black transition cursor-pointer"
            >
              Try again
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={tab === "now" ? FilmIcon : CalendarClockIcon}
          title={
            tab === "now"
              ? activeGenre === "All"
                ? `No movies in ${city} right now`
                : `No “${activeGenre}” movies in ${city}`
              : "No upcoming movies"
          }
          subtitle={
            tab === "now"
              ? "Try another city or check what's coming soon."
              : "We'll list new releases here as soon as they're announced."
          }
          action={
            tab === "now" ? (
              <button
                onClick={() => setTab("coming")}
                className="px-6 py-2.5 rounded-full text-sm font-medium bg-primary hover:bg-primary-dull text-black transition"
              >
                See Coming Soon
              </button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-wrap justify-center gap-8">
          {visible.map((movie) => (
            <MovieCard movie={movie} key={movie._id || movie.id} isUpcoming={tab === "coming"} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Movies;
