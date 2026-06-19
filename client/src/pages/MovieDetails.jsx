// pages/MovieDetails.jsx - Full movie detail page with showtimes, trailers, cast, and date/theater selection
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Heart, PlayCircleIcon, StarIcon, X, Clapperboard, MapPin, Clock, ShieldCheck, ArrowLeft } from "lucide-react";
import BlurCircle from "../components/BlurCircle";
import timeFormat from "../lib/timeFormat";
import DateSelect from "../components/DateSelect";
import MovieCard from "../components/MovieCard";
import MovieReviews from "../components/MovieReviews";
import MovieDetailSkeleton from "../components/MovieDetailSkeleton";
import AgeGate from "../components/AgeGate";
import HScroller from "../components/HScroller";
import { useAppContext } from "../context/AppContext";
import { formatScreen, partOfDay, PARTS_OF_DAY, availabilityFromRatio, seatPressure, langFor } from "../lib/screenLabel";
import { addRecent } from "../lib/recentlyViewed";
import toast from "react-hot-toast";

const MovieDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const [show, setShow] = useState(null);            // holds `{ success, movie, dateTime }` from backend
  const [tmdbMovie, setTmdbMovie] = useState(null);  // enriched TMDB movie (for trailer, etc.)
  const [showTrailer, setShowTrailer] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLang, setSelectedLang] = useState("All");
  const [ageVerified, setAgeVerified] = useState(() => {
    try {
      return sessionStorage.getItem("ageVerified") === "1";
    } catch {
      return false;
    }
  });
  const [daySlots, setDaySlots] = useState([]);      // normalized slots for a single day
  const [myBooking, setMyBooking] = useState(null);  // user's existing paid booking for this movie

  const {
    shows,
    axios,
    getToken,
    user,
    fetchFavoriteMovies,
    favoriteMovies,
    image_base_url,
    city,
  } = useAppContext();

  /* --------------------------------------------------------------------------
   * If the user already has a paid booking for THIS movie (upcoming show),
   * surface it on the detail page so they instantly see "you're booked".
   * ----------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    setMyBooking(null);
    if (!user) return;
    (async () => {
      try {
        const { data } = await axios.get("/api/user/bookings", {
          headers: { Authorization: `Bearer ${await getToken()}` },
        });
        if (cancelled || !data?.success || !Array.isArray(data.bookings)) return;
        const now = Date.now();
        const mine = data.bookings
          .filter((b) => b.isPaid)
          .map((b) => {
            const mid = b.show?.movie?._id || b.show?.movie || b.movie?._id || b.movie || b.movieId;
            const when = b.show?.showDateTime || b.show?.showTime || b.showDateTime;
            return { b, mid: String(mid || ""), t: when ? new Date(when).getTime() : 0 };
          })
          .filter((x) => x.mid === String(id) && x.t > now)
          .sort((a, z) => a.t - z.t);
        if (mine.length) {
          const { b, t } = mine[0];
          setMyBooking({
            theater: b.show?.theater?.name || b.show?.theaterName || b.theaterName || "your cinema",
            seats: (b.seats || b.bookedSeats || []).join(", "),
            when: t,
          });
        }
      } catch { /* ignore — banner is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [id, user, axios, getToken]);

  /* --------------------------------------------------------------------------
   * Backend: load show data for this movie
   * ----------------------------------------------------------------------- */

  /**
   * Fetch booking data for this movie from `/api/show/:id`.
   * The backend:
   *   - Ensures default shows exist (ensureDefaultShowsForMovie).
   *   - Returns `movie` and `dateTime` grouped by date.
   */
  const getShow = async () => {
    try {
      const { data } = await axios.get(`/api/show/${id}`);
      if (data.success) {
        setShow(data);
      } else {
        setShow(null);
      }
    } catch (error) {
      console.error("getShow error:", error);
      setShow(null);
    }
  };

  /* --------------------------------------------------------------------------
   * TMDB: load extra details (trailer, images, etc.)
   * ----------------------------------------------------------------------- */

  const getNowPlayingDetails = async () => {
    try {
      const { data } = await axios.get(`/api/show/now-playing/${id}`);
      if (data.success) {
        setTmdbMovie(data.movie);
      }
    } catch (error) {
      // TMDB details fetch failed silently
    }
  };

  /* --------------------------------------------------------------------------
   * Favorites (wishlist) handling
   * ----------------------------------------------------------------------- */

  const handleFavorite = async () => {
    try {
      if (!user) return toast.error("Please login to proceed");

      const { data } = await axios.post(
        "/api/user/update-favorite",
        { movieId: id },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );

      if (data.success) {
        await fetchFavoriteMovies();
        toast.success(data.message);
      }
    } catch (error) {
      // Favorite toggle failed silently
    }
  };

  const isFavorite = favoriteMovies.find((m) => m._id === id);

  /* --------------------------------------------------------------------------
   * Trailer popup
   * ----------------------------------------------------------------------- */

  const handleWatchTrailer = () => {
    if (!tmdbMovie || !tmdbMovie.trailer) {
      return toast.error("Trailer not available");
    }
    setShowTrailer(true);
  };

  const trailerEmbedUrl = tmdbMovie?.trailer
    ? tmdbMovie.trailer.replace("watch?v=", "embed/")
    : null;

  /* --------------------------------------------------------------------------
   * Initial load / when route id changes
   * ----------------------------------------------------------------------- */

  useEffect(() => {
    setShow(null);
    setTmdbMovie(null);
    setShowTrailer(false);
    setSelectedDate(null);
    setDaySlots([]);

    getShow();
    getNowPlayingDetails();

    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* --------------------------------------------------------------------------
   * When user picks a date → normalize slots for that date
   * ----------------------------------------------------------------------- */

  useEffect(() => {
    if (!show || !show.dateTime || !selectedDate) {
      setDaySlots([]);
      return;
    }

    const rawSlots = show.dateTime[selectedDate] || [];

    /**
     * Normalize backend slot structure so the UI layer is clean:
     *  - Ensure each slot has an `id`.
     *  - Pick theater metadata coming from backend (seedTheaters).
     *  - Keep format / experience / language for display.
     */
    const normalized = rawSlots.map((slot, idx) => {
      const id = slot.showId || slot._id || `${selectedDate}-${idx}`;
      const realLang = slot.language && slot.language !== "English" ? slot.language : null;
      return {
        id,
        time: slot.time,
        theaterId: slot.theaterId || null,
        theaterName: slot.theaterName || "Unknown Theater",
        theaterCity: slot.theaterCity || "",
        theaterAddress: slot.theaterAddress || "",
        format: slot.format || slot.type || "2D",
        experience: slot.experience || slot.screenType || "Standard",
        language: realLang || langFor(id),
      };
    });

    setDaySlots(normalized);
  }, [show, selectedDate]);

  /* --------------------------------------------------------------------------
   * Group normalized slots by theater
   * ----------------------------------------------------------------------- */

  const groupedByTheater = React.useMemo(() => {
    const map = new Map();

    daySlots.forEach((slot) => {
      // Ignore any slot that does not have a valid theater name.
      if (!slot.theaterName) return;
      // Skip shows that have already started / passed — customers can't book them.
      if (new Date(slot.time).getTime() <= Date.now()) return;
      // City filter — only show theaters in the selected city.
      if (city && slot.theaterCity && slot.theaterCity !== city) return;
      // Language filter.
      if (selectedLang !== "All" && slot.language !== selectedLang) return;

      const key = slot.theaterName;

      if (!map.has(key)) {
        map.set(key, {
          theaterName: key,
          city: slot.theaterCity || "",
          address: slot.theaterAddress || "",
          slots: [],
        });
      }
      map.get(key).slots.push(slot);
    });

    const result = Array.from(map.values()).map((theater) => ({
      ...theater,
      slots: [...theater.slots].sort(
        (a, b) => new Date(a.time) - new Date(b.time)
      ),
    }));

    return result;
  }, [daySlots, city, selectedLang]);

  // Distinct languages available for the selected date/city (for the filter bar)
  const availableLanguages = React.useMemo(() => {
    const set = new Set(
      daySlots
        .filter((s) => !city || !s.theaterCity || s.theaterCity === city)
        .map((s) => s.language)
        .filter(Boolean)
    );
    return Array.from(set);
  }, [daySlots, city]);

  // Reset the language filter when the date or city changes.
  useEffect(() => {
    setSelectedLang("All");
  }, [city, selectedDate]);

  /* --------------------------------------------------------------------------
   * When a user clicks on a specific time → go to seat selection
   * ----------------------------------------------------------------------- */

  const handleTimeClick = (slot) => {
    if (!selectedDate) {
      return toast("Please select a date first");
    }
    const params = new URLSearchParams();
    if (slot.id) params.set("showId", slot.id);
    if (slot.time) params.set("time", slot.time);

    navigate(`/movies/${id}/${selectedDate}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* --------------------------------------------------------------------------
   * Track recently viewed (for the home "Recently viewed" row)
   * ----------------------------------------------------------------------- */
  useEffect(() => {
    if (show?.movie?.title) addRecent(show.movie);
  }, [show]);

  /* --------------------------------------------------------------------------
   * Guard: while show is loading or missing
   * ----------------------------------------------------------------------- */

  if (!show) return <MovieDetailSkeleton />;

  const movie = show.movie;
  const releaseYear = movie.release_date?.slice(0, 4) || "";

  /* --------------------------------------------------------------------------
   * Render
   * ----------------------------------------------------------------------- */

  return (
    <div className="px-6 md:px-16 lg:px-40 pt-30 md:pt-50">
      {/* 18+ age verification */}
      <AgeGate
        open={!!movie.adult && !ageVerified}
        certificate="A · 18+"
        onConfirm={() => {
          try { sessionStorage.setItem("ageVerified", "1"); } catch { /* ignore */ }
          setAgeVerified(true);
        }}
        onCancel={() => navigate("/")}
      />

      {/* Back button */}
      <button
        onClick={() => navigate(location.state?.from || "/movies")}
        className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-sm bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* You're already booked for this movie */}
      {myBooking && (
        <button
          onClick={() => navigate("/my-bookings")}
          className="w-full text-left mb-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-2xl border border-primary/30 bg-primary/10 backdrop-blur-sm px-4 py-3 hover:border-primary/50 transition cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 font-semibold text-primary">
            🎟️ You're booked for this movie
          </span>
          <span className="text-sm text-gray-200">
            {myBooking.seats && <>Seats <b className="text-white">{myBooking.seats}</b> · </>}
            {myBooking.theater} · {new Date(myBooking.when).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="sm:ml-auto text-xs text-primary/80 underline underline-offset-2 shrink-0">View booking →</span>
        </button>
      )}

      {/* Trailer Popup */}
      {showTrailer && trailerEmbedUrl && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-black rounded-xl p-2 relative max-w-4xl w-full shadow-xl">
            <button
              onClick={() => setShowTrailer(false)}
              className="absolute -top-5 -right-5 bg-red-600 p-2 rounded-full hover:bg-red-700 transition cursor-pointer"
            >
              <X className="text-white" />
            </button>
            <iframe
              width="100%"
              height="430"
              src={trailerEmbedUrl}
              allowFullScreen
              title="Trailer"
              className="rounded-xl"
            />
          </div>
        </div>
      )}

      {/* MAIN TOP SECTION */}
      <div className="flex flex-col md:flex-row gap-10 max-w-6xl mx-auto">
        <div className="relative max-md:mx-auto shrink-0">
          <div className="pointer-events-none absolute -inset-4 rounded-[28px] bg-primary/20 blur-2xl" />
          <img
            src={image_base_url + movie.poster_path}
            alt={movie.title}
            className="relative rounded-2xl h-104 max-w-70 object-cover ring-1 ring-white/15 shadow-[0_30px_70px_-25px_rgba(168,85,247,0.55)]"
          />
        </div>

        <div className="relative flex flex-col gap-3">
          <BlurCircle top="-100px" left="-100px" />
          <p className="text-primary uppercase text-xs tracking-[0.24em]">
            {movie.original_language?.toUpperCase() || "ENGLISH"}
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold max-w-2xl text-balance tracking-tight bg-gradient-to-r from-white via-white to-primary/70 bg-clip-text text-transparent">
            {movie.title}
          </h1>

          <div className="flex items-center gap-3 text-gray-300 text-sm">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-primary/25 backdrop-blur-sm">
              <StarIcon className="w-4 h-4 text-primary fill-primary" />
              <span className="font-medium text-white">{movie.vote_average.toFixed(1)}</span>
              <span className="text-gray-400">User Rating</span>
            </div>
            <span className="text-gray-500">•</span>
            <span>{releaseYear}</span>
          </div>

          <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-xl">
            {movie.overview}
          </p>

          {/* Info chips — certificate / runtime / language / genres */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 border border-primary/30 text-violet-200">
              {movie.adult ? "A · 18+" : "U/A · 13+"}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/12 text-gray-200">
              {timeFormat(movie.runtime)}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/12 text-gray-200">
              {(movie.original_language || "en").toUpperCase()}
            </span>
            {movie.genres?.slice(0, 3).map((genre) => (
              <span
                key={genre.id || genre.name}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/12 text-gray-200"
              >
                {genre.name}
              </span>
            ))}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/12 text-gray-200">
              {movie.release_date}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-4 mt-5">
            <button
              className="flex items-center gap-2 px-8 py-3 text-sm bg-gradient-to-b from-white/[0.12] to-white/[0.03] hover:from-primary/30 hover:to-primary/10 border border-white/15 hover:border-primary transition-all duration-300 rounded-xl font-medium cursor-pointer active:scale-95 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_-12px_rgba(168,85,247,0.8)]"
              onClick={handleWatchTrailer}
            >
              <PlayCircleIcon className="w-5 h-5 text-primary" />
              Watch Trailer
            </button>

            <button
              onClick={handleFavorite}
              className="p-3 rounded-full bg-white/5 border border-white/15 hover:border-primary/60 transition-all duration-300 cursor-pointer active:scale-95 hover:shadow-[0_0_25px_-6px_rgba(168,85,247,0.8)]"
            >
              <Heart
                className={`w-5 h-5 ${isFavorite ? "fill-primary text-primary" : ""
                  }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* CAST */}
      <p className="text-xl font-semibold mt-20 tracking-tight bg-gradient-to-r from-white to-primary/70 bg-clip-text text-transparent w-max">Cast</p>
      <HScroller className="mt-8" contentClassName="pb-4">
        <div className="flex items-center gap-6 w-max px-4">
          {movie.casts.slice(0, 12).map((cast, index) => (
            <div key={index} className="group flex flex-col items-center text-center">
              <div className="relative">
                <span className="pointer-events-none absolute -inset-1 rounded-full bg-primary/25 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                {cast.profile_path ? (
                  <img
                    src={image_base_url + cast.profile_path}
                    alt={cast.name}
                    className="relative rounded-full h-20 md:h-20 aspect-square object-cover ring-1 ring-white/15 group-hover:ring-primary/60 transition-all duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="relative rounded-full h-20 w-20 flex items-center justify-center bg-white/5 ring-1 ring-white/15 text-sm text-gray-400 group-hover:ring-primary/60 transition-all duration-300 group-hover:scale-105">{cast.name?.[0] || "?"}</div>
                )}
              </div>
              <p className="font-medium text-xs mt-3 text-gray-200">{cast.name}</p>
            </div>
          ))}
        </div>
      </HScroller>

      {/* DATE PICKER */}
      <DateSelect dateTime={show.dateTime} onDateChange={setSelectedDate} />

      {/* THEATER & TIME CARDS */}
      <section className="mt-12 max-w-6xl mx-auto">
        <div
          className="
            relative overflow-hidden
            rounded-3xl border border-primary/20
            bg-gradient-to-br from-[#15101c] via-[#0b0910] to-black
            p-6 md:p-9
            shadow-[0_25px_80px_-30px_rgba(168,85,247,0.45)]
          "
        >
          {/* Decorative ambient glows */}
          <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/20 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-[90px]" />

          {/* Header */}
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_25px_-6px_rgba(168,85,247,0.6)]">
                <Clapperboard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight bg-gradient-to-r from-white via-white to-primary/70 bg-clip-text text-transparent">
                  Showtimes
                </h2>
                <p className="text-[11px] md:text-xs uppercase tracking-[0.22em] text-gray-400 mt-1">
                  Theaters &amp; timings in {city}
                </p>
              </div>
            </div>
            {selectedDate && (
              <span className="inline-flex items-center gap-2 self-start md:self-auto text-xs px-4 py-2 rounded-full bg-white/5 border border-primary/25 text-gray-100 backdrop-blur-sm shadow-[0_0_20px_-10px_rgba(168,85,247,0.7)]">
                <Clock className="w-3.5 h-3.5 text-primary" />
                {new Date(selectedDate).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {!selectedDate ? (
            <p className="relative text-sm text-gray-400">
              Please select a date to view showtimes.
            </p>
          ) : groupedByTheater.length === 0 ? (
            <p className="relative text-sm text-gray-400">
              No shows in <span className="text-primary font-medium">{city}</span> for this date. Try another day or switch your city.
            </p>
          ) : (
            <div className="relative space-y-6">
              {/* Language filter */}
              {availableLanguages.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-gray-400 mr-1">Language</span>
                  {["All", ...availableLanguages].map((l) => (
                    <button
                      key={l}
                      onClick={() => setSelectedLang(l)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                        selectedLang === l
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-white/5 text-gray-300 border-white/10 hover:border-primary/30"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
              {/* Availability legend */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 pb-1">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Available</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Filling fast</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Almost full</span>
              </div>
              {groupedByTheater.map((theater) => (
                <div
                  key={theater.theaterName}
                  className="
                    group relative overflow-hidden
                    rounded-2xl border border-white/10
                    bg-gradient-to-br from-white/[0.07] to-white/[0.02]
                    p-5 md:p-6
                    backdrop-blur-sm
                    transition-all duration-300
                    hover:border-primary/40
                    hover:shadow-[0_20px_60px_-30px_rgba(168,85,247,0.6)]
                  "
                >
                  {/* Accent bar */}
                  <span className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full bg-gradient-to-b from-primary to-primary-dull opacity-70 group-hover:opacity-100 transition-opacity" />

                  {/* Theater header card */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 pl-3">
                    <div>
                      <p className="text-base md:text-lg font-semibold text-white tracking-tight">
                        {theater.theaterName}
                      </p>
                      <p className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1">
                        <MapPin className="w-3 h-3 text-primary/70" />
                        {theater.city && theater.address
                          ? `${theater.address}, ${theater.city}`
                          : theater.city || theater.address || "Nearby cinema"}
                      </p>
                      {/* Amenities */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {["M-Ticket", "F&B", "Parking", "Wheelchair", "Dolby 7.1"].map((a) => (
                          <span
                            key={a}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 border border-white/10 text-gray-300"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                      {/* Live detail: how many shows + which formats this theatre offers today */}
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                          <Clock className="w-3 h-3 text-primary/70" />
                          {theater.slots.length} show{theater.slots.length === 1 ? "" : "s"} today
                        </span>
                        {[...new Set(theater.slots.map((s) => formatScreen(s.experience, s.format)))]
                          .slice(0, 4)
                          .map((f) => (
                            <span key={f} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 border border-primary/25 text-violet-200">
                              {f}
                            </span>
                          ))}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 self-start whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-violet-200">
                      <ShieldCheck className="w-3 h-3" />
                      Cancellation available
                    </span>
                  </div>

                  {/* Time slots card — grouped by part of day */}
                  <div
                    className="
                      rounded-xl border border-white/10
                      bg-black/30 px-3 py-4 md:px-4 md:py-5 ml-3
                    "
                  >
                    {PARTS_OF_DAY.map((part) => {
                      const partSlots = theater.slots.filter(
                        (s) => partOfDay(s.time) === part
                      );
                      if (!partSlots.length) return null;

                      return (
                        <div key={part} className="mb-4 last:mb-0">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2.5">
                            {part}
                          </p>
                          <div className="flex flex-wrap justify-center md:justify-start gap-2.5 md:gap-3">
                            {partSlots.map((slot) => {
                              const dateObj = new Date(slot.time);
                              const timeLabel = isNaN(dateObj.getTime())
                                ? slot.time
                                : dateObj.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  });
                              const avail = availabilityFromRatio(seatPressure(slot.id));

                              return (
                                <button
                                  key={slot.id}
                                  onClick={() => handleTimeClick(slot)}
                                  title={`${formatScreen(slot.experience, slot.format)} • ${slot.language} • ${avail.label}`}
                                  className="
                                    group/slot relative flex flex-col items-center justify-center
                                    min-w-[5.2rem] px-3 py-2
                                    rounded-xl border
                                    bg-gradient-to-b from-white/[0.08] to-white/[0.02]
                                    border-white/15
                                    text-gray-100
                                    transition-all duration-300
                                    hover:-translate-y-0.5
                                    hover:border-primary
                                    hover:shadow-[0_10px_30px_-12px_rgba(168,85,247,0.85)]
                                    hover:from-primary/25 hover:to-primary/5
                                    cursor-pointer
                                  "
                                >
                                  <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                                    <span className={`h-1.5 w-1.5 rounded-full ${avail.dot}`} />
                                    {timeLabel}
                                  </span>
                                  <span className="text-[10px] font-medium text-primary mt-0.5">
                                    {formatScreen(slot.experience, slot.format)}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    {slot.language}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RATINGS & REVIEWS */}
      <MovieReviews movie={movie} />

      {/* YOU MAY ALSO LIKE */}
      <p className="text-xl font-semibold mt-20 mb-8 tracking-tight bg-gradient-to-r from-white to-primary/70 bg-clip-text text-transparent w-max">You May Also Like</p>
      <div className="flex flex-wrap max-sm:justify-center gap-8 mb-15">
        {shows.slice(0, 4).map((m, index) => (
          <MovieCard key={index} movie={m} />
        ))}
      </div>
    </div>
  );
};

export default MovieDetails;
