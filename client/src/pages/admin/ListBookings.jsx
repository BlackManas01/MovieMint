// pages/admin/ListBookings.jsx - Admin view of all bookings with filters (status, date) and pagination
import React, { useEffect, useState } from "react";
import Loading from "../../components/Loading"; // fallback (optional)
import Title from "../../components/admin/Title";
import { dateFormat } from "../../lib/dateFormat";
import { useAppContext } from "../../context/AppContext";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { Trash2Icon, TicketIcon } from "lucide-react";

const PAGE_SIZE = 10;

//---------------------- SKELETON ROW COMPONENT ----------------------
const SkeletonRow = () => {
  return (
    <tr className="border-b border-white/10">
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const getShowDateMs = (item) => {
    const t = item.show?.showDateTime;
    const ms = new Date(t).getTime();
    return isNaN(ms) ? null : ms;
  };

  const getBookingStatus = (item) => {
    if (item.status === "cancelled") return "CANCELLED";
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
    setStatusFilter("ALL");
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

  // Move the given booking ids into the Recycle Bin (soft delete).
  const moveToBin = async (ids) => {
    if (!ids || !ids.length) {
      toast.error("Select bookings first");
      return;
    }
    if (!window.confirm(`Move ${ids.length} booking(s) to the Recycle Bin? You can restore them within 30 days.`)) return;
    try {
      setBusy(true);
      const { data } = await axios.post(
        "/api/admin/bookings/soft-delete",
        { ids },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );
      if (data.success) {
        toast.success(`Moved ${data.movedToBin} booking(s) to Recycle Bin`);
        setSelectedIds([]);
        await getAllBookings();
      } else {
        toast.error(data.message || "Failed to move to bin");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to move to bin");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [bookings.length]);

  // ----------------------- LOADING SKELETON ------------------------
  if (isLoading) {
    return (
      <div className="w-full">
        <Title text1="List" text2="Bookings" />

        <div className="w-full mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
            <thead>
              <tr className="bg-white/[0.04] text-left text-white">
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
      </div>
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
    <div className="w-full">
      <Title text1="List" text2="Bookings" />

      {statusCounts.upcoming + statusCounts.expired > 0 && (
        <div className="flex flex-wrap gap-3 mt-4 mb-4">
          <div className="px-4 py-2 rounded bg-violet-500/20 text-violet-300 text-sm">
            Upcoming: {statusCounts.upcoming}
          </div>
          <div className="px-4 py-2 rounded bg-amber-500/15 text-amber-300 text-sm">
            Expired: {statusCounts.expired}
          </div>
          <div className="px-4 py-2 rounded bg-sky-500/20 text-sky-400 text-sm">
            Today: {statusCounts.today}
          </div>
          <div className="px-4 py-2 rounded bg-violet-500/20 text-violet-400 text-sm">
            Tomorrow: {statusCounts.tomorrow}
          </div>
        </div>
      )}

      {statusCounts.upcoming + statusCounts.expired > 0 && (<>
      <div className="flex gap-2 mt-4 mb-3">
        {["ALL", "UPCOMING", "EXPIRED"].map((t) => (
          <button
            key={t}
            onClick={() => setStatusFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition
        ${statusFilter === t
                ? "bg-violet-400 text-black"
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
    focus:ring-1 focus:ring-violet-400/40
    focus:border-violet-400/40
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
    focus:ring-1 focus:ring-violet-400/40
    focus:border-violet-400/40
    transition
  "
        />


        {(fromDate || toDate || statusFilter !== "ALL") && (
          <button
            onClick={clearFilters}
            className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer
        bg-white/10 text-gray-300 hover:bg-amber-500/15 hover:text-amber-300 transition"
          >
            Clear
          </button>
        )}
      </div>
      </>)}

      {/* Bin action toolbar - only when there are rows to act on */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => moveToBin(selectedIds)}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              Move Selected to Bin ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => moveToBin(filteredBookings.map((b) => b._id))}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer bg-white/10 text-gray-300 border border-white/10 hover:bg-amber-500/15 hover:text-amber-300 disabled:opacity-40 disabled:pointer-events-none transition"
          >
            <Trash2Icon className="w-3.5 h-3.5" />
            Move All Shown to Bin
          </button>
        </div>
      )}

      <div className="w-full mt-4 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-4">
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
              <tr className="bg-white/[0.04] text-left text-white">
                <th className="p-2 pl-4 w-10">
                  {total > 0 && (
                    <input
                      type="checkbox"
                      className="accent-violet-400 cursor-pointer"
                      checked={filteredBookings.length > 0 && filteredBookings.every((b) => selectedIds.includes(b._id))}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredBookings.map((b) => b._id) : [])
                      }
                    />
                  )}
                </th>
                <th className="p-2 pl-2">User Name</th>
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
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <span className="relative flex h-16 w-16 items-center justify-center">
                        <span className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-[spin_9s_linear_infinite]" />
                        <span className="absolute inset-1 rounded-full bg-white/[0.03]" />
                        <TicketIcon className="relative w-7 h-7 text-violet-400/80 animate-pulse" />
                      </span>
                      <p className="text-base font-medium text-gray-300">No bookings found</p>
                      <p className="text-xs text-gray-500">Bookings will appear here once customers reserve seats.</p>
                    </div>
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
                  const checked = selectedIds.includes(item._id);
                  return (
                    <tr
                      key={item._id || index}
                      className={`border-b border-white/5 transition ${checked ? "bg-violet-400/10" : "bg-white/[0.02] hover:bg-white/[0.05]"}`}
                    >
                      <td className="p-2 pl-4">
                        <input
                          type="checkbox"
                          className="accent-violet-400 cursor-pointer"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked
                                ? [...prev, item._id]
                                : prev.filter((id) => id !== item._id)
                            )
                          }
                        />
                      </td>
                      <td className="p-2 pl-2">{userName}</td>
                      <td className="p-2">{movieTitle}</td>
                      <td className="p-2">{showTime}</td>
                      <td className="p-2">{seatLabels}</td>
                      <td className="p-2">
                        {currency} {item.amount ?? 0}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${status === "UPCOMING"
                            ? "bg-violet-500/20 text-violet-300"
                            : "bg-amber-500/15 text-amber-300"
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
    </div>
  );
};

export default ListBookings;