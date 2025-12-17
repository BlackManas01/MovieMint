// src/pages/SeatLayout.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowRightIcon, ClockIcon } from "lucide-react";
import isoTimeFormat from "../lib/isoTimeFormat";
import BlurCircle from "../components/BlurCircle";
import Loading from "../components/Loading";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";

/**
 * SeatLayout (updated - improved UX)
 *
 * Minor change:
 * - When user clicks Proceed to Checkout (bookTickets), we now ALSO save a client-side tempHold
 *   into localStorage under the same key Review/SeatLayout expect (LS.TEMP_HOLD(...))
 *   so MyBookings and ReviewYourBooking immediately see the hold (no reload required).
 *
 * Other logic retained exactly as you provided.
 */

/* -------------------- Config & helpers -------------------- */

const HOLD_TTL = 10 * 60 * 1000; // fallback TTL for client-side holds (if needed)
const POLL_INTERVAL = 30_000;

const LS = {
  LAST_SELECTED: (movieId, date) => `lastSelected:${movieId}:${date}`,
  SELECTED_SEATS: (movieId, date) => `selectedSeats:${movieId}:${date}`,
  TEMP_HOLD: (movieId, date, showId) => `tempHold:${movieId}:${date}:${showId}`,
};

const rowsAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ... (unchanged helper functions getExperienceLayout, formatMs) ...
const getExperienceLayout = (experience, basePrice) => {
  const bp = Number.isFinite(Number(basePrice)) ? Number(basePrice) : 0;
  const sliceRows = (start, count) => rowsAlphabet.slice(start, start + count);
  const colors = {
    executive: "bg-amber-600",
    club: "bg-sky-600",
    royale: "bg-violet-600",
    insignia: "bg-emerald-600",
    prime: "bg-rose-600",
  };

  const laser = {
    seatsPerRow: 12,
    sections: [
      { key: "executive", label: "EXECUTIVE", price: bp + 0, rows: sliceRows(0, 2), colorClass: colors.executive },
      { key: "club", label: "CLUB", price: bp + 5, rows: sliceRows(2, 8), colorClass: colors.club },
      { key: "royale", label: "ROYALE", price: bp + 10, rows: sliceRows(10, 2), colorClass: colors.royale },
    ],
  };

  if (!experience) return laser;
  const exp = experience.toLowerCase();

  if (exp.includes("imax")) {
    return {
      seatsPerRow: 12,
      sections: [
        { key: "executive", label: "EXECUTIVE", price: bp + 0, rows: sliceRows(0, 2), colorClass: colors.executive },
        { key: "club", label: "CLUB", price: bp + 5, rows: sliceRows(2, 6), colorClass: colors.club },
        { key: "royale", label: "ROYALE", price: bp + 10, rows: sliceRows(8, 4), colorClass: colors.royale },
      ],
    };
  }

  if (exp.includes("dolby")) {
    return {
      seatsPerRow: 12,
      sections: [
        { key: "executive", label: "EXECUTIVE", price: bp + 0, rows: sliceRows(0, 2), colorClass: colors.executive },
        { key: "club", label: "CLUB", price: bp + 5, rows: sliceRows(2, 6), colorClass: colors.club },
        { key: "royale", label: "ROYALE", price: bp + 10, rows: sliceRows(8, 4), colorClass: colors.royale },
      ],
    };
  }

  if (exp.includes("insignia")) {
    return {
      seatsPerRow: 10,
      sections: [{ key: "insignia", label: "INSIGNIA", price: bp + 20, rows: sliceRows(0, 6), colorClass: colors.insignia }],
    };
  }

  if (exp.includes("4dx") || exp.includes("4dx-3d")) {
    return {
      seatsPerRow: 10,
      sections: [{ key: "prime", label: "PRIME", price: bp + 30, rows: sliceRows(0, 6), colorClass: colors.prime }],
    };
  }

  return laser;
};

const formatMs = (ms) => {
  if (ms == null || ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

/* -------------------- Component -------------------- */

const SeatLayout = () => {
  const { id, date } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { axios, getToken, user, image_base_url } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  // stable hooks
  const [showData, setShowData] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  const [serverOccupied, setServerOccupied] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [tempHold, setTempHold] = useState(null);
  const [serverHeldSeats, setServerHeldSeats] = useState([]);
  const [holdTimeLeft, setHoldTimeLeft] = useState(null);

  const [cardHiddenLocal, setCardHiddenLocal] = useState(false); // hides the UI card only (no release)
  const [actionLoading, setActionLoading] = useState({ active: false, message: "" });

  const query = useMemo(() => new URLSearchParams(search), [search]);
  const queryShowId = query.get("showId");
  const queryTime = query.get("time");

  const sseRef = useRef(null);
  const pollRef = useRef(null);

  /* ---------------- fetch show ---------------- */
  const fetchShow = async () => {
    try {
      const { data } = await axios.get(`/api/show/${id}`);
      if (data?.success) setShowData(data);
      else {
        toast.error(data?.message || "Failed to load show data");
        setShowData(null);
      }
    } catch (err) {
      console.error("SeatLayout fetchShow error:", err);
      toast.error("Failed to load show data");
      setShowData(null);
    }
  };
  useEffect(() => { fetchShow(); }, [id]);

  const rawSlotsForDate = useMemo(() => {
    if (!showData || !showData.dateTime || !date) return [];
    const arr = showData.dateTime[date];
    return Array.isArray(arr) ? arr : [];
  }, [showData, date]);

  const groupedByTheater = useMemo(() => {
    const map = new Map();
    rawSlotsForDate.forEach((s) => {
      const tid = s.theaterId || s.theater?._id || "unknown";
      if (!map.has(tid)) {
        map.set(tid, { theaterId: tid, theaterName: s.theaterName || s.theater?.name || "Unknown Theater", slots: [] });
      }
      map.get(tid).slots.push(s);
    });
    const out = Array.from(map.values()).map((t) => ({ ...t, slots: t.slots.sort((a, b) => new Date(a.time) - new Date(b.time)) }));
    return out.sort((a, b) => (a.theaterName || "").localeCompare(b.theaterName || ""));
  }, [rawSlotsForDate]);

  useEffect(() => {
    const onPaymentSuccess = async () => {
      // 🔥 remove local tempHold
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("tempHold:")) localStorage.removeItem(k);
      });

      setTempHold(null);
      setHoldTimeLeft(null);
      setCardHiddenLocal(true);

      if (selectedTimeSlot?.showId) {
        await fetchOccupied(selectedTimeSlot.showId);
      }
    };

    window.addEventListener("PAYMENT_SUCCESS", onPaymentSuccess);
    return () =>
      window.removeEventListener("PAYMENT_SUCCESS", onPaymentSuccess);
  }, [selectedTimeSlot]);

  /* restore selected timeslot & seats */
  useEffect(() => {
    if (!rawSlotsForDate.length) return;
    let initial = null;
    if (queryShowId) {
      initial = rawSlotsForDate.find((s) => String(s.showId || s._id || s.id) === String(queryShowId));
    }
    if (!initial && queryTime) {
      initial = rawSlotsForDate.find((s) => {
        const t = typeof s.time === "string" ? s.time : s.time ? new Date(s.time).toISOString() : "";
        return t && t.startsWith(queryTime);
      });
    }
    if (!initial) {
      try {
        const key = LS.LAST_SELECTED(id, date);
        const saved = localStorage.getItem(key);
        if (saved) initial = rawSlotsForDate.find((s) => String(s.showId || s._id || s.id) === String(saved));
      } catch (e) { }
    }
    if (!initial) {
      const now = Date.now();
      const future = rawSlotsForDate.map((s) => ({ s, ms: new Date(s.time).getTime() })).filter((x) => !Number.isNaN(x.ms) && x.ms >= now).sort((a, b) => a.ms - b.ms);
      if (future.length) initial = future[0].s;
    }
    setSelectedTimeSlot(initial || null);

    try {
      const saved = JSON.parse(localStorage.getItem(LS.SELECTED_SEATS(id, date)) || "[]");
      if (Array.isArray(saved)) setSelectedSeats(saved);
    } catch (e) { }
    // eslint-disable-next-line
  }, [rawSlotsForDate, queryShowId, queryTime]);

  useEffect(() => {
    if (!selectedTimeSlot) return;
    try {
      const key = LS.LAST_SELECTED(id, date);
      const idVal = selectedTimeSlot.showId || selectedTimeSlot._id || selectedTimeSlot.id;
      if (idVal) localStorage.setItem(key, String(idVal));
    } catch (e) { }
  }, [selectedTimeSlot, id, date]);

  /* ---------------- fetch occupied seats ---------------- */
  const fetchOccupied = async (showId) => {
    if (!showId) return;
    try {
      const { data } = await axios.get(`/api/booking/seats/${showId}`);
      if (data?.success) {
        const occupied = Array.isArray(data.occupiedSeats)
          ? data.occupiedSeats
          : [];

        const held = Array.isArray(data.heldSeats)
          ? data.heldSeats.map(h => h.seat)
          : [];

        // 🔥 MERGE BOTH
        // setServerOccupied([...new Set([...occupied, ...held])]);
        setServerOccupied(occupied);
        setServerHeldSeats(held);
      }
    } catch (err) {
      console.error("fetchOccupied error:", err);
    }
  };

  const readLocalTempHold = (movieId, date, showId) => {
    try {
      const key = `tempHold:${movieId}:${date}:${showId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed?.expiresAt) return null;

      if (parsed.expiresAt <= Date.now()) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  };


  useEffect(() => {
    setSelectedSeats([])
    setServerOccupied([])
    setCardHiddenLocal(false)

    if (!selectedTimeSlot?.showId) return

    const showId = selectedTimeSlot.showId
    fetchOccupied(showId)

    // 🔥 RESTORE SERVER HOLD FIRST
    axios.get(`/api/booking/seats/${showId}`).then(({ data }) => {
      if (data?.success && Array.isArray(data.heldSeats)) {
        const mine = data.heldSeats.find(
          h => String(h.user) === String(user?._id)
        )
        if (mine) {
          setTempHold({
            bookingId: mine.bookingId,
            showId,
            seats: data.heldSeats
              .filter(h => h.bookingId === mine.bookingId)
              .map(h => h.seat),
            expiresAt: new Date(mine.expiresAt).getTime()
          })
        }
      }
    })

  }, [selectedTimeSlot, user])


  /* SSE/polling for live updates */
  useEffect(() => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (e) { }
      sseRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (!selectedTimeSlot || !selectedTimeSlot.showId) return;
    const showId = selectedTimeSlot.showId;

    try {
      if (typeof window !== "undefined" && "EventSource" in window) {
        const url = `/api/booking/seats/stream?showId=${encodeURIComponent(showId)}`;
        const es = new EventSource(url);
        sseRef.current = es;
        es.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data);
            if (payload) {
              const occ = Array.isArray(payload.occupiedSeats)
                ? payload.occupiedSeats
                : [];

              const held = Array.isArray(payload.heldSeats)
                ? payload.heldSeats.map(h => h.seat)
                : [];

              setServerOccupied(occ);
              setServerHeldSeats(held);
            }
          } catch (e) {
            console.error("SSE parse", e);
          }
        };
        es.onerror = () => {
          try { es.close(); } catch (e) { }
          sseRef.current = null;
          pollRef.current = setInterval(() => fetchOccupied(showId), POLL_INTERVAL);
        };
        pollRef.current = setInterval(() => fetchOccupied(showId), POLL_INTERVAL);
      } else {
        pollRef.current = setInterval(() => fetchOccupied(showId), POLL_INTERVAL);
      }
    } catch (e) {
      console.warn("SSE setup failed, using polling", e);
      pollRef.current = setInterval(() => fetchOccupied(showId), POLL_INTERVAL);
    }

    return () => {
      if (sseRef.current) try { sseRef.current.close(); } catch (e) { }
      if (pollRef.current) clearInterval(pollRef.current);
      sseRef.current = null;
      pollRef.current = null;
    };
    // eslint-disable-next-line
  }, [selectedTimeSlot]);

  useEffect(() => {
    if (!selectedTimeSlot?.showId) return;

    const normDate =
      typeof date === "string" ? date.slice(0, 10) : date;

    const local = readLocalTempHold(
      id,
      normDate,
      selectedTimeSlot.showId
    );

    if (local) {
      setTempHold(local);          // 🔥 THIS WAS MISSING
      setCardHiddenLocal(false);
    }
  }, [selectedTimeSlot, id, date]);


  /* local hold countdown */
  useEffect(() => {
    if (!tempHold?.expiresAt) return;

    const tick = () => {
      const left = Math.max(0, tempHold.expiresAt - Date.now());
      setHoldTimeLeft(left);

      if (left <= 0) {
        setTempHold(null);
        fetchOccupied(tempHold.showId);
      }
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [tempHold]);

  const serverConfirmedOccupied = useMemo(() => {
    return Array.isArray(serverOccupied) ? serverOccupied : [];
  }, [serverOccupied]);

  /* seat click */
  const handleSeatClick = (seatId) => {
    if (!selectedTimeSlot) return toast("Please select a time first");
    if (serverConfirmedOccupied.includes(seatId))
      return toast("This seat is already booked");

    if (serverHeldSeats.includes(seatId))
      return toast("This seat is currently held");

    if (tempHold && tempHold.seats.includes(seatId)) return toast("This seat is currently held (pending payment)");
    setSelectedSeats((prev) => {
      const next = prev.includes(seatId) ? prev.filter((s) => s !== seatId) : [...prev, seatId];
      try { localStorage.setItem(LS.SELECTED_SEATS(id, date), JSON.stringify(next)); } catch (e) { }
      return next;
    });
  };

  /* ---------- action overlay helpers ---------- */
  const startAction = (message) => setActionLoading({ active: true, message });
  const stopAction = () => setActionLoading({ active: false, message: "" });

  /* ---------- create a client-side booking object and navigate to review ---------- */
  const bookTickets = async () => {
    try {
      if (!selectedTimeSlot) {
        toast.error("Please select a time and seats");
        return;
      }
      if (!selectedSeats.length) {
        toast.error("Please select seats");
        return;
      }

      const resolvedShowId =
        selectedTimeSlot.showId ||
        selectedTimeSlot._id ||
        selectedTimeSlot.id;

      /* =========================
         🔥 STEP 1: CREATE BOOKING ON SERVER
         ========================= */
      const token = await getToken();

      const { data } = await axios.post(
        "/api/booking/create",
        {
          showId: resolvedShowId,
          selectedSeats,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!data?.success || !data?.bookingId) {
        toast.error("Failed to create booking");
        return;
      }

      /* =========================
         🔥 STEP 2: BUILD BOOKING OBJECT (NOW WITH REAL bookingId)
         ========================= */
      const bookingObj = {
        bookingId: data.bookingId, // ✅ REAL bookingId
        showId: resolvedShowId,

        movie: showData?.movie || {},
        movieId: id,
        date: date,

        show: {
          showId: resolvedShowId,
          theaterName:
            selectedTimeSlot.theaterName ||
            selectedTimeSlot.theater?.name ||
            "",
          showTime: selectedTimeSlot.time,
          experience:
            selectedTimeSlot.experience ||
            selectedTimeSlot.screenType ||
            "",
        },

        seats: [...selectedSeats],
        amount: data.amount ?? selectedSeats.reduce(
          (acc, s) => acc + (getSeatPrice(s) || 0),
          0
        ),
        expiresAt: new Date(data.expiresAt).getTime(),
        paymentLink: data.paymentLink,
      };

      /* =========================
         🔥 STEP 3: KEEP YOUR LOCAL TEMP HOLD (UNCHANGED LOGIC)
         ========================= */
      try {
        const showId = bookingObj.show.showId || "unknown-show";
        const normDate =
          typeof bookingObj.date === "string"
            ? bookingObj.date.slice(0, 10)
            : new Date().toISOString().slice(0, 10);

        const hk = LS.TEMP_HOLD(
          bookingObj.movieId || "unknown-movie",
          normDate,
          showId
        );

        const poster = showData?.movie?.poster_path
          ? image_base_url + showData.movie.poster_path
          : showData?.movie?.poster || null;

        const holdToSave = {
          bookingId: bookingObj.bookingId,
          showId,
          movieId: bookingObj.movieId,
          movieTitle: bookingObj.movie?.title,
          poster,
          theaterName:
            bookingObj.show?.theaterName ||
            selectedTimeSlot?.theaterName ||
            selectedTimeSlot?.theater?.name ||
            "",
          showTime: bookingObj.show?.showTime,
          seats: bookingObj.seats,
          amount: bookingObj.amount,
          expiresAt: bookingObj.expiresAt,
          paymentLink: bookingObj.paymentLink,
        };


        localStorage.setItem(hk, JSON.stringify(holdToSave));
        window.dispatchEvent(new Event("tempHoldChanged"));

        setTempHold(holdToSave);
        setCardHiddenLocal(false);
      } catch (e) {
        console.warn("Could not save local temp hold", e);
      }

      /* =========================
         🔥 STEP 4: NAVIGATE TO REVIEW PAGE
         ========================= */
      navigate("/review-booking", {
        state: {
          booking: bookingObj,
          source: "seat-layout",
        },
      });

    } catch (err) {
      console.error("bookTickets error:", err);
      toast.error("Could not open review page");
    }
  };

  /* ---------- hide card (X) - DO NOT release seats ---------- */
  const hideCardLocally = () => {
    setCardHiddenLocal(true);
  };

  /* ---------- release hold (server + local) ---------- */
  const releaseTempHold = async (p) => {
    if (!p) return;

    try {
      // server release (if exists)
      if (p.bookingId) {
        const token = await getToken();
        await axios.post(
          "/api/booking/release",
          { bookingId: p.bookingId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (err) {
      console.error("releaseTempHold error:", err);
    } finally {
      try {
        const normDate = date.slice(0, 10);
        const hk = `tempHold:${id}:${normDate}:${p.showId}`;
        localStorage.removeItem(hk);

        // 🔥 VERY IMPORTANT
        window.dispatchEvent(
          new CustomEvent("TEMP_HOLD_RELEASED", {
            detail: { showId: p.showId }
          })
        );
        window.dispatchEvent(new Event("BOOKING_RELEASED"));
      } catch (e) { }

      setTempHold(null);
      setCardHiddenLocal(false);
      toast.success("Seats released");
    }
  };

  /* ---------- layout helpers ---------- */
  const basePrice = selectedTimeSlot?.showPrice ?? selectedTimeSlot?.price ?? 0;
  const layout = useMemo(() => getExperienceLayout(selectedTimeSlot?.experience || selectedTimeSlot?.screenType || "Laser", basePrice), [selectedTimeSlot, basePrice]);
  const rowToSection = useMemo(() => { const map = {}; (layout.sections || []).forEach((sec) => sec.rows.forEach((r) => (map[r] = sec))); return map; }, [layout]);

  const getSeatPrice = (seatId) => {
    if (!seatId) return 0;
    const row = seatId[0];
    const sec = rowToSection[row];
    return sec ? Number(sec.price || 0) : Number(basePrice || 0);
  };

  const selectedBreakdown = useMemo(() => {
    const items = selectedSeats.map((s) => ({ seat: s, price: getSeatPrice(s) }));
    const total = items.reduce((acc, cur) => acc + (Number(cur.price) || 0), 0);
    return { items, total };
  }, [selectedSeats, rowToSection]);

  const renderRow = (rowLabel) => {
    const seats = [];
    const seatsPerRow = layout.seatsPerRow || 12;
    const center = Math.ceil(seatsPerRow / 2);

    for (let i = 1; i <= seatsPerRow; i++) {
      const seatId = `${rowLabel}${i}`;
      const serverOcc = serverConfirmedOccupied.includes(seatId);
      const localHeld =
        (tempHold && tempHold.seats.includes(seatId)) ||
        serverHeldSeats.includes(seatId);
      const selected = selectedSeats.includes(seatId);
      const sec = rowToSection[rowLabel];
      const secLabel = sec ? sec.label : "ZONE";
      const secPrice = sec ? sec.price : basePrice;
      const tooltipText = `${secLabel} • ${currency} ${secPrice} • ${seatId}`;

      seats.push(
        <div key={seatId} className="relative group">
          <button
            onClick={() => handleSeatClick(seatId)}
            aria-label={tooltipText}
            className={`h-9 w-9 rounded border text-xs flex items-center justify-center transition-transform
              ${serverOcc ? "bg-white/6 text-gray-400 pointer-events-none cursor-not-allowed" : ""}
              ${localHeld ? "bg-transparent pointer-events-none" : ""}
              ${selected ? "bg-teal-500 text-white border-teal-500 scale-105" : ""}
              ${!serverOcc && !localHeld && !selected ? "bg-black/40 text-gray-100 hover:scale-110 cursor-pointer border-white/10" : ""}
            `}
          >
            {serverOcc ? "X" : localHeld ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="#E36B17" />
                <path d="M12 7V12L15 14" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : seatId}
          </button>

          <div aria-hidden className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-9 h-1 rounded ${sec ? sec.colorClass : "bg-sky-600"} opacity-30`} />

          <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/90 text-white text-[11px] whitespace-nowrap opacity-0 pointer-events-none transition-opacity group-hover:opacity-100">
            {tooltipText}
            {tempHold?.seats.includes(seatId) && holdTimeLeft != null && (
              <div className="text-[10px] text-orange-300 mt-0.5">
                {formatMs(holdTimeLeft)}
              </div>
            )}
          </div>
        </div>
      );

      if (i === center) seats.push(<div key={`${rowLabel}-aisle-${i}`} className="w-3" />);
    }

    return <div key={rowLabel} className="flex justify-center items-center gap-2 mt-2">{seats}</div>;
  };

  if (!showData) return <Loading />;

  const movie = showData.movie || {};
  const posterUrl = movie.poster_path ? image_base_url + movie.poster_path : null;
  const theaterNameToShow = selectedTimeSlot?.theaterName || selectedTimeSlot?.theater?.name || (groupedByTheater[0]?.theaterName || "");

  return (
    <div className="flex flex-col md:flex-row px-6 md:px-16 lg:px-40 py-30 md:pt-50">
      {/* LEFT timings */}
      <div className="w-60 bg-gradient-to-b from-slate-900/40 to-slate-900/20 border border-white/6 rounded-lg py-6 h-max md:sticky md:top-30">
        <p className="text-lg font-semibold px-4">Timings — {theaterNameToShow || "Select a timing"}</p>
        <div className="mt-4 divide-y divide-white/5">
          {(() => {
            const raw = rawSlotsForDate || [];
            const now = Date.now();

            if (!selectedTimeSlot) {
              // Group upcoming slots by theater and show the earliest upcoming per theater
              const per = new Map();
              raw.forEach((s) => {
                const tid = s.theaterId || (s.theater && s.theater._id) || null;
                if (!tid) return;
                const ms = new Date(s.time).getTime();
                if (isNaN(ms) || ms < now) return; // <-- only future
                if (!per.has(tid)) per.set(tid, []);
                per.get(tid).push(s);
              });

              if (!per.size) {
                return <div className="p-4 text-sm text-gray-400">No upcoming timings for this theater on selected date.</div>;
              }

              // show first theater group that has upcoming times (keeps original behavior)
              const entries = Array.from(per.values());
              return (
                <div className="p-3 space-y-2">
                  {entries.flat().sort((a, b) => new Date(a.time) - new Date(b.time)).map((slot) => (
                    <div key={slot.showId || slot._id || slot.time} onClick={() => setSelectedTimeSlot(slot)} className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-teal-600/10">
                      <ClockIcon className="w-4 h-4" />
                      <div className="text-sm">
                        <div className="font-semibold">{isoTimeFormat(slot.time)}</div>
                        <div className="text-xs text-gray-300">{slot.experience || slot.screenType || "Laser"} • {slot.format || "2D"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            } else {
              // When a theater is selected, show only that theater's future slots
              const arr = raw
                .filter((s) => {
                  const tid = s.theaterId || (s.theater && s.theater._id) || null;
                  if (!tid) return false;
                  if (String(tid) !== String(selectedTimeSlot.theaterId || selectedTimeSlot.theater?._id)) return false;
                  const ms = new Date(s.time).getTime();
                  return !isNaN(ms) && ms >= now; // <-- only future
                })
                .sort((a, b) => new Date(a.time) - new Date(b.time));

              if (!arr.length) return <div className="p-4 text-sm text-gray-400">No upcoming timings for this theater on selected date.</div>;

              return (
                <div className="p-3 space-y-2">
                  {arr.map((slot) => (
                    <div key={slot.showId || slot._id || slot.time} onClick={() => setSelectedTimeSlot(slot)} className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition ${String(slot.showId || slot._id) === String(selectedTimeSlot.showId || selectedTimeSlot._id) ? "bg-teal-600 text-white" : "hover:bg-teal-600/10"}`}>
                      <ClockIcon className="w-4 h-4" />
                      <div className="text-sm">
                        <div className="font-semibold">{isoTimeFormat(slot.time)}</div>
                        <div className="text-xs text-gray-300">{slot.experience || slot.screenType || "Laser"} • {slot.format || "2D"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
          })()}
        </div>
      </div>

      {/* RIGHT seats */}
      <div className="relative flex-1 flex flex-col items-center max-md:mt-16">
        <BlurCircle top="-100px" left="-100px" />
        <BlurCircle bottom="0" right="0" />

        {/* header sticky */}
        <div className="w-full max-w-4xl mb-2 rounded-lg border border-white/10 bg-gradient-to-br from-black/80 to-slate-900/80 p-4 sticky top-6 z-20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              {posterUrl ? (
                <img src={posterUrl} alt={movie.title} className="w-20 h-28 object-cover rounded" />
              ) : (
                <div className="w-20 h-28 bg-white/5 rounded flex items-center justify-center text-xs text-gray-400">No poster</div>
              )}
              <div>
                <h2 className="text-xl font-semibold">{movie.title}</h2>
                <p className="text-sm text-gray-400 mt-1">{theaterNameToShow || "Theater not selected"}</p>
                <p className="text-xs text-gray-500 mt-1">{date}{selectedTimeSlot && <> • {selectedTimeSlot.experience?.toUpperCase()}</>}</p>
              </div>
            </div>

            <div className="flex flex-col items-end">
              {selectedTimeSlot ? (
                <>
                  <div className="text-lg font-semibold">{isoTimeFormat(selectedTimeSlot.time)}</div>
                  <div className="text-sm text-gray-400 mt-1">{selectedTimeSlot.experience || "Laser"} • {selectedTimeSlot.format || "2D"}</div>
                  {basePrice > 0 && <div className="text-xs text-gray-400 mt-1">Base ticket: {currency} {basePrice}</div>}
                </>
              ) : <div className="text-sm text-gray-400">Select a timing</div>}
            </div>
          </div>
        </div>

        {/* legend */}
        <div className="w-full max-w-4xl mx-auto mb-4 flex justify-center">
          <div className="flex items-center gap-3">
            {layout.sections.map((sec) => (
              <div key={sec.key} className="flex items-center gap-3 bg-black/50 px-3 py-2 rounded-md border border-white/10">
                <div className={`w-5 h-5 rounded ${sec.colorClass}`} />
                <div className="text-sm">
                  <div className="font-medium">{sec.label}</div>
                  <div className="text-xs text-gray-400">{currency} {sec.price}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-black/50 border border-white/10">
              <div className="w-4 h-4 bg-white/6 rounded flex items-center justify-center text-xs text-gray-300">X</div>
              <div className="text-xs text-gray-300">Occupied</div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-black/50 border border-white/10">
              <div className="w-4 h-4 bg-orange-600 rounded flex items-center justify-center text-xs text-white">⏳</div>
              <div className="text-xs text-gray-300">Held</div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-black/50 border border-white/10">
              <div className="w-4 h-4 bg-teal-500 rounded" />
              <div className="text-xs text-gray-300">Selected</div>
            </div>
          </div>
        </div>

        {/* screen */}
        <div className="flex flex-col items-center w-full max-w-4xl mb-4">
          <img src={assets.screenImage} alt="screen" className="max-w-full" />
          <p className="text-gray-400 text-sm mt-2">SCREEN SIDE</p>
        </div>

        {/* seat layout */}
        <div className="w-full max-w-4xl space-y-8">
          {layout.sections.map((sec) => (
            <div key={sec.key} className="flex flex-col items-center">
              <div className="mb-2 text-center"><div className="text-sm font-semibold">{sec.label}: {currency} {sec.price}</div></div>
              <div className="flex flex-col items-center">{sec.rows.map((r) => <React.Fragment key={r}>{renderRow(r)}</React.Fragment>)}</div>
            </div>
          ))}
        </div>

        {/* mobile summary */}
        <div className="mt-8 block md:hidden w-full max-w-4xl">
          <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-lg px-4 py-3">
            <div>
              <div className="text-xs text-gray-400">Selected</div>
              <div className="font-medium">{selectedSeats.join(", ") || (tempHold ? tempHold.seats.join(", ") : "None")}</div>
              <div className="text-xs text-gray-400">{selectedBreakdown.items.length} seat(s)</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{currency} {selectedBreakdown.total}</div>
              <button onClick={() => bookTickets()} disabled={!selectedSeats.length} className={`mt-2 px-4 py-2 rounded-full text-white ${selectedSeats.length ? "bg-teal-600 hover:bg-teal-500 cursor-pointer" : "bg-white/10 cursor-not-allowed"}`}>Proceed</button>
            </div>
          </div>
        </div>

        {/* desktop sticky selection summary */}
        <div className={`hidden md:block fixed right-8 bottom-8 w-80 bg-black/95 border border-white/10 rounded-lg p-4 shadow-lg z-50 transform transition-all duration-350 ${selectedSeats.length ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"}`} aria-hidden={!selectedSeats.length}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs text-gray-400">Your selection</div>
              <div className="font-medium">{selectedSeats.length} seat(s)</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{currency} {selectedBreakdown.total}</div>
              <div className="text-xs text-gray-400">incl. zone pricing</div>
            </div>
          </div>

          <div className="max-h-32 overflow-y-auto mb-3">
            {selectedBreakdown.items.length === 0 ? <div className="text-xs text-gray-400">No seats selected</div> : selectedBreakdown.items.map((it) => (
              <div key={it.seat} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                <div className="font-medium">{it.seat}</div>
                <div className="text-gray-300">{currency} {it.price}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 justify-between">
            <button onClick={() => { setSelectedSeats([]); try { localStorage.removeItem(LS.SELECTED_SEATS(id, date)); } catch (e) { } }} className="px-3 py-1 rounded-md border border-white/10 text-xs hover:bg-white/5 cursor-pointer">Clear</button>

            <button onClick={() => { if (!selectedSeats.length) { toast.error("Select seats first"); return; } bookTickets(); }} disabled={!selectedSeats.length} className={`px-4 py-2 rounded-full text-white text-sm ${selectedSeats.length ? "bg-teal-600 hover:bg-teal-500 cursor-pointer" : "bg-white/10 cursor-not-allowed"}`}>
              Proceed to Checkout
              <ArrowRightIcon className="w-4 h-4 inline-block ml-2" />
            </button>
          </div>
        </div>

        {/* Local Hold card (bigger width) */}
        {tempHold && !cardHiddenLocal && selectedTimeSlot && (
          <div className="fixed left-8 bottom-8 z-50">
            <div className="group relative" style={{ width: 420 }}>
              <div
                className="bg-black/95 border border-white/10 rounded-lg p-4 shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-gray-400">Pending booking</div>
                    <div className="font-medium">{showData?.movie?.title || "Movie"}</div>
                    <div className="text-xs text-gray-300">{selectedTimeSlot.theaterName || selectedTimeSlot.theater?.name || ""} • {isoTimeFormat(selectedTimeSlot.time)}</div>
                    <div className="text-sm text-orange-300 mt-2">Hold expires in {formatMs(Math.max(0, tempHold.expiresAt - Date.now()))}</div>
                    <div className="text-xs text-gray-300 mt-1">Seats: <span className="font-medium">{(tempHold.seats || []).join(", ")}</span></div>
                  </div>
                </div>
              </div>

              {/* small circular X - hidden until card hover */}
              <button
                onClick={(e) => { e.stopPropagation(); hideCardLocally(); }}
                className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Hide"
                aria-label="Hide hold card"
                style={{ width: 34, height: 34, borderRadius: 999 }}
              >
                <div className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-xs text-white hover:bg-white/10">
                  ✕
                </div>
              </button>
            </div>

            {/* actions below card */}
            <div className="mt-2 flex gap-2">
              {/* PAY NOW */}
              {tempHold?.paymentLink && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = tempHold.paymentLink;
                  }}
                  className="px-4 py-1 rounded-md bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold cursor-pointer"
                >
                  Pay Now
                </button>
              )}

              {/* RELEASE */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  releaseTempHold(tempHold);
                }}
                className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm cursor-pointer"
              >
                Release
              </button>
            </div>
          </div>
        )}

        {/* action-loading overlay */}
        {actionLoading.active && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center">
            <div className="absolute inset-0 backdrop-blur-sm bg-black/40" />
            <div className="relative bg-black/95 border border-white/10 rounded-lg p-6 max-w-lg w-full mx-4 shadow-lg text-center">
              <div className="mb-3 text-white text-lg font-semibold">Please wait</div>
              <div className="text-sm text-gray-300 mb-4">{actionLoading.message}</div>
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.12)" strokeWidth="4"></circle>
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="white" strokeWidth="4" strokeLinecap="round"></path>
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeatLayout;