// pages/admin/Dashboard.jsx - Admin dashboard with stats (bookings, revenue, users) and today's shows
import {
    ChartLineIcon,
    CircleDollarSignIcon,
    PlayCircleIcon,
    StarIcon,
    UsersIcon,
    MapPin,
    CalendarDays,
    X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import Title from "../../components/admin/Title";
import BlurCircle from "../../components/BlurCircle";
import { dateFormat } from "../../lib/dateFormat";
import timeFormat from "../../lib/timeFormat";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";

// Animated count-up for stat numbers
const useCountUp = (target, duration = 900) => {
    const [val, setVal] = useState(0);
    useEffect(() => {
        const to = Number(target) || 0;
        let raf;
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            if (p < 1) { setVal(to * eased); raf = requestAnimationFrame(tick); }
            else setVal(to);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return val;
};

const StatValue = ({ value, prefix = "" }) => {
    const n = useCountUp(value);
    return <>{prefix}{Math.round(n).toLocaleString()}</>;
};

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
    const [expFilter, setExpFilter] = useState("all");

    // Reset the experience filter whenever a different movie is opened.
    useEffect(() => {
        setExpFilter("all");
    }, [selectedMovieGroup]);

    // Lock background page scroll while the modal is open.
    useEffect(() => {
        if (!selectedMovieGroup) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [selectedMovieGroup]);

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
            raw: Number(dashboardData.totalBookings || 0),
            prefix: "",
            icon: ChartLineIcon,
            bar: "from-violet-400 to-purple-500",
            iconCls: "border-violet-400/30 bg-violet-400/10 text-violet-300",
        },
        {
            title: "Total Revenue",
            raw: Number(dashboardData.totalRevenue || 0),
            prefix: currency || "",
            icon: CircleDollarSignIcon,
            bar: "from-amber-400 to-orange-500",
            iconCls: "border-amber-400/30 bg-amber-400/10 text-amber-300",
        },
        {
            title: "Movies Playing Today",
            raw: activeShowsByMovie.length || 0,
            prefix: "",
            icon: PlayCircleIcon,
            bar: "from-fuchsia-400 to-pink-500",
            iconCls: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300",
        },
        {
            title: "Total Users",
            raw: Number(dashboardData.totalUser || 0),
            prefix: "",
            icon: UsersIcon,
            bar: "from-sky-400 to-cyan-500",
            iconCls: "border-sky-400/30 bg-sky-400/10 text-sky-300",
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
            <div className="w-full">
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
            </div>
        );
    }

    // ---------- Render ----------
    return (
        <div className="w-full">
            <Title text1="Admin" text2="Dashboard" />
            <p className="mt-1 text-sm text-gray-400">
                {`Welcome back${user?.firstName ? `, ${user.firstName}` : ""} · `}
                <span className="text-gray-300">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
            </p>

            {/* Stats cards */}
            <div className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mt-8">
                <BlurCircle top="-100px" left="0" />
                {dashboardCards.map((card, index) => (
                    <div key={index} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 pt-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_24px_60px_-30px_rgba(167,139,250,0.7)]">
                        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.bar}`} />
                        <div className="relative flex items-start justify-between">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{card.title}</p>
                                <p className="text-3xl font-bold mt-2 tracking-tight"><StatValue value={card.raw} prefix={card.prefix} /></p>
                            </div>
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${card.iconCls} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                                <card.icon className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Insights row */}
            {(() => {
                const bookings = Number(dashboardData.totalBookings || 0);
                const revenue = Number(dashboardData.totalRevenue || 0);
                const avgTicket = bookings > 0 ? Math.round(revenue / bookings) : 0;
                const top = [...activeShowsByMovie].sort((a, b) => b.shows.length - a.shows.length)[0];
                const insights = [
                    { label: "Avg. ticket price", value: `${currency || ""} ${avgTicket}` },
                    { label: "Shows scheduled today", value: rawActiveShows.length || 0 },
                    {
                        label: "Top movie today",
                        value: top?.movie?.title || "—",
                        sub: top ? `${top.shows.length} show(s)` : "",
                    },
                ];
                return (
                    <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
                        {insights.map((it) => (
                            <div key={it.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{it.label}</p>
                                <p className="text-xl font-semibold mt-2 tracking-tight truncate">{it.value}</p>
                                {it.sub && <p className="text-xs text-gray-500 mt-1">{it.sub}</p>}
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* Active shows, grouped by movie */}
            <p className="mt-12 text-xl font-semibold tracking-tight bg-gradient-to-r from-white to-violet-300/80 bg-clip-text text-transparent w-max">Active Shows Today</p>
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
                                className="w-55 rounded-xl cursor-pointer overflow-hidden h-full pb-3 bg-white/[0.03] border border-white/10 transition-all duration-200 group-hover:opacity-60 hover:opacity-100 hover:-translate-y-1 hover:scale-[1.02] hover:border-violet-400/40 hover:shadow-[0_20px_50px_-28px_rgba(167,139,250,0.8)] text-left"
                            >
                                {poster && (
                                    <div className="relative">
                                        <img src={image_base_url + poster} alt={movie.title || "Movie"} className="h-60 w-full object-cover" />
                                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 surface-fade-up" />
                                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/70 border border-violet-400/40 text-violet-200 backdrop-blur">
                                            {group.shows.length} show{group.shows.length > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                )}

                                <p className="font-medium p-2 truncate">{movie.title || "Untitled"}</p>

                                <div className="flex items-center justify-between px-2">
                                    <p className="text-medium font-medium">{runtimeLabel}</p>

                                    <p className="flex items-center gap-1 text-sm text-gray-400 mt-1 pr-1">
                                        <StarIcon className="w-4 h-4 text-amber-400 fill-amber-400" />
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
            {selectedMovieGroup && (() => {
                const m = selectedMovieGroup.movie;
                const backdrop = m.backdrop_path
                    ? image_base_url + m.backdrop_path
                    : (m.poster_path ? image_base_url + m.poster_path : null);
                const totalShows = selectedMovieGroup.shows.length;
                const totalTheaters = selectedMovieTheaters.length;
                const rating = m.vote_average;
                const rt = runtimeCache[selectedMovieGroup.movieId] || m.runtime;
                const expAccent = (exp = "") => {
                    const e = (exp || "").toLowerCase();
                    if (e.includes("imax")) return "border-sky-400/40 bg-sky-400/10 text-sky-300";
                    if (e.includes("4dx")) return "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300";
                    if (e.includes("dolby")) return "border-amber-400/40 bg-amber-400/10 text-amber-300";
                    if (e.includes("insignia")) return "border-violet-400/40 bg-violet-400/10 text-violet-300";
                    return "border-white/20 bg-white/5 text-gray-300";
                };
                // Available experiences + filtered theaters
                const allExps = Array.from(new Set(selectedMovieGroup.shows.map((s) => s.experience || "Standard"))).sort();
                const matchExp = (s) => expFilter === "all" || (s.experience || "Standard") === expFilter;
                const visibleTheaters = selectedMovieTheaters
                    .map((t) => ({ ...t, shows: t.shows.filter(matchExp) }))
                    .filter((t) => t.shows.length);
                return (
                    <div onClick={closeMovieModal} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                        <div onClick={(e) => e.stopPropagation()} className="animate-pop-in w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-[#15101c] to-black shadow-[0_40px_120px_-30px_rgba(168,85,247,0.6)] flex flex-col">
                            {/* Hero header with backdrop */}
                            <div className="relative h-44 sm:h-52 shrink-0">
                                {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0810] via-[#0c0810]/75 to-black/30" />
                                <button onClick={closeMovieModal} className="absolute top-3 right-3 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-black/60 border border-white/15 text-gray-200 hover:bg-primary hover:text-black transition cursor-pointer">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end gap-4">
                                    {m.poster_path && (
                                        <img src={image_base_url + m.poster_path} alt={m.title} className="hidden sm:block w-20 h-28 rounded-xl object-cover ring-1 ring-white/20 shadow-2xl -mb-1" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h2 className="text-2xl font-bold truncate">{m.title}</h2>
                                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-300">
                                            {rating ? (
                                                <span className="inline-flex items-center gap-1"><StarIcon className="w-4 h-4 text-amber-400 fill-amber-400" />{rating.toFixed(1)}</span>
                                            ) : null}
                                            {rt ? <span>{timeFormat(rt)}</span> : null}
                                            <span className="inline-flex items-center gap-1 text-violet-300"><CalendarDays className="w-4 h-4" /> Today</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary strip */}
                            <div className="grid grid-cols-2 gap-px bg-white/10 shrink-0">
                                <div className="bg-[#0c0810] px-5 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Shows today</div>
                                    <div className="text-lg font-bold text-violet-200">{totalShows}</div>
                                </div>
                                <div className="bg-[#0c0810] px-5 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Theaters</div>
                                    <div className="text-lg font-bold text-fuchsia-200">{totalTheaters}</div>
                                </div>
                            </div>

                            {/* Experience filter */}
                            {allExps.length > 1 && (
                                <div className="shrink-0 px-5 pt-4 flex flex-wrap gap-2">
                                    <button onClick={() => setExpFilter("all")} className={`text-xs px-3 py-1 rounded-full border transition cursor-pointer ${expFilter === "all" ? "bg-primary text-black border-primary font-semibold" : "border-white/15 bg-white/5 text-gray-300 hover:border-primary/40"}`}>All</button>
                                    {allExps.map((e) => (
                                        <button key={e} onClick={() => setExpFilter(e)} className={`text-xs px-3 py-1 rounded-full border transition cursor-pointer ${expFilter === e ? "bg-primary text-black border-primary font-semibold" : `${expAccent(e)} hover:brightness-125`}`}>{e}</button>
                                    ))}
                                </div>
                            )}

                            {/* Theaters + showtimes */}
                            <div className="overflow-y-auto modal-scroll p-5 space-y-4">
                                {visibleTheaters.length === 0 ? (
                                    <p className="text-sm text-gray-400">No showtimes for this filter.</p>
                                ) : (
                                    visibleTheaters.map((theater) => {
                                        const label = theater.theaterAddress && theater.theaterCity
                                            ? `${theater.theaterAddress}, ${theater.theaterCity}`
                                            : theater.theaterCity || theater.theaterAddress || "";
                                        return (
                                            <div key={theater.theaterId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-white flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary shrink-0" />{theater.theaterName}</p>
                                                        {label && <p className="text-[11px] text-gray-400 mt-0.5 pl-[22px]">{label}</p>}
                                                    </div>
                                                    <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">{theater.shows.length} show{theater.shows.length > 1 ? "s" : ""}</span>
                                                </div>

                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {theater.shows.map((show) => (
                                                        <div key={show._id} className="min-w-[96px] px-3 py-2 rounded-xl border border-white/10 bg-black/40 hover:border-primary/40 hover:bg-primary/5 transition cursor-default">
                                                            <div className="text-sm font-bold text-gray-100">{formatTime(show.showDateTime)}</div>
                                                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${expAccent(show.experience)}`}>{show.experience || "Standard"}</span>
                                                                <span className="text-[10px] text-gray-400">{show.format || "2D"}</span>
                                                            </div>
                                                            <div className="mt-1 text-[11px] font-semibold text-primary">{currency} {show.showPrice ?? show.price ?? 0}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default Dashboard;