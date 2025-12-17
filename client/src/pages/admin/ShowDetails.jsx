import React, {
    useEffect,
    useState,
    useCallback,
    useRef
} from "react";
import Title from "../../components/admin/Title";
import { useAppContext } from "../../context/AppContext";
import { kConverter } from "../../lib/kConverter";
import { StarIcon, X, EyeOff, Eye, Plus } from "lucide-react";
import toast from "react-hot-toast";

// Experience + Format mapping (frontend side)
const EXPERIENCE_OPTIONS = [
    { experience: "Laser", format: "2D" },
    { experience: "IMAX", format: "IMAX 2D" },
    { experience: "Dolby Atmos", format: "3D" },
    { experience: "Insignia", format: "4DX-3D" },
    { experience: "4DX", format: "4DX-3D" },
];

// Drawer sizing config
const DEFAULT_DRAWER_WIDTH = 580;
const MIN_DRAWER_WIDTH = 360;
const MAX_DRAWER_WIDTH = 820;

// Small helper to format time label from ISO
const formatTimeLabel = (timeStr) => {
    const d = new Date(timeStr);
    if (Number.isNaN(d.getTime())) return timeStr;
    return d.toTimeString().slice(0, 5);
};

// Slot status helper: past / soon / upcoming
const getSlotStatus = (timeStr) => {
    const d = new Date(timeStr);
    if (Number.isNaN(d.getTime())) return "unknown";

    const now = new Date();
    const diffMs = d.getTime() - now.getTime();

    if (diffMs < 0) return "past"; // showtime already passed
    if (diffMs <= 30 * 60 * 1000) return "soon"; // within 30 minutes
    return "upcoming";
};

// Difference in minutes (rounded)
const getMinutesDiffFromNow = (timeStr) => {
    const d = new Date(timeStr);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const mins = Math.round(diffMs / 60000);
    return mins;
};

const ShowDetails = () => {
    const { axios, getToken, image_base_url } = useAppContext();

    const [movies, setMovies] = useState([]);
    const [loadingMovies, setLoadingMovies] = useState(true);

    const [selectedMovie, setSelectedMovie] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const [schedule, setSchedule] = useState([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);

    const [movieVisibilityLoading, setMovieVisibilityLoading] = useState(false);
    const [dayVisibilityLoading, setDayVisibilityLoading] = useState(false);
    const [theaterVisibilityLoading, setTheaterVisibilityLoading] =
        useState(false);

    // Per-format pricing
    const [formatPrices, setFormatPrices] = useState([]);
    const [savingFormatPrices, setSavingFormatPrices] = useState(false);

    // Add-show modal state
    const [isAddShowOpen, setIsAddShowOpen] = useState(false);
    const [creatingShows, setCreatingShows] = useState(false);
    const [addShowForm, setAddShowForm] = useState({
        date: "",
        theaterId: "",
        timeInput: "",
        times: [],
        experience: "Laser",
        price: "",
    });

    // Drawer width + resize state
    const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
    const [isResizingDrawer, setIsResizingDrawer] = useState(false);
    const dragStartXRef = useRef(0);
    const dragStartWidthRef = useRef(DEFAULT_DRAWER_WIDTH);

    const currency = import.meta.env.VITE_CURRENCY;

    /* --------------------------------------------------------------------------- */

    const formatDateLabel = (isoDate) => {
        const d = new Date(isoDate);
        if (Number.isNaN(d.getTime())) return isoDate;
        return d.toLocaleDateString(undefined, {
            weekday: "short",
            day: "2-digit",
            month: "short",
        });
    };

    /* ---------------------------------------------------------------------------
     * Drawer resize handlers
     * ------------------------------------------------------------------------ */

    const handleResizeMouseDown = (e) => {
        e.preventDefault();
        setIsResizingDrawer(true);
        dragStartXRef.current = e.clientX;
        dragStartWidthRef.current = drawerWidth;
    };

    useEffect(() => {
        if (!isResizingDrawer) return;

        const handleMouseMove = (e) => {
            // Dragging LEFT should increase width, so we subtract current X from start X
            const delta = dragStartXRef.current - e.clientX;
            let nextWidth = dragStartWidthRef.current + delta;

            if (nextWidth < MIN_DRAWER_WIDTH) nextWidth = MIN_DRAWER_WIDTH;
            if (nextWidth > MAX_DRAWER_WIDTH) nextWidth = MAX_DRAWER_WIDTH;

            setDrawerWidth(nextWidth);
        };

        const handleMouseUp = () => {
            setIsResizingDrawer(false);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizingDrawer]);

    /* ---------------------------------------------------------------------------
     * Fetch movie list (admin "Now in Theaters")
     * ------------------------------------------------------------------------ */

    const fetchMovies = useCallback(
        async () => {
            try {
                setLoadingMovies(true);

                const token = await getToken();

                const { data } = await axios.post(
                    "/api/show/admin/sync-now-playing",
                    {},
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (data.success && Array.isArray(data.movies)) {
                    setMovies(data.movies);
                } else {
                    setMovies([]);
                }
            } catch (err) {
                console.error("Fetch movies error:", err);
                toast.error(
                    err?.response?.data?.message || "Failed to load movies for admin."
                );
                setMovies([]);
            } finally {
                setLoadingMovies(false);
            }
        },
        [axios, getToken]
    );

    /* ---------------------------------------------------------------------------
     * Fetch schedule for selected movie (ADMIN view)
     * ------------------------------------------------------------------------ */

    const fetchSchedule = useCallback(
        async (movie) => {
            if (!movie) return;

            try {
                setLoadingSchedule(true);

                const token = await getToken();

                const { data } = await axios.get(
                    `/api/show/admin/${movie._id}/schedule`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!data.success) {
                    toast.error(data.message || "Failed to load schedule.");
                    setSchedule([]);
                    return;
                }

                const dateTime = data.dateTime || {};
                const dates = Object.keys(dateTime).sort();

                const scheduleFromDateTime = dates.map((date) => {
                    const slotsRaw = dateTime[date] || [];

                    const slots = slotsRaw.map((slot, idx) => ({
                        _id: slot.showId || slot._id || `${date}-${idx}`,
                        time: slot.time,
                        showPrice: slot.showPrice || 0,
                        hidden: !!slot.hidden,

                        theaterId: slot.theaterId,
                        theaterName: slot.theaterName,
                        theaterCity: slot.theaterCity,
                        theaterAddress: slot.theaterAddress,

                        format: slot.format,
                        experience: slot.experience,
                    }));

                    // Sort by show time ascending
                    slots.sort(
                        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
                    );

                    return { date, slots };
                });

                setSchedule(scheduleFromDateTime);
                setSelectedDayIndex(0);
            } catch (err) {
                console.error("Fetch schedule error:", err);
                toast.error(
                    err?.response?.data?.message ||
                    "Failed to load schedule from server."
                );
                setSchedule([]);
            } finally {
                setLoadingSchedule(false);
            }
        },
        [axios, getToken]
    );

    /* ---------------------------------------------------------------------------
     * Fetch per-format pricing for selected movie
     * ------------------------------------------------------------------------ */

    const fetchFormatPrices = useCallback(
        async (movie) => {
            if (!movie) return;

            try {
                const token = await getToken();
                const { data } = await axios.get(
                    `/api/show/admin/${movie._id}/format-prices`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!data.success) {
                    toast.error(
                        data.message || "Failed to load format-based pricing details."
                    );
                    setFormatPrices([]);
                    return;
                }

                setFormatPrices(data.formats || []);
            } catch (err) {
                console.error("Fetch format prices error:", err);
                toast.error(
                    err?.response?.data?.message ||
                    "Failed to load format-based pricing details."
                );
                setFormatPrices([]);
            }
        },
        [axios, getToken]
    );

    const handleFormatPriceChange = (format, value) => {
        setFormatPrices((prev) =>
            prev.map((fp) =>
                fp.format === format
                    ? {
                        ...fp,
                        price: value === "" ? "" : Number(value),
                    }
                    : fp
            )
        );
    };

    const saveFormatPrices = async () => {
        if (!selectedMovie) return;

        try {
            setSavingFormatPrices(true);
            const token = await getToken();

            const pricesPayload = {};
            formatPrices.forEach((fp) => {
                const num = Number(fp.price);
                if (Number.isFinite(num) && num > 0) {
                    pricesPayload[fp.format] = num;
                }
            });

            if (!Object.keys(pricesPayload).length) {
                toast.error("Please enter at least one valid format price.");
                return;
            }

            const { data } = await axios.patch(
                `/api/show/admin/${selectedMovie._id}/format-prices`,
                {
                    priceByFormat: pricesPayload,
                    prices: pricesPayload,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!data.success) {
                return toast.error(
                    data.message || "Failed to update format-based pricing."
                );
            }

            toast.success("Format prices updated for all future shows.");

            const updatedMap = data.priceByFormat || pricesPayload;

            setFormatPrices((prev) =>
                prev.map((fp) => ({
                    ...fp,
                    price:
                        typeof updatedMap[fp.format] === "number"
                            ? updatedMap[fp.format]
                            : fp.price,
                }))
            );

            await fetchSchedule(selectedMovie);
        } catch (err) {
            console.error("saveFormatPrices error:", err);
            toast.error("Error updating format-based pricing.");
        } finally {
            setSavingFormatPrices(false);
        }
    };

    /* ---------------------------------------------------------------------------
     * Movie selection / drawer
     * ------------------------------------------------------------------------ */

    const handleSelectMovie = (movie) => {
        setSelectedMovie(movie);
        setIsDrawerOpen(true);
        setSchedule([]);
        setSelectedDayIndex(0);

        // Reset drawer width to default each open
        setDrawerWidth(DEFAULT_DRAWER_WIDTH);

        fetchSchedule(movie);
        fetchFormatPrices(movie);
    };

    const closeDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedMovie(null);
        setSchedule([]);
        setSelectedDayIndex(0);
        setFormatPrices([]);
        setIsAddShowOpen(false);
    };

    /* ---------------------------------------------------------------------------
     * Movie-level hide / unhide
     * ------------------------------------------------------------------------ */

    const toggleMovieHidden = async () => {
        if (!selectedMovie) return;

        try {
            setMovieVisibilityLoading(true);

            const nextHidden = !selectedMovie.hiddenFromHome;
            const token = await getToken();

            const { data } = await axios.patch(
                `/api/show/admin/home-visibility/${selectedMovie._id}`,
                { hidden: nextHidden },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!data.success) {
                return toast.error(
                    data.message || "Failed to update movie visibility."
                );
            }

            setSelectedMovie((prev) =>
                prev ? { ...prev, hiddenFromHome: nextHidden } : prev
            );

            await fetchMovies();

            toast.success(
                nextHidden
                    ? "Movie hidden from Now in Theaters."
                    : "Movie visible on Now in Theaters."
            );
        } catch (err) {
            console.error("Toggle movie visibility error:", err);
            toast.error("Error updating movie visibility.");
        } finally {
            setMovieVisibilityLoading(false);
        }
    };

    /* ---------------------------------------------------------------------------
     * Day / theater / slot visibility
     * ------------------------------------------------------------------------ */

    const selectedDay = schedule[selectedDayIndex] || null;

    const toggleDayHidden = async () => {
        if (!selectedMovie || !selectedDay) return;
        if (!selectedDay.slots.length) return;

        try {
            setDayVisibilityLoading(true);

            const allHidden = selectedDay.slots.every((s) => s.hidden);
            const nextHidden = !allHidden;
            const token = await getToken();

            const { data } = await axios.patch(
                `/api/show/admin/${selectedMovie._id}/hide-date`,
                { date: selectedDay.date, hidden: nextHidden },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!data.success) {
                return toast.error(
                    data.message || "Failed to update day visibility."
                );
            }

            setSchedule((prev) =>
                prev.map((day) =>
                    day.date === selectedDay.date
                        ? {
                            ...day,
                            slots: day.slots.map((s) => ({
                                ...s,
                                hidden: nextHidden,
                            })),
                        }
                        : day
                )
            );

            toast.success(
                nextHidden
                    ? "All shows for this day are now hidden."
                    : "All shows for this day are now visible."
            );
        } catch (err) {
            console.error("Toggle day visibility error:", err);
            toast.error("Error updating day visibility.");
        } finally {
            setDayVisibilityLoading(false);
        }
    };

    const toggleTheaterHidden = async (theaterId, makeHidden) => {
        if (!selectedMovie || !selectedDay || !theaterId) return;

        try {
            setTheaterVisibilityLoading(true);

            const token = await getToken();

            const { data } = await axios.patch(
                `/api/show/admin/${selectedMovie._id}/hide-by-theater`,
                {
                    theaterId,
                    hidden: makeHidden,
                    date: selectedDay.date,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!data.success) {
                return toast.error(
                    data.message || "Failed to update theater visibility."
                );
            }

            setSchedule((prev) =>
                prev.map((day) =>
                    day.date !== selectedDay.date
                        ? day
                        : {
                            ...day,
                            slots: day.slots.map((slot) =>
                                slot.theaterId === theaterId
                                    ? { ...slot, hidden: makeHidden }
                                    : slot
                            ),
                        }
                )
            );

            toast.success(
                makeHidden
                    ? "All shows for this theater are now hidden for this day."
                    : "All shows for this theater are now visible for this day."
            );
        } catch (err) {
            console.error("Toggle theater visibility error:", err);
            toast.error("Error updating theater visibility.");
        } finally {
            setTheaterVisibilityLoading(false);
        }
    };

    const toggleSlotVisibility = async (showId, currentHidden) => {
        try {
            const token = await getToken();

            const { data } = await axios.patch(
                `/api/show/admin/show/${showId}/hide`,
                { hidden: !currentHidden },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!data.success) {
                return toast.error(data.message || "Failed to update visibility.");
            }

            setSchedule((prev) =>
                prev.map((day) => ({
                    ...day,
                    slots: day.slots.map((slot) =>
                        slot._id === showId ? { ...slot, hidden: !currentHidden } : slot
                    ),
                }))
            );
        } catch (err) {
            console.error("Toggle visibility error:", err);
            toast.error("Error updating visibility.");
        }
    };

    /* ---------------------------------------------------------------------------
     * Derived: per-day theater grouping
     * ------------------------------------------------------------------------ */

    const groupedTheatersForDay = React.useMemo(() => {
        if (!selectedDay || !selectedDay.slots.length) return [];

        const map = new Map();

        selectedDay.slots.forEach((slot) => {
            if (!slot.theaterId || !slot.theaterName) return;

            const key = String(slot.theaterId);

            if (!map.has(key)) {
                map.set(key, {
                    theaterId: slot.theaterId,
                    theaterName: slot.theaterName,
                    theaterCity: slot.theaterCity || "",
                    theaterAddress: slot.theaterAddress || "",
                    slots: [],
                });
            }

            map.get(key).slots.push(slot);
        });

        const theaters = Array.from(map.values());

        // Sort theaters alphabetically
        theaters.sort((a, b) =>
            (a.theaterName || "").localeCompare(b.theaterName || "")
        );

        // Sort slots by time
        theaters.forEach((t) => {
            t.slots.sort(
                (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
            );
        });

        return theaters;
    }, [selectedDay]);

    /* ---------------------------------------------------------------------------
     * Add-show modal helpers
     * ------------------------------------------------------------------------ */

    const openAddShowModal = () => {
        const defaultDate = selectedDay?.date || "";
        const defaultTheaterId = groupedTheatersForDay[0]?.theaterId || "";

        setAddShowForm({
            date: defaultDate,
            theaterId: defaultTheaterId,
            timeInput: "",
            times: [],
            experience: EXPERIENCE_OPTIONS[0].experience,
            price: "",
        });
        setIsAddShowOpen(true);
    };

    const closeAddShowModal = () => {
        if (creatingShows) return;
        setIsAddShowOpen(false);
    };

    const handleAddTimeToList = () => {
        const t = addShowForm.timeInput.trim();
        if (!t) return;
        if (!/^\d{2}:\d{2}$/.test(t)) {
            toast.error("Time must be in HH:MM (24h) format, e.g. 14:30");
            return;
        }
        if (addShowForm.times.includes(t)) {
            toast.error("Time already added.");
            return;
        }
        setAddShowForm((prev) => ({
            ...prev,
            times: [...prev.times, t],
            timeInput: "",
        }));
    };

    const removeTimeFromList = (time) => {
        setAddShowForm((prev) => ({
            ...prev,
            times: prev.times.filter((t) => t !== time),
        }));
    };

    const handleCreateShows = async () => {
        if (!selectedMovie) return;

        const { date, theaterId, times, experience, price } = addShowForm;

        if (!date) {
            toast.error("Please select a date.");
            return;
        }
        if (!theaterId) {
            toast.error("Please select a theater.");
            return;
        }
        if (!times.length) {
            toast.error("Please add at least one time.");
            return;
        }

        const priceNum = Number(price);
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
            toast.error("Please enter a valid positive price.");
            return;
        }

        const pair =
            EXPERIENCE_OPTIONS.find((p) => p.experience === experience) ||
            EXPERIENCE_OPTIONS[0];
        const format = pair.format;

        try {
            setCreatingShows(true);
            const token = await getToken();

            // Create one show per time
            for (const time of times) {
                await axios.post(
                    `/api/show/admin/${selectedMovie._id}/add-theater-slot`,
                    {
                        theaterId,
                        date,
                        time,
                        showPrice: priceNum,
                        format,
                        experience,
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            toast.success(`Added ${times.length} show(s) successfully.`);
            setIsAddShowOpen(false);

            // Refresh schedule
            await fetchSchedule(selectedMovie);
        } catch (err) {
            console.error("handleCreateShows error:", err);
            toast.error(
                err?.response?.data?.message || "Failed to add new show(s)."
            );
        } finally {
            setCreatingShows(false);
        }
    };

    /* --------------------------------------------------------------------------- */

    useEffect(() => {
        fetchMovies();
    }, [fetchMovies]);

    const isMovieHidden = selectedMovie?.hiddenFromHome === true;
    const isDayAllHidden =
        selectedDay &&
        selectedDay.slots.length > 0 &&
        selectedDay.slots.every((s) => s.hidden);

    const currentExperiencePair =
        EXPERIENCE_OPTIONS.find(
            (p) => p.experience === addShowForm.experience
        ) || EXPERIENCE_OPTIONS[0];

    /* ---------------------------------------------------------------------------
     * Render
     * ------------------------------------------------------------------------ */

    return (
        <>
            <Title text1="Show" text2="Details" />

            {/* Movie grid header */}
            <p className="mt-10 text-lg font-medium">Now in Theaters</p>

            {loadingMovies ? (
                <p className="mt-4 text-gray-400 text-sm">Loading movies...</p>
            ) : movies.length === 0 ? (
                <p className="mt-4 text-gray-400 text-sm">
                    No movies found for the current &quot;Now in Theaters&quot; window.
                </p>
            ) : (
                <div className="mt-4">
                    <div
                        className="
              grid gap-4 
              grid-cols-2 
              sm:grid-cols-3 
              lg:grid-cols-4 
              2xl:grid-cols-5
            "
                    >
                        {movies.map((movie) => {
                            const isActive = selectedMovie?._id === movie._id;

                            return (
                                <div
                                    key={movie._id}
                                    onClick={() => handleSelectMovie(movie)}
                                    className={`
                    relative cursor-pointer transition-all duration-300
                    rounded-xl overflow-hidden
                    bg-black/60 border border-white/10
                    hover:border-primary/70 hover:shadow-lg hover:shadow-primary/20
                    ${isActive ? "scale-105 ring-2 ring-primary/80" : ""}
                  `}
                                >
                                    <div className="relative">
                                        <img
                                            src={image_base_url + movie.poster_path}
                                            alt={movie.title}
                                            className="w-full h-56 object-cover brightness-90"
                                        />
                                        <div
                                            className="
                        text-xs flex items-center justify-between 
                        p-2 bg-black/80 w-full absolute bottom-0 left-0
                      "
                                        >
                                            <p className="flex items-center gap-1 text-gray-300">
                                                <StarIcon className="w-4 h-4 text-primary fill-primary" />
                                                {movie.vote_average?.toFixed
                                                    ? movie.vote_average.toFixed(1)
                                                    : movie.vote_average}
                                            </p>
                                            <p className="text-gray-300">
                                                {kConverter(movie.vote_count || 0)} Votes
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <p className="font-medium text-sm truncate">
                                            {movie.title}
                                        </p>
                                        <p className="text-gray-400 text-[11px]">
                                            {movie.release_date}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Right drawer (resizable, stuck to right edge) */}
            <div
                className="fixed inset-0 z-50 flex justify-end"
                style={{ pointerEvents: isDrawerOpen ? "auto" : "none" }}
            >
                {/* Backdrop */}
                {isDrawerOpen && (
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={closeDrawer}
                    />
                )}

                {/* Drawer panel */}
                <div
                    className={`
            relative h-full bg-black/80 backdrop-blur-xl border-l border-white/10 shadow-2xl 
            flex flex-col
            transform transition-transform duration-300 ease-out
            ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}
          `}
                    style={{
                        width: `${drawerWidth}px`,
                        minWidth: `${MIN_DRAWER_WIDTH}px`,
                        maxWidth: `${MAX_DRAWER_WIDTH}px`,
                    }}
                >
                    {/* Resize handle (left edge) */}
                    <div
                        onMouseDown={handleResizeMouseDown}
                        className="
              absolute top-0 left-0 h-full w-1 
              cursor-ew-resize z-20
              bg-transparent hover:bg-white/10
            "
                        title="Drag to resize"
                    />

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            {selectedMovie && (
                                <img
                                    src={image_base_url + selectedMovie.poster_path}
                                    alt={selectedMovie.title}
                                    className="w-10 h-14 object-cover rounded-md"
                                />
                            )}
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-[0.24em]">
                                    Manage Shows
                                </p>
                                <h2 className="text-base font-semibold">
                                    {selectedMovie?.title || "No movie selected"}
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={closeDrawer}
                            className="p-1 rounded-full hover:bg-white/10 cursor-pointer transition"
                        >
                            <X className="w-5 h-5 text-gray-300" />
                        </button>
                    </div>

                    {/* Body */}
                    {selectedMovie ? (
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                            {/* Release info + movie visibility button */}
                            <div className="flex flex-col gap-3 text-xs text-gray-400">
                                <div className="space-y-1">
                                    <p>
                                        Release date:{" "}
                                        <span className="text-gray-200">
                                            {selectedMovie.release_date}
                                        </span>
                                    </p>
                                    <p className="text-[11px] text-gray-500">
                                        Shows are auto-generated around the release window and
                                        presented in a rolling 7-day view for both admin and users.
                                    </p>
                                </div>

                                <div>
                                    <button
                                        onClick={toggleMovieHidden}
                                        disabled={movieVisibilityLoading}
                                        className={`
                      inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px]
                      cursor-pointer border
                      ${isMovieHidden
                                                ? "border-emerald-400 text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50"
                                                : "border-red-400 text-red-300 bg-red-900/30 hover:bg-red-900/50"
                                            }
                    `}
                                    >
                                        {movieVisibilityLoading
                                            ? "Updating..."
                                            : isMovieHidden
                                                ? "Unhide movie from Now in Theaters"
                                                : "Hide movie from Now in Theaters"}
                                    </button>
                                </div>

                                {isMovieHidden && (
                                    <p className="text-[11px] text-orange-400 mt-1">
                                        This movie is currently hidden from &quot;Now in
                                        Theaters&quot;. Unhide it to view and manage its show
                                        schedule.
                                    </p>
                                )}
                            </div>

                            {/* Only show rest of controls when movie is visible */}
                            {!isMovieHidden && (
                                <>
                                    {/* Format pricing */}
                                    <section className="space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-white">
                                                    Format pricing
                                                </p>
                                                <p className="text-[11px] text-gray-500 mt-1 max-w-md">
                                                    Configure ticket prices per format. Updates apply to
                                                    all future shows for this movie across all theaters.
                                                </p>
                                            </div>
                                            <button
                                                onClick={saveFormatPrices}
                                                disabled={savingFormatPrices || !formatPrices.length}
                                                className={`
                          text-[11px] px-3 py-1.5 rounded-md cursor-pointer border
                          ${savingFormatPrices || !formatPrices.length
                                                        ? "border-white/20 text-gray-400 cursor-not-allowed"
                                                        : "border-primary text-primary hover:bg-primary/10"
                                                    }
                        `}
                                            >
                                                {savingFormatPrices ? "Saving..." : "Save prices"}
                                            </button>
                                        </div>

                                        {formatPrices.length === 0 ? (
                                            <p className="text-[11px] text-gray-500">
                                                No format pricing available for this movie yet.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                {formatPrices.map((fp) => (
                                                    <div
                                                        key={fp.format}
                                                        className="
                              rounded-lg border border-white/12 bg-black/50 
                              px-3 py-2.5 flex flex-col gap-1
                            "
                                                    >
                                                        <p className="text-xs font-semibold text-gray-100">
                                                            {fp.format}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500">
                                                            Base price ({currency})
                                                        </p>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="
                                mt-1 w-full rounded-md bg-black/60 border border-white/15 
                                text-xs text-gray-100 px-2 py-1 outline-none
                                focus:border-primary
                              "
                                                            value={fp.price === "" ? "" : fp.price}
                                                            onChange={(e) =>
                                                                handleFormatPriceChange(
                                                                    fp.format,
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    {/* Date tabs */}
                                    <div>
                                        <p className="text-sm font-semibold mb-2">
                                            Show days (7-day window)
                                        </p>
                                        {loadingSchedule ? (
                                            <p className="text-xs text-gray-400">
                                                Loading schedule...
                                            </p>
                                        ) : schedule.length === 0 ? (
                                            <p className="text-xs text-gray-400">
                                                No upcoming shows found for this movie.
                                            </p>
                                        ) : (
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                                {schedule.map((day, idx) => {
                                                    const isActive = idx === selectedDayIndex;
                                                    const allHidden =
                                                        day.slots.length > 0 &&
                                                        day.slots.every((s) => s.hidden);

                                                    return (
                                                        <button
                                                            key={day.date}
                                                            onClick={() => setSelectedDayIndex(idx)}
                                                            className={`
                                px-3 py-1.5 rounded-full text-xs whitespace-nowrap cursor-pointer
                                border transition relative
                                ${isActive
                                                                    ? "bg-primary text-white border-primary"
                                                                    : "bg-white/5 text-gray-300 border-white/15 hover:bg-white/10"
                                                                }
                              `}
                                                        >
                                                            {formatDateLabel(day.date)}
                                                            {allHidden && (
                                                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-400" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Theaters + slots + Add Show + day hide button */}
                                    {selectedDay && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold">
                                                    Theaters on{" "}
                                                    <span className="text-gray-300">
                                                        {selectedDay.date}
                                                    </span>
                                                </p>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={openAddShowModal}
                                                        disabled={!groupedTheatersForDay.length}
                                                        className={`
                              inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-md cursor-pointer border
                              ${groupedTheatersForDay.length
                                                                ? "border-primary text-primary hover:bg-primary/10"
                                                                : "border-white/15 text-gray-500 cursor-not-allowed"
                                                            }
                            `}
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Add show
                                                    </button>

                                                    {selectedDay.slots.length > 0 && (
                                                        <button
                                                            onClick={toggleDayHidden}
                                                            disabled={dayVisibilityLoading}
                                                            className={`
                                text-[11px] px-3 py-1 rounded-md cursor-pointer border
                                ${isDayAllHidden
                                                                    ? "border-emerald-400 text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50"
                                                                    : "border-red-400 text-red-300 bg-red-900/30 hover:bg-red-900/50"
                                                                }
                              `}
                                                        >
                                                            {dayVisibilityLoading
                                                                ? "Updating..."
                                                                : isDayAllHidden
                                                                    ? "Unhide this day"
                                                                    : "Hide entire day"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedDay.slots.length === 0 ? (
                                                <p className="text-xs text-gray-400">
                                                    No shows on this day yet.
                                                </p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {groupedTheatersForDay.map((theater) => {
                                                        const allHiddenForTheater =
                                                            theater.slots.length > 0 &&
                                                            theater.slots.every((s) => s.hidden);

                                                        const theaterLabel =
                                                            theater.theaterAddress && theater.theaterCity
                                                                ? `${theater.theaterAddress}, ${theater.theaterCity}`
                                                                : theater.theaterCity ||
                                                                theater.theaterAddress ||
                                                                "";

                                                        // Reorder slots: upcoming (including "soon") first, then past
                                                        const upcomingSlots = theater.slots.filter(
                                                            (slot) => getSlotStatus(slot.time) !== "past"
                                                        );
                                                        const pastSlots = theater.slots.filter(
                                                            (slot) => getSlotStatus(slot.time) === "past"
                                                        );
                                                        const orderedSlots = [
                                                            ...upcomingSlots,
                                                            ...pastSlots,
                                                        ];

                                                        return (
                                                            <div
                                                                key={theater.theaterId}
                                                                className="
                                  rounded-xl border border-white/12 
                                  bg-black/55 p-4
                                "
                                                            >
                                                                {/* Theater header */}
                                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-white">
                                                                            {theater.theaterName}
                                                                        </p>
                                                                        {theaterLabel && (
                                                                            <p className="text-[11px] text-gray-400 mt-1">
                                                                                {theaterLabel}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {theater.theaterId && (
                                                                        <button
                                                                            disabled={theaterVisibilityLoading}
                                                                            onClick={() =>
                                                                                toggleTheaterHidden(
                                                                                    theater.theaterId,
                                                                                    !allHiddenForTheater
                                                                                )
                                                                            }
                                                                            className={`
                                        text-[11px] px-3 py-1 rounded-md cursor-pointer border
                                        ${allHiddenForTheater
                                                                                    ? "border-emerald-400 text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50"
                                                                                    : "border-red-400 text-red-300 bg-red-900/30 hover:bg-red-900/50"
                                                                                }
                                      `}
                                                                        >
                                                                            {theaterVisibilityLoading
                                                                                ? "Updating..."
                                                                                : allHiddenForTheater
                                                                                    ? "Unhide this theater for this day"
                                                                                    : "Hide this theater for this day"}
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Time slots for this theater */}
                                                                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {orderedSlots.map((slot) => {
                                                                            const status = getSlotStatus(slot.time);
                                                                            const mins = getMinutesDiffFromNow(
                                                                                slot.time
                                                                            );

                                                                            // Base style depending on status
                                                                            let statusClasses = "";
                                                                            if (slot.hidden) {
                                                                                statusClasses =
                                                                                    "opacity-60 border-white/25";
                                                                            } else if (status === "past") {
                                                                                statusClasses =
                                                                                    "opacity-60 border-white/20 bg-black/40";
                                                                            } else if (status === "soon") {
                                                                                statusClasses =
                                                                                    "border-yellow-400 bg-yellow-950/40";
                                                                            } else if (status === "upcoming") {
                                                                                statusClasses =
                                                                                    "border-emerald-400 bg-emerald-950/30";
                                                                            } else {
                                                                                statusClasses =
                                                                                    "border-white/20 bg-black/40";
                                                                            }

                                                                            return (
                                                                                <div
                                                                                    key={slot._id}
                                                                                    className={`
                                            flex items-center justify-between
                                            min-w-[5rem] px-2 py-1.5
                                            rounded-md border text-[11px]
                                            ${statusClasses}
                                          `}
                                                                                >
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-xs font-semibold text-gray-100">
                                                                                            {formatTimeLabel(slot.time)}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-primary mt-0.5">
                                                                                            {slot.experience || "Laser"}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-gray-300">
                                                                                            {slot.format || "2D"}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-gray-300 mt-0.5">
                                                                                            Price: {currency}{" "}
                                                                                            {slot.showPrice}
                                                                                        </span>

                                                                                        {/* Status badges */}
                                                                                        {slot.hidden && (
                                                                                            <span className="text-[10px] text-orange-400 mt-0.5">
                                                                                                Hidden from users
                                                                                            </span>
                                                                                        )}
                                                                                        {!slot.hidden &&
                                                                                            status === "past" && (
                                                                                                <span className="text-[10px] text-red-400 mt-0.5">
                                                                                                    Show time passed
                                                                                                </span>
                                                                                            )}
                                                                                        {!slot.hidden &&
                                                                                            status === "soon" &&
                                                                                            mins !== null &&
                                                                                            mins >= 0 && (
                                                                                                <span className="text-[10px] text-yellow-300 mt-0.5">
                                                                                                    Starts in {mins} min
                                                                                                    {mins !== 1 ? "s" : ""}
                                                                                                </span>
                                                                                            )}
                                                                                    </div>

                                                                                    <button
                                                                                        onClick={() =>
                                                                                            toggleSlotVisibility(
                                                                                                slot._id,
                                                                                                slot.hidden
                                                                                            )
                                                                                        }
                                                                                        className="ml-2 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer bg-white/5 hover:bg-white/10"
                                                                                    >
                                                                                        {slot.hidden ? (
                                                                                            <>
                                                                                                <Eye className="w-3.5 h-3.5" />
                                                                                                Unhide
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <EyeOff className="w-3.5 h-3.5" />
                                                                                                Hide
                                                                                            </>
                                                                                        )}
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
                            Select a movie from the list to manage its shows.
                        </div>
                    )}

                    {/* Add Show Modal (inside drawer) */}
                    {isAddShowOpen && !isMovieHidden && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                            <div className="bg-black/90 border border-white/15 rounded-xl w-full max-w-md mx-4 p-5 relative">
                                <button
                                    onClick={closeAddShowModal}
                                    className="absolute right-3 top-3 p-1 rounded-full hover:bg-white/10 cursor-pointer"
                                    disabled={creatingShows}
                                >
                                    <X className="w-4 h-4 text-gray-300" />
                                </button>

                                <h3 className="text-sm font-semibold mb-1">
                                    Add show for&nbsp;
                                    <span className="text-primary">
                                        {selectedMovie?.title || ""}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-gray-500 mb-4">
                                    Configure date, theater, show timings, experience and custom
                                    price for this movie.
                                </p>

                                <div className="space-y-3 text-xs">
                                    {/* Date */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-gray-300">Date</label>
                                        <input
                                            type="date"
                                            value={addShowForm.date}
                                            onChange={(e) =>
                                                setAddShowForm((prev) => ({
                                                    ...prev,
                                                    date: e.target.value,
                                                }))
                                            }
                                            className="bg-black/70 border border-white/15 rounded-md px-2 py-1 outline-none text-gray-100 text-xs focus:border-primary"
                                        />
                                    </div>

                                    {/* Theater */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-gray-300">Theater</label>
                                        {groupedTheatersForDay.length === 0 ? (
                                            <p className="text-[11px] text-gray-500">
                                                No theaters found for this day yet. Once at least one
                                                auto show exists, you can add more slots.
                                            </p>
                                        ) : (
                                            <select
                                                value={addShowForm.theaterId}
                                                onChange={(e) =>
                                                    setAddShowForm((prev) => ({
                                                        ...prev,
                                                        theaterId: e.target.value,
                                                    }))
                                                }
                                                className="bg-black/70 border border-white/15 rounded-md px-2 py-1 outline-none text-gray-100 text-xs focus:border-primary"
                                            >
                                                {groupedTheatersForDay.map((t) => (
                                                    <option key={t.theaterId} value={t.theaterId}>
                                                        {t.theaterName}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Time list */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300">
                                            Show timings (HH:MM, 24h)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="e.g. 14:15"
                                                value={addShowForm.timeInput}
                                                onChange={(e) =>
                                                    setAddShowForm((prev) => ({
                                                        ...prev,
                                                        timeInput: e.target.value,
                                                    }))
                                                }
                                                className="flex-1 bg-black/70 border border-white/15 rounded-md px-2 py-1 outline-none text-gray-100 text-xs focus:border-primary"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddTimeToList}
                                                className="inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-md cursor-pointer border border-primary text-primary hover:bg-primary/10"
                                            >
                                                <Plus className="w-3 h-3" /> Add
                                            </button>
                                        </div>

                                        {addShowForm.times.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {addShowForm.times.map((t) => (
                                                    <span
                                                        key={t}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[11px]"
                                                    >
                                                        {t}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeTimeFromList(t)}
                                                            className="hover:text-red-400"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Experience + format preview */}
                                    <div className="flex gap-3">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <label className="text-gray-300">Experience</label>
                                            <select
                                                value={addShowForm.experience}
                                                onChange={(e) =>
                                                    setAddShowForm((prev) => ({
                                                        ...prev,
                                                        experience: e.target.value,
                                                    }))
                                                }
                                                className="bg-black/70 border border-white/15 rounded-md px-2 py-1 outline-none text-gray-100 text-xs focus:border-primary"
                                            >
                                                {EXPERIENCE_OPTIONS.map((opt) => (
                                                    <option
                                                        key={opt.experience}
                                                        value={opt.experience}
                                                    >
                                                        {opt.experience}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-32 flex flex-col gap-1">
                                            <label className="text-gray-300">Format</label>
                                            <div className="h-8 flex items-center px-2 rounded-md bg-black/60 border border-white/15 text-[11px] text-gray-100">
                                                {currentExperiencePair.format}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-gray-300">
                                            Price per ticket ({currency})
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={addShowForm.price}
                                            onChange={(e) =>
                                                setAddShowForm((prev) => ({
                                                    ...prev,
                                                    price: e.target.value,
                                                }))
                                            }
                                            className="bg-black/70 border border-white/15 rounded-md px-2 py-1 outline-none text-gray-100 text-xs focus:border-primary"
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 flex justify-end gap-2 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={closeAddShowModal}
                                        disabled={creatingShows}
                                        className="px-3 py-1 rounded-md border border-white/20 text-gray-300 hover:bg-white/10 cursor-pointer disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCreateShows}
                                        disabled={
                                            creatingShows || groupedTheatersForDay.length === 0
                                        }
                                        className="px-4 py-1 rounded-md border border-primary bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer disabled:opacity-50"
                                    >
                                        {creatingShows ? "Creating..." : "Create show(s)"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ShowDetails;
