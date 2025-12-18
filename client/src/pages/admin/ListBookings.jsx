import React, { useEffect, useState } from "react";
import Loading from "../../components/Loading"; // fallback (optional)
import Title from "../../components/admin/Title";
import { dateFormat } from "../../lib/dateFormat";
import { useAppContext } from "../../context/AppContext";
import { useMemo } from "react";

const PAGE_SIZE = 10;

//---------------------- SKELETON ROW COMPONENT ----------------------
const SkeletonRow = () => {
  return (
    <tr className="border-b border-primary/20">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="p-3">
          <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
        </td>
      ))}
    </tr>
  );
};

// ---------------------- MAIN COMPONENT ----------------------
const ListBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY;

  const { axios, getToken, user } = useAppContext();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("UPCOMING");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const getShowDateMs = (item) => {
    const t = item.show?.showDateTime;
    const ms = new Date(t).getTime();
    return isNaN(ms) ? null : ms;
  };

  const getBookingStatus = (item) => {
    const ms = getShowDateMs(item);
    if (!ms) return "—";
    return ms < Date.now() ? "EXPIRED" : "UPCOMING";
  };

  const isToday = (ms) => {
    const d = new Date(ms);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isTomorrow = (ms) => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return (
      new Date(ms).getDate() === t.getDate() &&
      new Date(ms).getMonth() === t.getMonth() &&
      new Date(ms).getFullYear() === t.getFullYear()
    );
  };

  const statusCounts = useMemo(() => {
    let upcoming = 0;
    let expired = 0;
    let today = 0;
    let tomorrow = 0;

    bookings.forEach((b) => {
      if (!b.isPaid) return;
      const ms = getShowDateMs(b);
      if (!ms) return;

      if (ms < Date.now()) expired++;
      else upcoming++;

      if (isToday(ms)) today++;
      if (isTomorrow(ms)) tomorrow++;
    });

    return { upcoming, expired, today, tomorrow };
  }, [bookings]);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setStatusFilter("UPCOMING");
    setPage(1);
  };

  const getAllBookings = async () => {
    try {
      const { data } = await axios.get("/api/admin/all-bookings", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      const list = Array.isArray(data.bookings) ? data.bookings : [];

      list.sort((a, b) => {
        const aTime = new Date(a.show?.showDateTime || 0).getTime();
        const bTime = new Date(b.show?.showDateTime || 0).getTime();
        return bTime - aTime;
      });

      setBookings(list);
    } catch (error) {
      console.error("all-bookings error:", error);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      getAllBookings();
    }
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [bookings.length]);

  // ----------------------- LOADING SKELETON ------------------------
  if (isLoading) {
    return (
      <>
        <Title text1="List" text2="Bookings" />

        <div className="max-w-4xl mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
            <thead>
              <tr className="bg-primary/20 text-left text-white">
                <th className="p-2 pl-5">User Name</th>
                <th className="p-2">Movie Name</th>
                <th className="p-2">Show Time</th>
                <th className="p-2">Seats</th>
                <th className="p-2">Amount</th>
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // Only PAID bookings
  const filteredBookings = bookings
    .filter((b) => b.isPaid)
    .filter((b) => {
      const ms = getShowDateMs(b);
      if (!ms) return false;

      // STATUS FILTER
      if (statusFilter === "UPCOMING" && ms < Date.now()) return false;
      if (statusFilter === "EXPIRED" && ms >= Date.now()) return false;
      // ALL → no filtering

      // DATE RANGE
      if (fromDate) {
        const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
        if (ms < fromMs) return false;
      }

      if (toDate) {
        const toMs = new Date(toDate).setHours(23, 59, 59, 999);
        if (ms > toMs) return false;
      }

      return true;
    });
  const total = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;

  const pageItems = filteredBookings.slice(startIndex, endIndex);

  return (
    <>
      <Title text1="List" text2="Bookings" />

      <div className="flex flex-wrap gap-3 mt-4 mb-4">
        <div className="px-4 py-2 rounded bg-emerald-500/20 text-emerald-400 text-sm">
          Upcoming: {statusCounts.upcoming}
        </div>
        <div className="px-4 py-2 rounded bg-red-500/20 text-red-400 text-sm">
          Expired: {statusCounts.expired}
        </div>
        <div className="px-4 py-2 rounded bg-sky-500/20 text-sky-400 text-sm">
          Today: {statusCounts.today}
        </div>
        <div className="px-4 py-2 rounded bg-violet-500/20 text-violet-400 text-sm">
          Tomorrow: {statusCounts.tomorrow}
        </div>
      </div>

      <div className="flex gap-2 mt-4 mb-3">
        {["ALL", "UPCOMING", "EXPIRED"].map((t) => (
          <button
            key={t}
            onClick={() => setStatusFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition
        ${statusFilter === t
                ? "bg-teal-500 text-black"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="
    bg-black/20
    border border-white/10
    px-3 py-1.5
    rounded-md
    text-sm text-gray-300
    placeholder-gray-500
    cursor-pointer
    hover:bg-black/30
    focus:outline-none
    focus:ring-1 focus:ring-teal-500/40
    focus:border-teal-500/40
    transition
  "
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="
    bg-black/20
    border border-white/10
    px-3 py-1.5
    rounded-md
    text-sm text-gray-300
    cursor-pointer
    hover:bg-black/30
    focus:outline-none
    focus:ring-1 focus:ring-teal-500/40
    focus:border-teal-500/40
    transition
  "
        />


        {(fromDate || toDate || statusFilter !== "UPCOMING") && (
          <button
            onClick={clearFilters}
            className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer
        bg-white/10 text-gray-300 hover:bg-red-500/20 hover:text-red-400 transition"
          >
            Clear
          </button>
        )}
      </div>


      <div className="max-w-4xl mt-6">
        {/* PAGINATION SUMMARY */}
        <div className="flex items-center justify-between mb-3 text-xs text-gray-400">
          <span>
            Showing{" "}
            {total === 0 ? "0" : `${startIndex + 1}–${Math.min(endIndex, total)}`}{" "}
            of {total} bookings
          </span>

          {total > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-white/10 disabled:opacity-40 text-[11px]"
              >
                Prev
              </button>

              <span>
                Page {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-white/10 disabled:opacity-40 text-[11px]"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
            <thead>
              <tr className="bg-primary/20 text-left text-white">
                <th className="p-2 pl-5">User Name</th>
                <th className="p-2">Movie Name</th>
                <th className="p-2">Show Time</th>
                <th className="p-2">Seats</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>

            <tbody className="text-sm font-light">
              {total === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-400">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                pageItems.map((item, index) => {
                  // USER NAME
                  const userName =
                    item.userSnapshot?.name ||
                    item.userSnapshot?.email ||
                    "Guest";

                  // MOVIE NAME
                  const movieTitle =
                    item.movieTitle ||
                    item.show?.movieTitle ||
                    item.show?.movie?.title ||
                    "Unknown Movie";

                  // SHOW TIME
                  const showTime = item.show?.showDateTime
                    ? dateFormat(item.show.showDateTime)
                    : "—";

                  // SEATS
                  const seatLabels = Array.isArray(item.seats)
                    ? item.seats.join(", ")
                    : "-";

                  const status = getBookingStatus(item);
                  return (
                    <tr
                      key={item._id || index}
                      className="border-b border-primary/20 bg-primary/5 even:bg-primary/10"
                    >
                      <td className="p-2 pl-5">{userName}</td>
                      <td className="p-2">{movieTitle}</td>
                      <td className="p-2">{showTime}</td>
                      <td className="p-2">{seatLabels}</td>
                      <td className="p-2">
                        {currency} {item.amount ?? 0}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${status === "UPCOMING"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                            }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ListBookings;