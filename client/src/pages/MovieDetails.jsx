import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Heart, PlayCircleIcon, StarIcon, X } from "lucide-react";
import BlurCircle from "../components/BlurCircle";
import timeFormat from "../lib/timeFormat";
import DateSelect from "../components/DateSelect";
import MovieCard from "../components/MovieCard";
import MovieDetailSkeleton from "../components/MovieDetailSkeleton";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";

const MovieDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [show, setShow] = useState(null);            // holds `{ success, movie, dateTime }` from backend
  const [tmdbMovie, setTmdbMovie] = useState(null);  // enriched TMDB movie (for trailer, etc.)
  const [showTrailer, setShowTrailer] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [daySlots, setDaySlots] = useState([]);      // normalized slots for a single day

  const {
    shows,
    axios,
    getToken,
    user,
    fetchFavoriteMovies,
    favoriteMovies,
    image_base_url,
  } = useAppContext();

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
      console.log("Now-playing TMDB details error ➜", error.message);
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
      console.log(error);
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
    const normalized = rawSlots.map((slot, idx) => ({
      id: slot.showId || slot._id || `${selectedDate}-${idx}`,
      time: slot.time,
      theaterId: slot.theaterId || null,
      theaterName: slot.theaterName || "Unknown Theater",
      theaterCity: slot.theaterCity || "",
      theaterAddress: slot.theaterAddress || "",
      format: slot.format || slot.type || "2D",
      experience: slot.experience || slot.screenType || "Standard",
      language: slot.language || "English",
    }));

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
  }, [daySlots]);

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
   * Helper: chunk an array into fixed-size groups
   * ----------------------------------------------------------------------- */

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  };

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
      <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">
        <img
          src={image_base_url + movie.poster_path}
          alt={movie.title}
          className="max-md:mx-auto rounded-xl h-104 max-w-70 object-cover"
        />

        <div className="relative flex flex-col gap-3">
          <BlurCircle top="-100px" left="-100px" />
          <p className="text-primary uppercase text-xs tracking-[0.24em]">
            {movie.original_language?.toUpperCase() || "ENGLISH"}
          </p>
          <h1 className="text-4xl font-semibold max-w-96 text-balance">
            {movie.title}
          </h1>

          <div className="flex items-center gap-3 text-gray-300 text-sm">
            <div className="flex items-center gap-1">
              <StarIcon className="w-5 h-5 text-primary fill-primary" />
              {movie.vote_average.toFixed(1)} User Rating
            </div>
            <span className="text-gray-500">•</span>
            <span>{releaseYear}</span>
          </div>

          <p className="text-gray-400 mt-2 text-sm leading-tight max-w-xl">
            {movie.overview}
          </p>

          <p className="text-sm text-gray-300">
            {timeFormat(movie.runtime)} •{" "}
            {movie.genres.map((genre) => genre.name).join(", ")} •{" "}
            {movie.release_date}
          </p>

          <div className="flex items-center flex-wrap gap-4 mt-4">
            <button
              className="flex items-center gap-2 px-7 py-3 text-sm bg-gray-800 hover:bg-gray-900 transition rounded-md font-medium cursor-pointer active:scale-95"
              onClick={handleWatchTrailer}
            >
              <PlayCircleIcon className="w-5 h-5" />
              Watch Trailer
            </button>

            <button
              onClick={handleFavorite}
              className="bg-gray-700 p-2.5 rounded-full transition cursor-pointer active:scale-95"
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
      <p className="text-lg font-medium mt-20">Cast</p>
      <div className="overflow-x-auto no-scrollbar mt-8 pb-4">
        <div className="flex items-center gap-4 w-max px-4">
          {movie.casts.slice(0, 12).map((cast, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <img
                src={image_base_url + cast.profile_path}
                alt={cast.name}
                className="rounded-full h-20 md:h-20 aspect-square object-cover"
              />
              <p className="font-medium text-xs mt-3">{cast.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DATE PICKER */}
      <DateSelect dateTime={show.dateTime} onDateChange={setSelectedDate} />

      {/* THEATER & TIME CARDS */}
      <section className="mt-10">
        <div
          className="
            rounded-2xl border border-white/10 
            bg-gradient-to-br from-black/70 via-black/60 to-black/80
            p-6 md:p-7
            shadow-[0_0_45px_-15px_rgba(0,0,0,0.9)]
          "
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <p className="text-base md:text-lg font-semibold text-white">
                Showtimes
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Select a date above to see all theaters & timings.
              </p>
            </div>
            {selectedDate && (
              <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/15 text-gray-200">
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
            <p className="text-sm text-gray-400">
              Please select a date to view showtimes.
            </p>
          ) : groupedByTheater.length === 0 ? (
            <p className="text-sm text-gray-400">
              No shows available for this date. Try another day.
            </p>
          ) : (
            <div className="space-y-6">
              {groupedByTheater.map((theater) => (
                <div
                  key={theater.theaterName}
                  className="
                    rounded-xl border border-white/12 
                    bg-black/55 p-4 md:p-5
                  "
                >
                  {/* Theater header card */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                      <p className="text-sm md:text-base font-semibold text-white">
                        {theater.theaterName}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {theater.city && theater.address
                          ? `${theater.address}, ${theater.city}`
                          : theater.city || theater.address || "Nearby cinema"}
                      </p>
                    </div>
                  </div>

                  {/* Time slots card */}
                  <div
                    className="
                      rounded-lg border border-white/10 
                      bg-white/5 px-3 py-3 md:px-4 md:py-4
                    "
                  >
                    {chunk(theater.slots, 5).map((row, rowIdx) => (
                      <div
                        key={rowIdx}
                        className="
                          flex flex-wrap justify-center md:justify-start
                          gap-2 md:gap-3 mb-2 last:mb-0
                        "
                      >
                        {row.map((slot) => {
                          const dateObj = new Date(slot.time);
                          const timeLabel = isNaN(dateObj.getTime())
                            ? slot.time
                            : dateObj.toTimeString().slice(0, 5);

                          return (
                            <button
                              key={slot.id}
                              onClick={() => handleTimeClick(slot)}
                              className="
                                flex flex-col items-center justify-center
                                min-w-[4.3rem] px-2 py-1.5
                                rounded-md border text-[11px]
                                bg-black/40 hover:bg-black/70 
                                border-white/20 hover:border-primary
                                text-gray-100
                                transition cursor-pointer
                              "
                            >
                              <span className="text-xs font-semibold">
                                {timeLabel}
                              </span>
                              <span className="text-[10px] text-primary mt-0.5">
                                {slot.experience || "Laser"}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {slot.format || "2D"}
                              </span>
                              {/* Price intentionally NOT shown here; handled on seat booking page */}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* YOU MAY ALSO LIKE */}
      <p className="text-lg font-medium mt-20 mb-8">You May Also Like</p>
      <div className="flex flex-wrap max-sm:justify-center gap-8 mb-15">
        {shows.slice(0, 4).map((m, index) => (
          <MovieCard key={index} movie={m} />
        ))}
      </div>
    </div>
  );
};

export default MovieDetails;
