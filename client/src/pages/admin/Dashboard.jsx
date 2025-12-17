// src/pages/admin/Dashboard.jsx
import {
    ChartLineIcon,
    CircleDollarSignIcon,
    PlayCircleIcon,
    StarIcon,
    UsersIcon,
    X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import Title from "../../components/admin/Title";
import BlurCircle from "../../components/BlurCircle";
import { dateFormat } from "../../lib/dateFormat";
import timeFormat from "../../lib/timeFormat";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";

const Dashboard = () => {
    const { axios, getToken, user, image_base_url } = useAppContext();
    const currency = import.meta.env.VITE_CURRENCY;

    const [dashboardData, setDashboardData] = useState({
        totalBookings: 0,
        totalRevenue: 0,
        activeShows: [],
        totalUser: 0,
    });
    const [loading, setLoading] = useState(true);

    // runtimeCache: { [movieId]: runtimeMinutes }
    const [runtimeCache, setRuntimeCache] = useState({});

    // Popup: today's shows for a single movie
    const [selectedMovieGroup, setSelectedMovieGroup] = useState(null);

    // Fetch dashboard
    const fetchDashboardData = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get("/api/admin/dashboard", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (data.success) {
                setDashboardData(data.dashboardData || {});
            } else {
                toast.error(data.message || "Failed to fetch dashboard data");
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            toast.error("Error fetching dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchDashboardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // ---------- Normalize & group today's active shows by movie ----------
    const rawActiveShows = Array.isArray(dashboardData.activeShows)
        ? dashboardData.activeShows
        : [];

    const activeShowsByMovie = useMemo(() => {
        const map = new Map();

        rawActiveShows.forEach((show) => {
            if (!show || !show.movie) return;

            const movie = show.movie;
            const movieId = movie._id || movie.id;
            if (!movieId) return;

            if (!map.has(movieId)) {
                map.set(movieId, {
                    movieId,
                    movie,
                    shows: [],
                });
            }

            map.get(movieId).shows.push(show);
        });

        return Array.from(map.values());
    }, [rawActiveShows]);

    // ---------- Fetch missing runtimes (batch, limited concurrency) ----------
    useEffect(() => {
        // Build list of movieIds where runtime is missing and not already cached
        const movieIdsToFetch = activeShowsByMovie
            .map((g) => g.movieId)
            .filter((id) => {
                const group = activeShowsByMovie.find((x) => x.movieId === id);
                const movie = group?.movie;
                // if movie has runtime numeric -> skip
                const hasMovieRuntime =
                    movie &&
                    (movie.runtime ||
                        movie.run_time ||
                        movie.duration ||
                        movie.length ||
                        movie.runtime === 0); // allow zero if present
                return !hasMovieRuntime && !runtimeCache[id];
            });

        if (!movieIdsToFetch.length) return;

        let cancelled = false;

        // helper: convert possible runtime to minutes
        const normalizeRuntimeToMinutes = (val) => {
            if (val == null) return null;
            const num = Number(val);
            if (!Number.isFinite(num) || num <= 0) return null;
            // if looks like seconds ( > 1000 ) convert to minutes
            return num > 1000 ? Math.round(num / 60) : Math.round(num);
        };

        // concurrency limited worker
        const CONCURRENCY = 4;
        const queue = [...movieIdsToFetch];

        const worker = async () => {
            while (queue.length && !cancelled) {
                const movieId = queue.shift();
                try {
                    // try fast details endpoint you already use in MovieDetails
                    // no auth expected (same as your MovieDetails call). If your endpoint requires auth, adjust accordingly.
                    const res = await axios.get(`/api/show/now-playing/${movieId}`);
                    if (res?.data?.success && res.data.movie) {
                        const runtimeRaw = res.data.movie.runtime ?? res.data.movie.run_time ?? res.data.movie.duration;
                        const minutes = normalizeRuntimeToMinutes(runtimeRaw);
                        if (minutes) {
                            setRuntimeCache((prev) => ({ ...prev, [movieId]: minutes }));
                        }
                    }
                } catch (err) {
                    // don't throw — just skip and leave as unresolved
                    console.debug("runtime fetch failed for", movieId, err?.message || err);
                }
            }
        };

        // spawn workers
        const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
        Promise.all(workers).catch(() => { /* ignore */ });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeShowsByMovie, axios, runtimeCache]);

    // Stats cards
    const dashboardCards = [
        {
            title: "Total Bookings",
            value: dashboardData.totalBookings || "0",
            icon: ChartLineIcon,
        },
        {
            title: "Total Revenue",
            value:
                (currency || "") +
                (dashboardData.totalRevenue?.toLocaleString?.() ??
                    dashboardData.totalRevenue ??
                    "0") || "0",
            icon: CircleDollarSignIcon,
        },
        {
            title: "Movies Playing Today",
            value: activeShowsByMovie.length || "0",
            icon: PlayCircleIcon,
        },
        {
            title: "Total Users",
            value: dashboardData.totalUser || "0",
            icon: UsersIcon,
        },
    ];

    // ---------- Modal helpers ----------
    const openMovieModal = (group) => setSelectedMovieGroup(group);
    const closeMovieModal = () => setSelectedMovieGroup(null);

    const selectedMovieTheaters = useMemo(() => {
        if (!selectedMovieGroup) return [];
        const map = new Map();

        selectedMovieGroup.shows.forEach((show) => {
            const theater = show.theater;
            const theaterId = theater?._id || theater?.id || "unknown";
            if (!map.has(theaterId)) {
                map.set(theaterId, {
                    theaterId,
                    theaterName: theater?.name || "Unknown Theater",
                    theaterCity: theater?.city || "",
                    theaterAddress: theater?.address || "",
                    shows: [],
                });
            }
            map.get(theaterId).shows.push(show);
        });

        const theaters = Array.from(map.values());
        theaters.sort((a, b) => (a.theaterName || "").localeCompare(b.theaterName || ""));
        theaters.forEach((t) =>
            t.shows.sort((a, b) => new Date(a.showDateTime).getTime() - new Date(b.showDateTime).getTime())
        );
        return theaters;
    }, [selectedMovieGroup]);

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return dateStr;
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    };

    // ---------- Loading skeleton ----------
    if (loading) {
        return (
            <>
                <Title text1="Admin" text2="Dashboard" />
                <div className="relative flex flex-wrap gap-4 mt-6">
                    <BlurCircle top="-100px" left="0" />
                    <div className="flex flex-wrap gap-4 w-full">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-md max-w-50 w-full animate-pulse">
                                <div className="w-full">
                                    <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                                    <div className="h-5 w-32 bg-white/15 rounded" />
                                </div>
                                <div className="w-6 h-6 bg-white/10 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>

                <p className="mt-10 text-lg font-medium">Active Shows</p>
                <div className="relative flex flex-wrap gap-6 mt-4 max-w-5xl">
                    <BlurCircle top="100px" left="-10%" />
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="w-55 rounded-lg overflow-hidden h-full pb-3 bg-white/5 border border-white/10 animate-pulse">
                            <div className="h-60 w-full bg-white/10" />
                            <div className="p-2">
                                <div className="h-4 w-40 bg-white/15 rounded mb-2" />
                                <div className="flex items-center justify-between">
                                    <div className="h-5 w-20 bg-white/15 rounded" />
                                    <div className="h-4 w-16 bg-white/10 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    }

    // ---------- Render ----------
    return (
        <>
            <Title text1="Admin" text2="Dashboard" />

            {/* Stats cards */}
            <div className="relative flex flex-wrap gap-4 mt-6">
                <BlurCircle top="-100px" left="0" />
                <div className="flex flex-wrap gap-4 w-full">
                    {dashboardCards.map((card, index) => (
                        <div key={index} className="flex items-center justify-between px-4 py-3 bg-primary/10 border border-primary/20 rounded-md max-w-50 w-full transition-transform transition-opacity duration-200">
                            <div>
                                <h1 className="text-sm">{card.title}</h1>
                                <p className="text-xl font-medium mt-1">{card.value}</p>
                            </div>
                            <card.icon className="w-6 h-6" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Active shows, grouped by movie */}
            <p className="mt-10 text-lg font-medium">Active Shows</p>
            <div className="relative flex flex-wrap gap-6 mt-4 max-w-5xl group">
                <BlurCircle top="100px" left="-10%" />
                {activeShowsByMovie.length === 0 ? (
                    <p className="text-sm text-gray-400 mt-2">No active shows for today.</p>
                ) : (
                    activeShowsByMovie.map((group) => {
                        const movie = group.movie;
                        const poster = movie.poster_path || movie.backdrop_path || null;
                        const rating = Number(movie.vote_average || 0);

                        // Resolve runtime: prefer runtimeCache, then movie fields (various names).
                        const candidateMovieRuntime =
                            movie?.runtime ?? movie?.run_time ?? movie?.duration ?? movie?.length ?? null;
                        const runtimeMinutes = runtimeCache[group.movieId] ?? (Number.isFinite(Number(candidateMovieRuntime)) ? Number(candidateMovieRuntime) : null);

                        // If runtimeMinutes looks like seconds (huge), convert
                        const resolvedMinutes = runtimeMinutes && runtimeMinutes > 1000 ? Math.round(runtimeMinutes / 60) : runtimeMinutes;

                        const runtimeLabel = resolvedMinutes ? timeFormat(resolvedMinutes) : "—";

                        return (
                            <button
                                type="button"
                                key={group.movieId}
                                onClick={() => openMovieModal(group)}
                                className="w-55 rounded-lg cursor-pointer overflow-hidden h-full pb-3 bg-primary/10 border border-primary/20 transition-all duration-200 group-hover:opacity-60 hover:opacity-100 hover:-translate-y-1 hover:scale-[1.02] text-left"
                            >
                                {poster && <img src={image_base_url + poster} alt={movie.title || "Movie"} className="h-60 w-full object-cover" />}

                                <p className="font-medium p-2 truncate">{movie.title || "Untitled"}</p>

                                <div className="flex items-center justify-between px-2">
                                    <p className="text-medium font-medium">{runtimeLabel}</p>

                                    <p className="flex items-center gap-1 text-sm text-gray-400 mt-1 pr-1">
                                        <StarIcon className="w-4 h-4 text-primary fill-primary" />
                                        {rating ? rating.toFixed(1) : "—"}
                                    </p>
                                </div>

                                <p className="px-2 pt-2 text-xs text-gray-500">
                                    {group.shows[0]?.showDateTime ? dateFormat(group.shows[0].showDateTime) : ""}
                                </p>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Modal: today's showtimes for selected movie */}
            {selectedMovieGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-3xl bg-black/90 border border-white/15 rounded-2xl p-5 relative">
                        <button onClick={closeMovieModal} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 cursor-pointer">
                            <X className="w-5 h-5 text-gray-300" />
                        </button>

                        <div className="flex gap-4 mb-4">
                            {selectedMovieGroup.movie.poster_path && (
                                <img src={image_base_url + selectedMovieGroup.movie.poster_path} alt={selectedMovieGroup.movie.title} className="w-20 h-28 object-cover rounded-md" />
                            )}
                            <div>
                                <h2 className="text-lg font-semibold">{selectedMovieGroup.movie.title}</h2>
                                <p className="text-xs text-gray-400 mt-1">Today's showtimes by theater</p>
                            </div>
                        </div>

                        {selectedMovieTheaters.length === 0 ? (
                            <p className="text-sm text-gray-400">No showtimes for this movie today.</p>
                        ) : (
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                {selectedMovieTheaters.map((theater) => {
                                    const label = theater.theaterAddress && theater.theaterCity ? `${theater.theaterAddress}, ${theater.theaterCity}` : theater.theaterCity || theater.theaterAddress || "";

                                    return (
                                        <div key={theater.theaterId} className="rounded-xl border border-white/12 bg-black/60 p-3">
                                            <p className="text-sm font-semibold text-white">{theater.theaterName}</p>
                                            {label && <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>}

                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {theater.shows.map((show) => (
                                                    <div key={show._id} className="px-3 py-1.5 rounded-md border border-white/20 bg-black/50 text-xs flex flex-col gap-0.5">
                                                        <span className="font-semibold text-gray-100">{formatTime(show.showDateTime)}</span>
                                                        <span className="text-[11px] text-primary">{show.format || "2D"}</span>
                                                        <span className="text-[11px] text-gray-400">{show.experience || "Standard"}</span>
                                                        <span className="text-[11px] text-gray-300">Price: {currency} {show.showPrice ?? show.price ?? 0}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default Dashboard;