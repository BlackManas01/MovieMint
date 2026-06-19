// pages/SeatLayout.jsx - Interactive seat selection page with real-time availability via SSE
import React, { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowRightIcon, ArrowLeftIcon, ClockIcon } from "lucide-react";
import { useClerk } from "@clerk/clerk-react";
import isoTimeFormat from "../lib/isoTimeFormat";
import { formatScreen, seatPressure } from "../lib/screenLabel";
import BlurCircle from "../components/BlurCircle";
import ErrorBoundary from "../components/ErrorBoundary";
import FoodAddon from "../components/FoodAddon";
import HScroller from "../components/HScroller";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";

// 3D "view from seat" preview is lazy-loaded so three.js only downloads when opened.
const SeatViewPreview = React.lazy(() => import("../components/SeatViewPreview"));

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
    executive: "bg-[#8D8278]",
    club: "bg-[#C49A6C]",
    royale: "bg-[#CDA0A0]",
    insignia: "bg-[#D4A290]",
    prime: "bg-[#E3C078]",
  };

  const laser = {
    seatsPerRow: 12,
    sections: [
      { key: "executive", label: "EXECUTIVE", price: bp + 0, rows: sliceRows(0, 2), colorClass: colors.executive },
      { key: "club", label: "CLUB", price: bp + 50, rows: sliceRows(2, 8), colorClass: colors.club },
      { key: "royale", label: "ROYALE", price: bp + 100, rows: sliceRows(10, 2), colorClass: colors.royale },
    ],
  };

  if (!experience) return laser;
  const exp = experience.toLowerCase();

  if (exp.includes("imax")) {
    return {
      seatsPerRow: 12,
      sections: [
        { key: "executive", label: "EXECUTIVE", price: bp + 0, rows: sliceRows(0, 2), colorClass: colors.executive },
        { key: "club", label: "CLUB", price: bp + 50, rows: sliceRows(2, 6), colorClass: colors.club },
        { key: "royale", label: "ROYALE", price: bp + 100, rows: sliceRows(8, 4), colorClass: colors.royale },
      ],
    };
  }

  if (exp.includes("dolby")) {
    return {
      seatsPerRow: 12,
      sections: [
        { key: "executive", label: "EXECUTIVE", price: bp + 0, rows: sliceRows(0, 2), colorClass: colors.executive },
        { key: "club", label: "CLUB", price: bp + 50, rows: sliceRows(2, 6), colorClass: colors.club },
        { key: "royale", label: "ROYALE", price: bp + 100, rows: sliceRows(8, 4), colorClass: colors.royale },
      ],
    };
  }

  if (exp.includes("insignia")) {
    return {
      seatsPerRow: 10,
      sections: [{ key: "insignia", label: "INSIGNIA", price: bp + 120, rows: sliceRows(0, 6), colorClass: colors.insignia }],
    };
  }

  if (exp.includes("4dx") || exp.includes("4dx-3d")) {
    return {
      seatsPerRow: 10,
      sections: [{ key: "prime", label: "PRIME", price: bp + 150, rows: sliceRows(0, 6), colorClass: colors.prime }],
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
  const { axios, getToken, user, image_base_url, city, bookedSeatsByShow } = useAppContext();
  const { openSignIn } = useClerk();
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  // stable hooks
  const [showData, setShowData] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  const [serverOccupied, setServerOccupied] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [previewSeat, setPreviewSeat] = useState(null);
  const [tempHold, setTempHold] = useState(null);
  const [serverHeldSeats, setServerHeldSeats] = useState([]);
  const [holdTimeLeft, setHoldTimeLeft] = useState(null);
  const [navLoading, setNavLoading] = useState(false);

  const [cardHiddenLocal, setCardHiddenLocal] = useState(false); // hides the UI card only (no release)
  const [actionLoading, setActionLoading] = useState({ active: false, message: "" });
  const [foodSummary, setFoodSummary] = useState({ total: 0, count: 0 });

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
        // Held seats store the Clerk user id (user.id), not user._id
        const myId = user?.id ?? user?._id;
        const mine = data.heldSeats.find(
          h => String(h.user) === String(myId)
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

  // True while the user has an unpaid seat hold (must pay or release before booking more).
  const isHoldActive = () => {
    if (!tempHold || !(tempHold.seats?.length > 0)) return false;
    const exp = tempHold.expiresAt ? new Date(tempHold.expiresAt).getTime() : NaN;
    return Number.isNaN(exp) || exp > Date.now();
  };

  /* seat click */
  const handleSeatClick = (seatId) => {
    if (!selectedTimeSlot) return toast("Please select a time first");
    if (isHoldActive()) return toast.error("You already have seats on hold — pay or release them first");
    if (serverConfirmedOccupied.includes(seatId))
      return toast("This seat is already booked");

    if (serverHeldSeats.includes(seatId))
      return toast("This seat is currently held");

    if (syntheticOccupied.has(seatId) && !selectedSeats.includes(seatId))
      return toast("This seat is already booked");

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
    if (navLoading) return;
    if (isHoldActive()) {
      toast.error("You already have seats on hold — pay or release them first");
      return;
    }
    // Must be signed in to book — prompt sign-in instead of failing the API call.
    if (!user) {
      toast.error("Please log in to continue");
      openSignIn();
      return;
    }
    setNavLoading(true);
    try {
      if (!selectedTimeSlot) {
        toast.error("Please select a time and seats");
        setNavLoading(false);
        return;
      }
      if (!selectedSeats.length) {
        toast.error("Please select seats");
        setNavLoading(false);
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
          addonAmount: foodSummary.total || 0,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!data?.success || !data?.bookingId) {
        toast.error("Failed to create booking");
        setNavLoading(false);
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
        addonAmount: foodSummary.total || 0,
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
      setNavLoading(false);
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

  // ---- 3D "view from seat" geometry ----
  const allRowsFlat = useMemo(() => layout.sections.flatMap((s) => s.rows), [layout]);

  // Seats the signed-in user has already booked for THIS show (highlight as "yours").
  const myBookedSeats = useMemo(
    () => new Set(bookedSeatsByShow?.[String(selectedTimeSlot?.showId)] || []),
    [bookedSeatsByShow, selectedTimeSlot]
  );

  // Synthetic occupancy so the seat map visually matches the show's "fill" level
  // (Available / Filling fast / Almost full) shown on the showtime. Deterministic
  // per show, capped so a few seats always remain bookable.
  const syntheticOccupied = useMemo(() => {
    const showId = selectedTimeSlot?.showId;
    if (!showId) return new Set();
    const ratio = Math.min(0.9, seatPressure(showId));
    if (ratio <= 0.02) return new Set();
    const cols = layout.seatsPerRow || 12;
    const seatIds = [];
    allRowsFlat.forEach((r) => {
      for (let i = 1; i <= cols; i++) seatIds.push(`${r}${i}`);
    });
    const target = Math.floor(ratio * seatIds.length);
    if (target <= 0) return new Set();
    // Seeded shuffle from the show id (stable across renders).
    let h = 0;
    const s = String(showId);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    for (let i = seatIds.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [seatIds[i], seatIds[j]] = [seatIds[j], seatIds[i]];
    }
    return new Set(seatIds.slice(0, target));
  }, [selectedTimeSlot, layout, allRowsFlat]);

  const previewMeta = useMemo(() => {
    if (!previewSeat) return null;
    const letter = previewSeat.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
    const num = parseInt(previewSeat.replace(/^[A-Za-z]+/, ""), 10);
    const rowIndex = Math.max(0, allRowsFlat.indexOf(letter));
    const colIndex = Math.max(0, (Number.isFinite(num) ? num : 1) - 1);
    const rows = allRowsFlat.length || 8;
    const cols = layout.seatsPerRow || 12;
    const ratio = rows > 1 ? rowIndex / (rows - 1) : 0.5;
    let hint = "Balanced view — a solid pick.";
    if (ratio < 0.25) hint = "Very close to the screen — large & immersive, you'll look up a little.";
    else if (ratio > 0.75) hint = "Towards the back — the whole screen is in view, but smaller.";
    else if (ratio >= 0.4 && ratio <= 0.6) hint = "Sweet spot — best overall view in the house. 👌";
    // Per-row zone colours (extract hex from each section's colorClass).
    const rowColors = allRowsFlat.map((r) => {
      const sec = rowToSection[r];
      const m = sec?.colorClass?.match(/#([0-9A-Fa-f]{6})/);
      return m ? `#${m[1]}` : "#2a2336";
    });
    // The movie still shown on the screen.
    const mv = showData?.movie || {};
    const screenImage = mv.backdrop_path
      ? image_base_url + mv.backdrop_path
      : mv.poster_path
        ? image_base_url + mv.poster_path
        : null;
    // Per-seat status grid for the 3D view (occupied / selected / available).
    const seatStatus = allRowsFlat.map((label) =>
      Array.from({ length: cols }).map((_, ci) => {
        const sid = `${label}${ci + 1}`;
        if (selectedSeats.includes(sid)) return "selected";
        if (
          serverConfirmedOccupied.includes(sid) ||
          serverHeldSeats.includes(sid) ||
          syntheticOccupied.has(sid) ||
          (tempHold && tempHold.seats?.includes(sid))
        ) return "occupied";
        return "available";
      })
    );
    return { rowIndex, colIndex, rows, cols, hint, rowColors, screenImage, screenLabel: mv.title || "", seatStatus };
  }, [previewSeat, allRowsFlat, layout, rowToSection, showData, image_base_url, serverConfirmedOccupied, serverHeldSeats, syntheticOccupied, tempHold, selectedSeats]);

  // Click a seat inside the 3D view → instantly move the viewpoint there (and pick it).
  const pickSeatFrom3D = (r, c) => {
    const label = allRowsFlat[r];
    if (!label) return;
    const seatId = `${label}${c + 1}`;
    if (
      serverConfirmedOccupied.includes(seatId) ||
      serverHeldSeats.includes(seatId) ||
      (syntheticOccupied.has(seatId) && !selectedSeats.includes(seatId)) ||
      (tempHold && tempHold.seats?.includes(seatId))
    ) {
      toast("That seat isn't available");
      return;
    }
    setPreviewSeat(seatId);
    if (!selectedSeats.includes(seatId)) handleSeatClick(seatId);
  };

  const renderRow = (rowLabel) => {
    const seats = [];
    const seatsPerRow = layout.seatsPerRow || 12;
    const center = Math.ceil(seatsPerRow / 2);

    for (let i = 1; i <= seatsPerRow; i++) {
      const seatId = `${rowLabel}${i}`;
      const selected = selectedSeats.includes(seatId);
      const mine = myBookedSeats.has(seatId);
      const serverOcc = !selected && !mine && (serverConfirmedOccupied.includes(seatId) || syntheticOccupied.has(seatId));
      const localHeld =
        (tempHold && tempHold.seats.includes(seatId)) ||
        serverHeldSeats.includes(seatId);
      const sec = rowToSection[rowLabel];
      const secLabel = sec ? sec.label : "ZONE";
      const secPrice = sec ? sec.price : basePrice;
      const tooltipText = mine
        ? `Your booked seat • ${seatId}`
        : `${secLabel} • ${currency} ${secPrice} • ${seatId}`;

      seats.push(
        <div key={seatId} className="relative group">
          <button
            onClick={() => handleSeatClick(seatId)}
            aria-label={tooltipText}
            className={`relative h-9 w-9 rounded-t-[11px] rounded-b-md border text-[11px] font-medium flex items-center justify-center transition-all duration-200 will-change-transform
              ${mine ? "bg-gradient-to-b from-cyan-400 to-cyan-600 text-black border-cyan-300 pointer-events-none shadow-[0_8px_22px_-6px_rgba(34,211,238,0.85)]" : ""}
              ${serverOcc ? "bg-neutral-600/60 text-gray-400 border-white/10 pointer-events-none cursor-not-allowed" : ""}
              ${localHeld ? "bg-transparent border-transparent pointer-events-none" : ""}
              ${selected ? "bg-gradient-to-b from-primary to-primary-dull text-black border-primary -translate-y-0.5 scale-105 shadow-[0_8px_22px_-6px_rgba(168,85,247,0.95)]" : ""}
              ${!serverOcc && !localHeld && !selected && !mine ? "bg-gradient-to-b from-white/15 to-white/[0.03] text-gray-200 border-white/15 cursor-pointer hover:-translate-y-0.5 hover:scale-110 hover:border-primary/60 hover:from-primary/25 hover:to-primary/5 hover:shadow-[0_8px_20px_-8px_rgba(168,85,247,0.85)]" : ""}
            `}
          >
            {mine ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : serverOcc ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            ) : localHeld ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="#E36B17" />
                <path d="M12 7V12L15 14" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : seatId}
          </button>

          <div aria-hidden className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-9 h-1 rounded ${sec ? sec.colorClass : "bg-primary"} opacity-30`} />

          {/* Hover eye → preview the view from this seat (only for seats you can actually pick) */}
          {!serverOcc && !localHeld && !mine && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreviewSeat(seatId); }}
              aria-label={`Preview view from ${seatId}`}
              title="Preview view from this seat"
              className="absolute -top-2 -right-2 z-20 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-black/85 border border-primary/50 text-primary cursor-pointer hover:bg-primary hover:text-black transition"
            >
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          )}

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

  if (!showData) {
    return (
      <div className="flex flex-col items-center px-6 md:px-16 lg:px-32 py-30 md:pt-44 animate-pulse">
        {/* banner */}
        <div className="w-full max-w-4xl mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-4">
            <div className="w-20 h-28 rounded-xl bg-white/10" />
            <div className="space-y-2">
              <div className="h-6 w-48 rounded bg-white/10" />
              <div className="h-3 w-32 rounded bg-white/5" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
          </div>
        </div>
        {/* timings */}
        <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-10">
          <div className="h-3 w-40 rounded bg-white/10 mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 w-24 shrink-0 rounded-xl bg-white/10" />
            ))}
          </div>
        </div>
        {/* screen */}
        <div className="w-[70%] max-w-2xl h-2 rounded-full bg-white/10 mb-2" />
        <div className="h-3 w-20 rounded bg-white/5 mb-10" />
        {/* seat grid */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, r) => (
            <div key={r} className="flex justify-center gap-2">
              {Array.from({ length: 12 }).map((_, c) => (
                <div key={c} className="w-7 h-7 rounded-md bg-white/10" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const movie = showData.movie || {};
  const posterUrl = movie.poster_path ? image_base_url + movie.poster_path : null;
  const theaterNameToShow = selectedTimeSlot?.theaterName || selectedTimeSlot?.theater?.name || (groupedByTheater[0]?.theaterName || "");

  return (
    <div className="flex flex-col items-center px-6 md:px-16 lg:px-32 py-30 md:pt-44">
      {/* Back button */}
      <div className="w-full max-w-4xl mb-3">
        <button
          onClick={() => navigate(`/movies/${id}`)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 hover:text-white transition cursor-pointer"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Movie banner */}
      <div className="w-full max-w-4xl mb-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 shadow-[0_20px_60px_-35px_rgba(168,85,247,0.5)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {posterUrl ? (
              <img src={posterUrl} alt={movie.title} className="w-20 h-28 object-cover rounded-xl ring-1 ring-white/15" />
            ) : (
              <div className="w-20 h-28 bg-white/5 rounded-xl flex items-center justify-center text-xs text-gray-400">No poster</div>
            )}
            <div>
              <h2 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-white to-primary/70 bg-clip-text text-transparent w-max">{movie.title}</h2>
              <p className="text-sm text-gray-300 mt-1">{theaterNameToShow || "Theater not selected"}</p>
              <p className="text-xs text-gray-500 mt-0.5">{date}{selectedTimeSlot && <> • {formatScreen(selectedTimeSlot.experience, selectedTimeSlot.format)}</>}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {selectedTimeSlot ? (
              <>
                <div className="text-lg font-semibold text-primary">{isoTimeFormat(selectedTimeSlot.time)}</div>
                <div className="text-sm text-gray-400 mt-1">{formatScreen(selectedTimeSlot.experience, selectedTimeSlot.format)} • {selectedTimeSlot.language || "English"}</div>
                {basePrice > 0 && <div className="text-xs text-gray-500 mt-1">Base: {currency} {basePrice}</div>}
              </>
            ) : <div className="text-sm text-gray-400">Select a timing</div>}
          </div>
        </div>
      </div>

      {/* timings bar */}
      <div className="w-full max-w-4xl bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 shadow-[0_20px_60px_-35px_rgba(168,85,247,0.5)]">
        <p className="text-[11px] uppercase tracking-[0.24em] text-gray-400 mb-3 flex items-center gap-2"><ClockIcon className="w-3.5 h-3.5 text-primary" /> Showtimes — {theaterNameToShow || "Select a timing"}</p>
        <div className="">
          {(() => {
            const raw = (rawSlotsForDate || []).filter(
              (s) => !city || !s.theaterCity || s.theaterCity === city
            );
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
                <HScroller contentClassName="pb-1">
                  <div className="flex gap-3 w-max px-1">
                  {entries.flat().sort((a, b) => new Date(a.time) - new Date(b.time)).map((slot) => (
                    <button key={slot.showId || slot._id || slot.time} onClick={() => setSelectedTimeSlot(slot)} className="shrink-0 flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-xl border border-white/12 bg-white/5 hover:border-primary/50 hover:bg-primary/10 transition cursor-pointer">
                      <span className="text-sm font-semibold">{isoTimeFormat(slot.time)}</span>
                      <span className="text-[10px] text-gray-400">{formatScreen(slot.experience || slot.screenType, slot.format)} • {slot.language || "English"}</span>
                    </button>
                  ))}
                  </div>
                </HScroller>
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
                <HScroller contentClassName="pb-1">
                  <div className="flex gap-3 w-max px-1">
                  {arr.map((slot) => {
                    const active = String(slot.showId || slot._id) === String(selectedTimeSlot.showId || selectedTimeSlot._id);
                    return (
                    <button key={slot.showId || slot._id || slot.time} onClick={() => setSelectedTimeSlot(slot)} className={`shrink-0 flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-xl border transition cursor-pointer ${active ? "bg-gradient-to-b from-primary to-primary-dull text-black border-primary shadow-[0_10px_25px_-10px_rgba(168,85,247,0.9)]" : "border-white/12 bg-white/5 hover:border-primary/50 hover:bg-primary/10"}`}>
                      <span className="text-sm font-semibold">{isoTimeFormat(slot.time)}</span>
                      <span className={`text-[10px] ${active ? "text-black/70" : "text-gray-400"}`}>{formatScreen(slot.experience || slot.screenType, slot.format)} • {slot.language || "English"}</span>
                    </button>
                    );
                  })}
                  </div>
                </HScroller>
              );
            }
          })()}
        </div>
      </div>

      {/* RIGHT seats */}
      <div className="relative w-full flex flex-col items-center mt-8">
        <BlurCircle top="-100px" left="-100px" />
        <BlurCircle bottom="0" right="0" />

        {/* legend */}
        <div className="w-full max-w-4xl mx-auto mb-5 flex justify-center px-2">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-5 py-3 shadow-[0_18px_50px_-30px_rgba(168,85,247,0.6)]">
            {/* Zones (price tiers) */}
            {layout.sections.map((sec) => (
              <div key={sec.key} className="flex items-center gap-2">
                <span className={`h-5 w-5 rounded-t-[7px] rounded-b-[3px] ${sec.colorClass} shadow-inner shadow-black/40`} />
                <div className="leading-tight">
                  <div className="text-[11px] font-semibold tracking-wide text-gray-200">{sec.label}</div>
                  <div className="text-[10px] text-gray-400">{currency}{sec.price}</div>
                </div>
              </div>
            ))}

            <span className="hidden sm:block h-8 w-px bg-white/10" />

            {/* Seat states */}
            <div className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-t-[6px] rounded-b-[2px] bg-gradient-to-b from-white/15 to-white/[0.03] border border-white/15" />
              <span className="text-[11px] text-gray-300">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-t-[6px] rounded-b-[2px] bg-neutral-600/60 border border-white/10 flex items-center justify-center">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" /></svg>
              </span>
              <span className="text-[11px] text-gray-400">Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-t-[6px] rounded-b-[2px] bg-orange-500/80 border border-orange-400/40" />
              <span className="text-[11px] text-gray-300">Held</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-t-[6px] rounded-b-[2px] bg-gradient-to-b from-primary to-primary-dull border border-primary" />
              <span className="text-[11px] text-gray-300">Selected</span>
            </div>
            {myBookedSeats.size > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-t-[6px] rounded-b-[2px] bg-gradient-to-b from-cyan-400 to-cyan-600 border border-cyan-300 flex items-center justify-center">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#06212a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span className="text-[11px] text-cyan-300">Your seat</span>
              </div>
            )}
          </div>
        </div>

        {/* screen */}
        <div className="flex flex-col items-center w-full max-w-3xl mb-12 mt-2">
          <div className="w-full h-12 rounded-[100%] bg-gradient-to-b from-primary/40 to-transparent blur-[3px]" />
          <div className="w-[85%] h-[3px] -mt-6 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_45px_6px_rgba(168,85,247,0.55)]" />
          <p className="text-gray-400 text-xs tracking-[0.5em] mt-5 pl-2">S C R E E N</p>
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

        {/* Food & beverages add-on */}
        <FoodAddon
          currency={currency}
          disabled={!selectedSeats.length}
          onTotalChange={setFoodSummary}
        />

        {/* mobile summary */}
        {/* (replaced by sticky bottom checkout bar) */}

        {/* sticky bottom checkout bar */}
        <div className={`fixed bottom-0 left-0 w-full z-40 transition-all duration-300 ${selectedSeats.length && !isHoldActive() ? "translate-y-0" : "translate-y-full pointer-events-none"}`} aria-hidden={!selectedSeats.length || isHoldActive()}>
          <div className="mx-auto max-w-5xl m-4 rounded-2xl border border-primary/25 bg-black/80 backdrop-blur-xl shadow-[0_-10px_60px_-20px_rgba(168,85,247,0.6)] px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Selected Seats</div>
              <div className="font-medium text-sm truncate text-primary">{selectedSeats.join(", ") || "None"}</div>
              <div className="text-[11px] text-gray-500">{selectedBreakdown.items.length} seat(s) • incl. zone pricing</div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-[11px] text-gray-400">Total</div>
                <div className="text-xl font-semibold">{currency} {selectedBreakdown.total + foodSummary.total}</div>
                {foodSummary.total > 0 && (
                  <div className="text-[10px] text-gray-500">
                    Tickets {currency}{selectedBreakdown.total} + Snacks {currency}{foodSummary.total}
                  </div>
                )}
                <div className="text-[10px] text-gray-500">Incl. of GST &amp; fees</div>
              </div>
              <button onClick={() => setPreviewSeat(selectedSeats[selectedSeats.length - 1])} className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-primary/30 text-primary text-xs hover:bg-primary/10 cursor-pointer">👁 View from seat</button>
              <button onClick={() => { setSelectedSeats([]); try { localStorage.removeItem(LS.SELECTED_SEATS(id, date)); } catch (e) { } }} className="px-3 py-2 rounded-xl border border-white/15 text-xs hover:bg-white/5 cursor-pointer">Clear</button>
              <button onClick={() => { if (!selectedSeats.length) { toast.error("Select seats first"); return; } bookTickets(); }} disabled={!selectedSeats.length} className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dull text-black font-semibold text-sm cursor-pointer hover:brightness-105 active:scale-95 shadow-[0_10px_30px_-10px_rgba(168,85,247,0.9)]">
                Proceed to Checkout
                <ArrowRightIcon className="w-4 h-4 inline-block ml-2" />
              </button>
            </div>
          </div>
        </div>

        {/* 3D "view from seat" preview modal */}
        {previewSeat && previewMeta && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setPreviewSeat(null)}
          >
            <div
              className="animate-pop-in relative w-full max-w-3xl rounded-[28px] overflow-hidden border border-primary/30 bg-gradient-to-br from-[#160f22] via-[#0d0a14] to-black shadow-[0_50px_140px_-35px_rgba(168,85,247,0.7)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* glow ring accents */}
              <div className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-primary/25 blur-[90px]" />
              <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-[90px]" />

              <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <span
                    className="grid place-items-center h-11 w-11 rounded-2xl text-black font-extrabold text-base shadow-lg shadow-primary/30"
                    style={{ background: `linear-gradient(135deg, ${(previewMeta.rowColors?.[previewMeta.rowIndex]) || "#c084fc"}, #c084fc)` }}
                  >
                    {previewSeat}
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-violet-300 font-semibold">Your view from</p>
                    <h3 className="text-lg font-bold leading-tight">Seat {previewSeat}</h3>
                    <p className="text-[11px] text-gray-400">
                      {(rowToSection[previewSeat[0]]?.label || "Zone")} · {currency} {getSeatPrice(previewSeat)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewSeat(null)}
                  aria-label="Close preview"
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-black/60 border border-white/15 text-gray-200 hover:bg-primary hover:text-black transition cursor-pointer"
                >
                  <span className="text-lg leading-none">✕</span>
                </button>
              </div>

              <div className="relative h-[58vh] bg-black">
                <ErrorBoundary
                  key={previewSeat}
                  fallback={<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-sm text-gray-400"><span className="text-2xl">🪑</span>3D preview couldn't load for this seat.</div>}
                >
                  <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Loading 3D preview…</div>}>
                    <SeatViewPreview
                      rowIndex={previewMeta.rowIndex}
                      colIndex={previewMeta.colIndex}
                      rows={previewMeta.rows}
                      cols={previewMeta.cols}
                      screenImage={previewMeta.screenImage}
                      screenLabel={previewMeta.screenLabel}
                      rowColors={previewMeta.rowColors}
                      seatStatus={previewMeta.seatStatus}
                      onPickSeat={pickSeatFrom3D}
                    />
                  </Suspense>
                </ErrorBoundary>
                {/* top vignette so the header reads cleanly */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/60 to-transparent" />
                <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-black/70 border border-white/15 text-xs text-gray-100 whitespace-nowrap backdrop-blur-sm">
                  🖱️ Drag to look around (360°) · 🪑 click any seat to sit there
                </div>
              </div>

              <div className="relative px-5 py-3.5 border-t border-white/10 flex items-center gap-2.5 bg-white/[0.02]">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <p className="text-sm text-gray-300">{previewMeta.hint}</p>
              </div>
            </div>
          </div>
        )}

        {/* Local Hold card (cooler) */}
        {tempHold && !cardHiddenLocal && selectedTimeSlot && (
          <div className="fixed left-4 sm:left-8 bottom-8 z-50 w-[min(92vw,380px)]">
            <div className="group relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1a130b]/95 via-black/90 to-black/95 backdrop-blur-xl shadow-[0_24px_70px_-25px_rgba(0,0,0,0.85)]">
              {/* live countdown bar */}
              <div className="h-1 w-full bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${Math.max(0, Math.min(100, ((holdTimeLeft ?? 0) / (10 * 60 * 1000)) * 100))}%` }}
                />
              </div>

              <div className="p-4">
                <div className="flex items-start gap-3">
                  {posterUrl && (
                    <img src={posterUrl} alt={movie.title} className="h-20 w-14 rounded-lg object-cover ring-1 ring-primary/25 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-amber-300 font-semibold">Pending booking</span>
                    </div>
                    <div className="font-bold truncate mt-0.5">{showData?.movie?.title || "Movie"}</div>
                    <div className="text-xs text-gray-300 truncate">{theaterNameToShow} • {isoTimeFormat(selectedTimeSlot.time)}</div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {(tempHold.seats || []).map((s) => (
                        <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-primary/15 text-primary border border-primary/30">{s}</span>
                      ))}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-amber-300 tabular-nums">
                      Expires in {formatMs(holdTimeLeft ?? Math.max(0, new Date(tempHold.expiresAt).getTime() - Date.now()))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {tempHold?.paymentLink && (
                    <button
                      onClick={(e) => { e.stopPropagation(); window.location.href = tempHold.paymentLink; }}
                      className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-b from-primary to-primary-dull hover:brightness-110 text-black text-sm font-semibold cursor-pointer transition shadow-[0_10px_26px_-10px_rgba(168,85,247,0.9)]"
                    >
                      Pay Now
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); releaseTempHold(tempHold); }}
                    className="px-4 py-2 rounded-xl border border-white/15 text-sm text-gray-200 hover:bg-white/5 cursor-pointer transition"
                  >
                    Release
                  </button>
                </div>
              </div>

              {/* hide (X) */}
              <button
                onClick={(e) => { e.stopPropagation(); hideCardLocally(); }}
                title="Hide"
                aria-label="Hide hold card"
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/6 flex items-center justify-center text-xs text-gray-300 hover:bg-white/12 hover:text-white transition cursor-pointer"
              >
                ✕
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
        {navLoading && (
          <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center">
            {/* BLUR BACKGROUND */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

            {/* LOADER + TEXT */}
            <div className="relative z-10 flex flex-col items-center">
              {/* SPINNER */}
              <svg
                className="animate-spin h-12 w-12 text-primary"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="2.5"
                />
                <path
                  d="M22 12a10 10 0 0 0-10-10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              {/* TEXT */}
              <p className="mt-4 text-sm text-gray-300 text-center">
                Please wait while we confirm your seats…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeatLayout;