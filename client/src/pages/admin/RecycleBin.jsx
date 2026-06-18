// pages/admin/RecycleBin.jsx - Soft-deleted bookings with restore / permanent delete (30-day retention)
import React, { useEffect, useMemo, useState } from "react";
import Title from "../../components/admin/Title";
import { dateFormat } from "../../lib/dateFormat";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";
import { RotateCcwIcon, Trash2Icon, ClockIcon } from "lucide-react";

const RETENTION_DAYS = 30;

const RecycleBin = () => {
  const currency = import.meta.env.VITE_CURRENCY;
  const { axios, getToken, user } = useAppContext();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const fetchBin = async () => {
    try {
      const { data } = await axios.get("/api/admin/bin-bookings", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (e) {
      console.error("bin fetch error:", e);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchBin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const daysLeft = (deletedAt) => {
    if (!deletedAt) return RETENTION_DAYS;
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
  };

  const restore = async (ids) => {
    if (!ids || !ids.length) {
      toast.error("Select bookings to restore");
      return;
    }
    try {
      setBusy(true);
      const { data } = await axios.post(
        "/api/admin/bookings/restore",
        { ids },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );
      if (data.success) {
        toast.success(`Restored ${data.restored} booking(s)`);
        setSelectedIds([]);
        await fetchBin();
      } else toast.error(data.message || "Failed to restore");
    } catch (e) {
      console.error(e);
      toast.error("Failed to restore");
    } finally {
      setBusy(false);
    }
  };

  const purge = async (ids) => {
    const count = ids?.length || bookings.length;
    if (!count) {
      toast.error("Bin is empty");
      return;
    }
    if (!window.confirm(`Permanently delete ${count} booking(s)? This cannot be undone.`)) return;
    try {
      setBusy(true);
      const { data } = await axios.delete("/api/admin/bookings/purge", {
        headers: { Authorization: `Bearer ${await getToken()}` },
        data: { ids: ids && ids.length ? ids : undefined },
      });
      if (data.success) {
        toast.success(`Permanently deleted ${data.purged} booking(s)`);
        setSelectedIds([]);
        await fetchBin();
      } else toast.error(data.message || "Failed to delete");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  const allSelected = useMemo(
    () => bookings.length > 0 && bookings.every((b) => selectedIds.includes(b._id)),
    [bookings, selectedIds]
  );

  return (
    <div className="w-full">
      <Title text1="Recycle" text2="Bin" />

      <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <ClockIcon className="w-4 h-4 text-violet-300" />
          Deleted bookings are kept for <span className="text-violet-300 font-medium">{RETENTION_DAYS} days</span>, then permanently removed.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => restore(selectedIds)}
            disabled={busy || selectedIds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer bg-violet-400/15 text-violet-300 border border-violet-400/30 hover:bg-violet-400/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition"
          >
            <RotateCcwIcon className="w-3.5 h-3.5" />
            Restore Selected{selectedIds.length ? ` (${selectedIds.length})` : ""}
          </button>
          <button
            onClick={() => purge(selectedIds)}
            disabled={busy || selectedIds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition"
          >
            <Trash2Icon className="w-3.5 h-3.5" />
            Delete Forever
          </button>
          <button
            onClick={() => purge([])}
            disabled={busy || bookings.length === 0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer bg-white/10 text-gray-300 border border-white/10 hover:bg-amber-500/15 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition"
          >
            Empty Bin
          </button>
        </div>
      </div>

      <div className="w-full mt-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-4">
        <div className="mb-3 text-xs text-gray-400">{bookings.length} item(s) in bin</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-nowrap">
            <thead>
              <tr className="bg-white/[0.04] text-left text-white">
                <th className="p-2 pl-4 w-10">
                  {bookings.length > 0 && (
                    <input
                      type="checkbox"
                      className="accent-violet-400 cursor-pointer"
                      checked={allSelected}
                      onChange={(e) => setSelectedIds(e.target.checked ? bookings.map((b) => b._id) : [])}
                    />
                  )}
                </th>
                <th className="p-2">User</th>
                <th className="p-2">Movie</th>
                <th className="p-2">Show Time</th>
                <th className="p-2">Seats</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Auto-deletes in</th>
              </tr>
            </thead>
            <tbody className="text-sm font-light">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    The Recycle Bin is empty.
                  </td>
                </tr>
              ) : (
                bookings.map((item, index) => {
                  const userName = item.userSnapshot?.name || item.userSnapshot?.email || "Guest";
                  const movieTitle =
                    item.movieTitle || item.show?.movieTitle || item.show?.movie?.title || "Unknown Movie";
                  const showTime = item.show?.showDateTime ? dateFormat(item.show.showDateTime) : "—";
                  const seatLabels = Array.isArray(item.seats) ? item.seats.join(", ") : "-";
                  const checked = selectedIds.includes(item._id);
                  const left = daysLeft(item.deletedAt);
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
                              e.target.checked ? [...prev, item._id] : prev.filter((id) => id !== item._id)
                            )
                          }
                        />
                      </td>
                      <td className="p-2">{userName}</td>
                      <td className="p-2">{movieTitle}</td>
                      <td className="p-2">{showTime}</td>
                      <td className="p-2">{seatLabels}</td>
                      <td className="p-2">{currency} {item.amount ?? 0}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${left <= 5 ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-gray-300"}`}>
                          {left} day{left === 1 ? "" : "s"}
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

export default RecycleBin;
