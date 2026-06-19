// components/PendingPaymentBanner.jsx - Compact global banner shown on every page while a booking is unpaid
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClockIcon, X, ChevronUp, MapPin, TicketIcon } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import isoTimeFormat from "../lib/isoTimeFormat";
import toast from "react-hot-toast";

const TEN_MIN = 10 * 60 * 1000;
const CURRENCY = import.meta.env.VITE_CURRENCY || "₹";

// Routes that already surface their own pending UI (avoid duplicates)
const isHiddenRoute = (pathname) =>
  /^\/movies\/[^/]+\/[^/]+/.test(pathname) || // seat layout
  pathname.startsWith("/review-booking") ||
  pathname.startsWith("/payment-success") ||
  pathname.startsWith("/loading");

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

const PendingPaymentBanner = () => {
  const { axios, getToken, user, image_base_url } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const [pending, setPending] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef(null);
  const boxRef = useRef(null);

  const remainingOf = (b) => {
    const base = b?.expiresAt
      ? new Date(b.expiresAt).getTime()
      : new Date(b?.createdAt || Date.now()).getTime() + TEN_MIN;
    return base - Date.now();
  };

  const refresh = useCallback(async () => {
    if (!user) {
      setPending(null);
      return;
    }
    try {
      const { data } = await axios.get("/api/user/bookings", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (data?.success && Array.isArray(data.bookings)) {
        const candidates = data.bookings
          .filter((b) => !b.isPaid && remainingOf(b) > 0)
          .sort((a, b) => remainingOf(a) - remainingOf(b));
        setPending(candidates[0] || null);
      } else {
        setPending(null);
      }
    } catch {
      /* silently ignore — banner is non-critical */
    }
  }, [axios, getToken, user]);

  // Fetch on mount, on user change, and on every navigation (so it clears after paying)
  useEffect(() => {
    refresh();
  }, [refresh, location.pathname]);

  // Light polling + refresh on focus
  useEffect(() => {
    pollRef.current = setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // 1-second tick for the countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Collapse the expanded card when clicking anywhere outside it.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setExpanded(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [expanded]);

  const liveRemaining = useMemo(() => (pending ? remainingOf(pending) : 0), [pending, now]);

  if (!user || !pending) return null;
  if (isHiddenRoute(location.pathname)) return null;
  if (liveRemaining <= 0) return null;

  const movie = pending.show?.movie || pending.movie || {};
  const title = movie.title || pending.movieTitle || "your booking";
  const poster = movie.poster_path ? image_base_url + movie.poster_path : null;
  const seatsArr = pending.bookedSeats || pending.seats || [];
  const seats = seatsArr.join(", ");
  const amount = pending.amount ?? pending.totalAmount;
  const theater = pending.show?.theaterName || pending.theaterName || "";
  const showTime = pending.show?.showTime || pending.showTime || pending.time || null;
  const progressPct = Math.max(0, Math.min(100, (liveRemaining / TEN_MIN) * 100));

  const payNow = () => {
    if (pending.paymentLink) {
      window.location.href = pending.paymentLink;
    } else {
      navigate("/my-bookings");
    }
  };

  // Jump to the seat layout for this pending booking.
  const goToSeats = () => {
    const mId = movie._id || pending.show?.movie?._id || pending.movieId;
    const st = pending.show?.showDateTime || showTime;
    const showId = pending.show?._id || pending.showId;
    if (!mId || !st) { navigate("/my-bookings"); return; }
    const iso = new Date(st).toISOString();
    navigate(`/movies/${mId}/${iso.slice(0, 10)}?showId=${showId || ""}&time=${encodeURIComponent(iso)}`);
  };

  // Release (cancel) the unpaid hold — frees the seats and removes it from My Bookings.
  const releaseBooking = async (e) => {
    e?.stopPropagation();
    const bid = pending._id || pending.id;
    try {
      if (bid) {
        await axios.post(
          "/api/booking/release",
          { bookingId: bid },
          { headers: { Authorization: `Bearer ${await getToken()}` } }
        );
      }
      toast.success("Seats released");
    } catch {
      toast.error("Could not release seats");
    } finally {
      // Clear any local seat-page hold + notify the rest of the app.
      try {
        const mId = movie._id || pending.show?.movie?._id || pending.movieId;
        const st = pending.show?.showDateTime || showTime;
        const showId = pending.show?._id || pending.showId;
        if (mId && st && showId) {
          const d = new Date(st).toISOString().slice(0, 10);
          localStorage.removeItem(`tempHold:${mId}:${d}:${showId}`);
          window.dispatchEvent(new CustomEvent("TEMP_HOLD_RELEASED", { detail: { showId } }));
        }
      } catch { /* ignore */ }
      window.dispatchEvent(new Event("BOOKING_RELEASED"));
      setExpanded(false);
      setPending(null);
      refresh();
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(94vw,560px)] px-2">
      <div
        ref={boxRef}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v); }}
        className="group cursor-pointer overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1a130b]/90 via-black/85 to-black/90 backdrop-blur-xl shadow-[0_24px_70px_-25px_rgba(0,0,0,0.85)] transition-all duration-300 hover:border-amber-400/55"
      >
        {/* live countdown progress bar */}
        <div className="h-1 w-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* COMPACT ROW (always visible) */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* pulsing status dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>

          {poster && (
            <img src={poster} alt={title} className="hidden sm:block h-10 w-7 rounded-md object-cover ring-1 ring-white/15" />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-amber-300 font-semibold leading-none">Payment pending</p>
            <p className="text-sm font-medium truncate">
              {title}
              {seats && <span className="text-gray-400 font-normal"> · {seats}</span>}
              {amount != null && <span className="text-gray-400 font-normal"> · {CURRENCY} {amount}</span>}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-amber-300 text-sm font-semibold tabular-nums">
            <ClockIcon className="w-4 h-4" />
            {fmt(liveRemaining)}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); payNow(); }}
            className="shrink-0 px-4 py-1.5 rounded-full bg-gradient-to-b from-primary to-primary-dull hover:brightness-110 text-black text-sm font-semibold cursor-pointer transition shadow-[0_8px_20px_-8px_rgba(168,85,247,0.9)]"
          >
            Pay now
          </button>

          {/* expand chevron */}
          <ChevronUp className={`hidden sm:block w-4 h-4 text-gray-400 shrink-0 transition-transform duration-300 ${expanded ? "rotate-180" : "rotate-0"}`} />

          <button
            onClick={releaseBooking}
            aria-label="Release seats"
            title="Release seats"
            className="shrink-0 p-1 rounded-full text-gray-400 hover:text-red-300 hover:bg-red-500/15 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* EXPANDED DETAILS (smooth height) */}
        <div className={`grid transition-all duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
            <div className="px-3 pb-3 pt-3 border-t border-white/10 flex gap-4">
              {poster && (
                <img src={poster} alt={title} className="h-28 w-20 rounded-lg object-cover ring-1 ring-primary/25 shadow-lg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold truncate">{title}</p>
                {theater && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-300 truncate">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" /> {theater}
                    {showTime && <span className="text-gray-500">· {isoTimeFormat(showTime)}</span>}
                  </p>
                )}

                {/* seat chips */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <TicketIcon className="w-4 h-4 text-gray-400" />
                  {seatsArr.length ? seatsArr.map((s) => (
                    <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/15 text-violet-200 border border-primary/30">{s}</span>
                  )) : <span className="text-xs text-gray-400">No seats</span>}
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Amount</div>
                    <div className="text-2xl font-extrabold bg-gradient-to-r from-primary via-fuchsia-300 to-primary bg-clip-text text-transparent">{amount != null ? `${CURRENCY} ${amount}` : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Expires in</div>
                    <div className="text-xl font-semibold text-amber-300 tabular-nums">{fmt(liveRemaining)}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); payNow(); }}
                    className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-b from-primary to-primary-dull hover:brightness-110 text-black text-sm font-semibold cursor-pointer transition shadow-[0_10px_26px_-10px_rgba(168,85,247,0.9)]"
                  >
                    Pay now · {CURRENCY} {amount}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); goToSeats(); }}
                    className="flex-1 px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 cursor-pointer transition"
                  >
                    View seats
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate("/my-bookings"); }}
                    className="flex-1 px-4 py-2 rounded-xl border border-white/15 text-sm text-gray-200 hover:bg-white/5 cursor-pointer transition"
                  >
                    My Bookings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingPaymentBanner;
