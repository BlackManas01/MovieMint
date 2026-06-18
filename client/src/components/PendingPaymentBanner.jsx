// components/PendingPaymentBanner.jsx - Compact global banner shown on every page while a booking is unpaid
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClockIcon, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";

const TEN_MIN = 10 * 60 * 1000;
const CURRENCY = import.meta.env.VITE_CURRENCY || "$";

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
  const [dismissedId, setDismissedId] = useState(null);
  const pollRef = useRef(null);

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

  const liveRemaining = useMemo(() => (pending ? remainingOf(pending) : 0), [pending, now]);

  if (!user || !pending) return null;
  if (isHiddenRoute(location.pathname)) return null;
  if (liveRemaining <= 0) return null;
  if (dismissedId === (pending._id || pending.id)) return null;

  const movie = pending.show?.movie || pending.movie || {};
  const title = movie.title || pending.movieTitle || "your booking";
  const poster = movie.poster_path ? image_base_url + movie.poster_path : null;
  const seats = (pending.bookedSeats || pending.seats || []).join(", ");
  const amount = pending.amount ?? pending.totalAmount;

  const payNow = () => {
    if (pending.paymentLink) {
      window.location.href = pending.paymentLink;
    } else {
      navigate("/my-bookings");
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(94vw,560px)] px-2">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-black/80 backdrop-blur-xl px-3 py-2.5 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.7)]">
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
          onClick={payNow}
          className="shrink-0 px-4 py-1.5 rounded-full bg-primary hover:bg-primary-dull text-black text-sm font-semibold cursor-pointer transition"
        >
          Pay now
        </button>

        <button
          onClick={() => setDismissedId(pending._id || pending.id)}
          aria-label="Dismiss"
          className="shrink-0 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PendingPaymentBanner;
