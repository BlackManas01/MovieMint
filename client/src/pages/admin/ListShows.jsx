import React, {
    useEffect,
    useMemo,
    useState,
    useCallback,
} from "react";
import Title from "../../components/admin/Title";
import { useAppContext } from "../../context/AppContext";
import { X } from "lucide-react";

// Helper: format time nicely
const formatTime = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// Helper: format one date as "Tue, Dec 09"
const formatDateLabel = (d) =>
    d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
    });

// Build 7-day window starting from today (0:00 local)
const buildDateWindow = (days = 7) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const arr = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");

        arr.push({
            iso: `${year}-${month}-${day}`,
            label: formatDateLabel(d),
            isToday: i === 0,
        });
    }
    return arr;
};

const initialDateWindow = buildDateWindow(7);

const ListShows = () => {
    const currency = import.meta.env.VITE_CURRENCY;
    const { axios, getToken, user, image_base_url } = useAppContext();

    // 7-day window of dates
    const [dateOptions] = useState(initialDateWindow);
    const [selectedDate, setSelectedDate] = useState(
        initialDateWindow[0]?.iso || ""
    );

    // Cached summaries per date: { [dateIso]: summaries[] }
    const [summariesByDate, setSummariesByDate] = useState({});
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state for "View slots"
    const [selectedMovieSummary, setSelectedMovieSummary] = useState(null);

    /**
     * Fetch movie-wise summary for a particular date
     * using /api/admin/shows-by-date endpoint.
     *
     * Expect:
     *  data.summaries = [
     *    {
     *      movieId,
     *      movieTitle,
     *      poster_path,
     *      showsCount,
     *      bookingsCount,
     *      earnings,
     *      firstShowTime,
     *      lastShowTime,
     *      slots: [
     *        {
     *          _id,
     *          time,
     *          showPrice,
     *          hidden,
     *          theaterId,
     *          theaterName,
     *          theaterCity,
     *          theaterAddress,
     *          format,
     *          experience
     *        }
     *      ]
     *    }
     *  ]
     */
    const fetchSummariesForDate = useCallback(
        async (dateIso) => {
            if (!dateIso) return;

            try {
                setLoading(true);

                const token = await getToken();
                const { data } = await axios.get(
                    `/api/admin/shows-by-date?date=${dateIso}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!data.success) {
                    console.error("shows-by-date error:", data.message);
                    setSummariesByDate((prev) => ({
                        ...prev,
                        [dateIso]: [],
                    }));
                    return;
                }

                setSummariesByDate((prev) => ({
                    ...prev,
                    [dateIso]: Array.isArray(data.summaries)
                        ? data.summaries
                        : [],
                }));
            } catch (err) {
                console.error("shows-by-date error:", err);
                setSummariesByDate((prev) => ({
                    ...prev,
                    [dateIso]: [],
                }));
            } finally {
                setLoading(false);
            }
        },
        [axios, getToken]
    );

    // Load data whenever user or selected date changes
    useEffect(() => {
        if (!user || !selectedDate) return;

        // If we already fetched for this date once, don't refetch
        if (summariesByDate[selectedDate]) return;

        fetchSummariesForDate(selectedDate);
    }, [user, selectedDate, summariesByDate, fetchSummariesForDate]);

    const summaries = summariesByDate[selectedDate] || [];

    // Apply search filter (agar search box lagana ho future me)
    const filteredSummaries = useMemo(() => {
        if (!searchTerm.trim()) return summaries;
        const q = searchTerm.toLowerCase();
        return summaries.filter((s) =>
            (s.movieTitle || "").toLowerCase().includes(q)
        );
    }, [summaries, searchTerm]);

    // ---------------- Group slots by theater FOR MODAL (same idea as ShowDetails) -----------
    const modalTheaters = useMemo(() => {
        const summary = selectedMovieSummary;
        if (!summary || !Array.isArray(summary.slots)) return [];

        const map = new Map();

        summary.slots.forEach((slot) => {
            if (!slot.theaterId || !slot.theaterName) return;

            const key = String(slot.theaterId);
            if (!map.has(key)) {
                map.set(key, {
                    theaterId: slot.theaterId,
                    theaterName: slot.theaterName,
                    theaterCity: slot.theaterCity || "",
                    theaterAddress: slot.theaterAddress || "",
                    slots: [],
                    earnings: 0, // optional
                });
            }

            const entry = map.get(key);
            entry.slots.push(slot);

            // Optional earning per theater: agar occupiedSeats mile to use karo
            const occupied = slot.occupiedSeats || {};
            const count = Object.keys(occupied).length;
            const price = slot.showPrice || 0;
            entry.earnings += count * price;
        });

        const list = Array.from(map.values());

        // Sort theaters by name
        list.sort((a, b) =>
            (a.theaterName || "").localeCompare(b.theaterName || "")
        );

        // Sort slots by time
        list.forEach((t) =>
            t.slots.sort(
                (a, b) =>
                    new Date(a.time).getTime() - new Date(b.time).getTime()
            )
        );

        return list;
    }, [selectedMovieSummary]);

    /* ------------------------------------------------------------------------ */
    /*  Render
    /* ------------------------------------------------------------------------ */

    return (
        <>
            <Title text1="List" text2="Shows" />

            {/* Date selector row */}
            <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex flex-wrap gap-2">
                    {dateOptions.map((d) => {
                        const isActive = d.iso === selectedDate;
                        return (
                            <button
                                key={d.iso}
                                onClick={() => setSelectedDate(d.iso)}
                                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border cursor-pointer transition
                  ${isActive
                                        ? "bg-primary text-white border-primary shadow-md shadow-primary/40"
                                        : "bg-white/5 text-gray-300 border-white/15 hover:bg-white/10"
                                    }
                `}
                            >
                                {d.label}
                                {d.isToday && " (Today)"}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Small subtitle showing which date is selected */}
            <p className="mt-2 text-xs text-gray-400">
                Showing data for{" "}
                <span className="text-gray-200">
                    {dateOptions.find((d) => d.iso === selectedDate)?.label ??
                        selectedDate}
                </span>
            </p>

            {/* Table */}
            <div className="mt-5 max-w-5xl overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-primary/15 text-left text-xs sm:text-sm">
                            <th className="p-3 sm:p-4 font-medium">Movie</th>
                            <th className="p-3 sm:p-4 font-medium text-center">
                                Shows
                            </th>
                            <th className="p-3 sm:p-4 font-medium text-center">
                                Bookings
                            </th>
                            <th className="p-3 sm:p-4 font-medium text-center">
                                Earnings
                            </th>
                            <th className="p-3 sm:p-4 font-medium text-right">
                                Details
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="p-4 text-center text-gray-400 text-xs"
                                >
                                    Loading shows...
                                </td>
                            </tr>
                        )}

                        {!loading && filteredSummaries.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="p-4 text-center text-gray-400 text-xs"
                                >
                                    No shows found for this date.
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            filteredSummaries.map((item) => {
                                const first = item.firstShowTime
                                    ? new Date(item.firstShowTime)
                                    : null;
                                const last = item.lastShowTime
                                    ? new Date(item.lastShowTime)
                                    : null;

                                const timeRange =
                                    first && last
                                        ? `${formatTime(first)} – ${formatTime(last)}`
                                        : "—";

                                return (
                                    <tr
                                        key={item.movieId}
                                        className="border-t border-white/5 hover:bg-white/5 transition"
                                    >
                                        {/* Movie + poster */}
                                        <td className="p-3 sm:p-4">
                                            <div className="flex items-center gap-3">
                                                {item.poster_path && (
                                                    <img
                                                        src={image_base_url + item.poster_path}
                                                        alt={item.movieTitle}
                                                        className="w-10 h-14 rounded-md object-cover hidden sm:block"
                                                    />
                                                )}
                                                <div>
                                                    <p className="font-medium text-sm sm:text-base">
                                                        {item.movieTitle}
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        {timeRange}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Shows count */}
                                        <td className="p-3 sm:p-4 text-center">
                                            {item.showsCount}
                                        </td>

                                        {/* Bookings */}
                                        <td className="p-3 sm:p-4 text-center">
                                            {item.bookingsCount}
                                        </td>

                                        {/* Earnings */}
                                        <td className="p-3 sm:p-4 text-center whitespace-nowrap">
                                            {currency}{" "}
                                            {item.earnings?.toLocaleString
                                                ? item.earnings.toLocaleString()
                                                : item.earnings}
                                        </td>

                                        {/* View slots button */}
                                        <td className="p-3 sm:p-4 text-right">
                                            <button
                                                onClick={() => setSelectedMovieSummary(item)}
                                                className="text-xs sm:text-[13px] px-3 py-1.5 rounded-full bg-white/10 hover:bg-primary/80 hover:text-white border border-white/15 cursor-pointer transition"
                                            >
                                                View slots
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            {/* ---------------- Modal: View slots (ShowDetails-style cards) ---------------- */}
            {selectedMovieSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-3xl max-h-[80vh] bg-black/90 border border-white/15 rounded-2xl overflow-hidden flex flex-col">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                {selectedMovieSummary.poster_path && (
                                    <img
                                        src={
                                            image_base_url + selectedMovieSummary.poster_path
                                        }
                                        alt={selectedMovieSummary.movieTitle}
                                        className="w-8 h-12 rounded-md object-cover"
                                    />
                                )}
                                <div>
                                    <p className="text-sm font-semibold">
                                        {selectedMovieSummary.movieTitle}
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        Slots on{" "}
                                        {
                                            dateOptions.find((d) => d.iso === selectedDate)
                                                ?.label
                                        }
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMovieSummary(null)}
                                className="p-1 rounded-full hover:bg-white/10 cursor-pointer"
                            >
                                <X className="w-5 h-5 text-gray-300" />
                            </button>
                        </div>

                        {/* Modal body: theaters + slots */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {modalTheaters.length === 0 ? (
                                <p className="text-xs text-gray-400">
                                    No theater-wise data available for this movie on this
                                    date.
                                </p>
                            ) : (
                                modalTheaters.map((theater) => (
                                    <div
                                        key={theater.theaterId}
                                        className="rounded-xl border border-white/12 bg-black/60 p-4 space-y-3"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-white">
                                                    {theater.theaterName}
                                                </p>
                                                {(theater.theaterCity ||
                                                    theater.theaterAddress) && (
                                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                                            {theater.theaterAddress}
                                                            {theater.theaterCity &&
                                                                theater.theaterAddress &&
                                                                ", "}
                                                            {theater.theaterCity}
                                                        </p>
                                                    )}
                                            </div>
                                            <p className="text-[11px] text-gray-300">
                                                Theater earnings:{" "}
                                                <span className="font-semibold text-primary">
                                                    {currency}{" "}
                                                    {theater.earnings?.toLocaleString
                                                        ? theater.earnings.toLocaleString()
                                                        : theater.earnings}
                                                </span>
                                            </p>
                                        </div>

                                        {/* ⭐ SAME CARD STYLE AS ShowDetails (without Hide button) */}
                                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                {theater.slots.map((slot) => (
                                                    <div
                                                        key={slot._id}
                                                        className={`
                              flex items-center justify-between
                              min-w-[5rem] px-2 py-1.5
                              rounded-md border text-[11px]
                              bg-black/40
                              ${slot.hidden
                                                                ? "opacity-60 border-white/20"
                                                                : "border-white/20"
                                                            }
                            `}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-semibold text-gray-100">
                                                                {formatTime(slot.time)}
                                                            </span>
                                                            <span className="text-[10px] text-primary mt-0.5">
                                                                {slot.experience || "Laser"}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                {slot.format || "2D"}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 mt-0.5">
                                                                Price: {currency} {slot.showPrice}
                                                            </span>
                                                            {slot.hidden && (
                                                                <span className="text-[10px] text-orange-400 mt-0.5">
                                                                    Hidden from users
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ListShows;
