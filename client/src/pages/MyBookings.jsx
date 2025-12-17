// src/pages/MyBookings.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BlurCircle from "../components/BlurCircle";
import Loading from "../components/Loading";
import MyBookingSkeleton from "../components/MyBookingSkeleton";
import { useAppContext } from "../context/AppContext";

/* constants */
const TEMP_HOLD_PREFIX = "tempHold:";
const TEN_MINUTES_MS = 10 * 60 * 1000;

const MyBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY || "$";
  const { axios, getToken, user, image_base_url } = useAppContext();
  const navigate = useNavigate();
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const [bookings, setBookings] = useState([]);
  const [filterType, setFilterType] = useState("ALL");
  const [runtimeMap, setRuntimeMap] = useState({});
  const [uiLoading, setUiLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingMap, setRemainingMap] = useState({});
  const [localHoldsByShow, setLocalHoldsByShow] = useState({}); // key: showId -> hold
  const intervalRef = useRef(null);

  const getMyBookings = async () => {
    try {
      setIsLoading(true);
      setUiLoading(true);
      const { data } = await axios.get("/api/user/bookings", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (data?.success && Array.isArray(data.bookings)) {
        setBookings(data.bookings);
        const initial = {};
        data.bookings.forEach((b) => {
          const key = b._id || b.id || JSON.stringify(b);
          if (b?.expiresAt) {
            initial[key] = Math.max(0, new Date(b.expiresAt).getTime() - Date.now());
          } else {
            const created = b?.createdAt ? new Date(b.createdAt) : new Date();
            const expiry = new Date(created.getTime() + TEN_MINUTES_MS);
            initial[key] = Math.max(0, expiry.getTime() - Date.now());
          }
        });
        setRemainingMap(initial);
      } else {
        setBookings([]);
        setRemainingMap({});
      }
    } catch (err) {
      console.error("getMyBookings error:", err);
      setBookings([]);
      setRemainingMap({});
    } finally {
      setIsLoading(false);
      setTimeout(() => setUiLoading(false), 3000);
    }
  };

  const formatShowTime = (showTime, showDateTime) => {
    const t = showTime || showDateTime;
    if (!t) return "—";

    const d = new Date(t);
    if (isNaN(d.getTime())) return "—";

    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const paidShowIds = useMemo(() => {
    const set = new Set();
    bookings.forEach((b) => {
      if (b.isPaid) {
        const sid =
          b.show?.showId ||
          b.show?._id ||
          b.showId;

        if (sid) set.add(String(sid));
      }
    });
    return set;
  }, [bookings]);

  const resolveTheaterName = (item) =>
    item.show?.theater?.name ||
    item.show?.theaterName ||
    item.theater?.name ||
    item.theaterName ||
    "—";

  const resolveAmount = (item) =>
    item.amount ??
    item.total ??
    item.totalAmount ??
    item.price ??
    item.grandTotal ??
    0;

  const resolveRuntimeMinutesFromMovie = (m) => {
    if (!m) return null;
    const candidates = [
      m?.runtime,
      m?.run_time,
      m?.duration,
      m?.length,
      m?.runtimeMinutes,
      m?.runTime,
    ];
    for (const c of candidates) {
      if (c == null) continue;
      const n = Number(c);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (n > 1000) return Math.round(n / 60); // seconds → minutes
      return Math.round(n);
    }
    return null;
  };

  const fetchRuntimeIfMissing = async (movieId) => {
    if (!movieId || runtimeMap[movieId]) return;

    try {
      const { data } = await axios.get(`/api/show/now-playing/${movieId}`);
      if (data?.success && data.movie) {
        const runtime = resolveRuntimeMinutesFromMovie(data.movie);
        if (runtime) {
          setRuntimeMap((prev) => ({
            ...prev,
            [movieId]: runtime,
          }));
        }
      }
    } catch {
      // silent fail
    }
  };

  const isTicketExpired = (item, runtimeMap) => {
    if (!item?.isPaid) return false;

    const movie = item.show?.movie;
    if (!movie) return false;

    const runtime =
      Number(movie.runtime) ||
      runtimeMap[movie._id || movie.id];

    if (!runtime) return false;

    const showStart = new Date(item.show.showDateTime).getTime();
    if (isNaN(showStart)) return false;

    const expiry =
      showStart +
      runtime * 60 * 1000 -
      10 * 60 * 1000;

    return Date.now() > expiry;
  };


  //  localStorage for tempHold entries — DEDUPED by showId (so multiple slightly different keys won't create duplicates)
  const scanLocalTempHolds = () => {
    const found = {};
    const now = Date.now();

    // 🔥 server bookings showIds
    const serverShowIds = new Set(
      (bookings || []).map(b =>
        String(
          b.show?.showId ||
          b.show?._id ||
          b.showId
        )
      )
    );

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("tempHold:")) continue;

      try {
        const parsed = JSON.parse(localStorage.getItem(key));

        if (!parsed?.expiresAt || parsed.expiresAt <= now) {
          localStorage.removeItem(key);
          continue;
        }

        const showId =
          parsed.showId || key.split(":").slice(3).join(":");

        // 🔥 SERVER BOOKING EXISTS → DELETE LOCAL HOLD
        const serverBookingForShow = bookings.find(b =>
          String(
            b.show?.showId ||
            b.show?._id ||
            b.showId
          ) === String(showId) &&
          !b.isPaid
        );


        if (serverBookingForShow) {
          localStorage.removeItem(key);
          continue;
        }

        found[showId] = {
          __localHold: true,
          __localKey: key,
          showId,
          movieTitle: parsed.movieTitle || parsed.movie?.title || "Pending movie",
          poster:
            parsed.poster ||
            (parsed.movie?.poster_path
              ? image_base_url + parsed.movie.poster_path
              : null),
          theaterName: parsed.theaterName || "",
          showTime: parsed.showTime || parsed.time || null,
          seats: parsed.seats || [],
          amount: parsed.amount ?? parsed.total ?? 0,
          expiresAt: parsed.expiresAt,
        };
      } catch { }
    }

    setLocalHoldsByShow(found);
  };

  useEffect(() => {
    const onBookingReleased = () => {
      getMyBookings(); // 🔥 REFRESH SERVER BOOKINGS
    };

    window.addEventListener("BOOKING_RELEASED", onBookingReleased);

    return () => {
      window.removeEventListener("BOOKING_RELEASED", onBookingReleased);
    };
  }, []);


  useEffect(() => {
    if (user) getMyBookings();
    else {
      setBookings([]);
      setRemainingMap({});
      setLocalHoldsByShow({});
      setIsLoading(false);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  useEffect(() => {
    // immediate scan so holds appear without reload
    scanLocalTempHolds();

    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    // start 1s tick to update both server remainingMap and local holds remaining ms
    intervalRef.current = setInterval(() => {
      // update server remaining counters
      setRemainingMap((prev) => {
        const next = { ...prev };
        let changed = false;
        bookings.forEach((b) => {
          const key = b._id || b.id || JSON.stringify(b);
          if (b?.expiresAt) {
            const rem = Math.max(0, new Date(b.expiresAt).getTime() - Date.now());
            if (next[key] !== rem) { next[key] = rem; changed = true; }
            return;
          }
          const cur = typeof next[key] === "number" ? next[key] : null;
          if (cur === null) {
            const created = b?.createdAt ? new Date(b.createdAt) : new Date();
            const expiry = new Date(created.getTime() + TEN_MINUTES_MS);
            const remaining = Math.max(0, expiry.getTime() - Date.now());
            next[key] = remaining; changed = true; return;
          }
          const updated = Math.max(0, cur - 1000);
          if (updated !== cur) { next[key] = updated; changed = true; }
        });
        return changed ? next : prev;
      });

      // rescan local holds so they update/explode immediately when released
      scanLocalTempHolds();
    }, 1000);

    const onReleased = async (e) => {
      const showId = e.detail?.showId;
      if (!showId) return;

      // 1️⃣ remove local hold
      setLocalHoldsByShow((prev) => {
        const copy = { ...prev };
        delete copy[showId];
        return copy;
      });

      // 2️⃣ 🔥 REFRESH SERVER BOOKINGS
      await getMyBookings();
    };


    window.addEventListener("TEMP_HOLD_RELEASED", onReleased);
    window.addEventListener("tempHoldChanged", scanLocalTempHolds);
    window.addEventListener("storage", scanLocalTempHolds);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("TEMP_HOLD_RELEASED", onReleased);
      window.removeEventListener("tempHoldChanged", scanLocalTempHolds);
      window.removeEventListener("storage", scanLocalTempHolds);
    };
    // eslint-disable-next-line
  }, [bookings]);

  const formatRemaining = (ms) => {
    if (!ms || ms <= 0) return "00:00";
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
      s % 60
    ).padStart(2, "0")}`;
  };

  const formatRuntime = (minutes) => {
    if (!minutes || minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const resolveRuntime = (item) => {
    const movie = item.show?.movie || item.movie;
    if (!movie) return null;

    if (movie.runtime && Number(movie.runtime) > 0) {
      return Number(movie.runtime);
    }

    // 2️⃣ fallback: runtimeMap (API fetched)
    const movieId = movie._id || movie.id;
    if (movieId && runtimeMap[movieId]) {
      return Number(runtimeMap[movieId]);
    }

    return null;
  };


  // combine local holds and server bookings (local holds first)
  const visibleBookings = useMemo(() => {
    if (uiLoading) return [];

    const now = Date.now();

    // 1️⃣ Local holds
    const localItems = Object.values(localHoldsByShow || {}).map(h => ({
      ...h,
      __localHold: true,
      __expired: false,
    }));

    // 2️⃣ Server bookings
    const serverItems = (bookings || [])
      .filter(b => {
        if (!b.isPaid) {
          const key = b._id || JSON.stringify(b);
          const remaining =
            remainingMap[key] ??
            (new Date(b.createdAt).getTime() + TEN_MINUTES_MS - Date.now());

          return remaining > 0;
        }

        // ✅ PAID → always keep (expired/non-expired handled later)
        return true;
      })
      .map(b => ({
        ...b,
        __expired: b.isPaid
          ? isTicketExpired({ show: b.show, isPaid: true }, runtimeMap)
          : false,
      }));

    // 3️⃣ Combine
    const combined = [...serverItems, ...localItems];

    // 4️⃣ Tabs filter
    if (filterType === "PAID") {
      return combined.filter(i => i.isPaid && !i.__expired);
    }

    if (filterType === "PENDING") {
      return combined.filter(i => !i.isPaid);
    }

    if (filterType === "EXPIRED") {
      return combined.filter(i => i.__expired);
    }

    return combined;
  }, [
    bookings,
    localHoldsByShow,
    filterType,
    runtimeMap,
    uiLoading,
  ]);


  useEffect(() => {
    if (!visibleBookings.length) return;

    visibleBookings.forEach((item) => {
      const movieObj = item.show?.movie || item.movie || null;
      const movieId = movieObj?._id || movieObj?.id;

      const runtime = resolveRuntimeMinutesFromMovie(movieObj);

      if (!runtime && movieId && !runtimeMap[movieId]) {
        fetchRuntimeIfMissing(movieId);
      }
    });
    // eslint-disable-next-line
  }, [visibleBookings]);

  useEffect(() => {
    if (isLoading) return;

    setUiLoading(true);

    const id = requestAnimationFrame(() => {
      setUiLoading(false);
    });

    return () => cancelAnimationFrame(id);
  }, [filterType]);

  const safePoster = (b) =>
    b?.poster ? b.poster :
      b?.show && b.show.movie && b.show.movie.poster_path
        ? image_base_url + b.show.movie.poster_path
        : null;

  const safeTitle = (b) =>
    b?.show && b.show.movie && b.show.movie.title
      ? b.show.movie.title
      : (b?.movieTitle || (b?.show?.movie?.title) || "Unknown Movie");

  const resolveShowTime = (item) => {
    const t =
      item.show?.showTime ||
      item.show?.showDateTime ||
      item.showDateTime;

    if (!t) return "—";

    const d = new Date(t);
    if (isNaN(d.getTime())) return "—";

    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resolveTicketUrl = (item) =>
    item.ticketUrl ||
    item.ticketPdf ||
    item.invoiceUrl ||
    null;

  const shouldShowSkeleton = isLoading || uiLoading;

  const animationStyles = useMemo(() => (
    <style>
      {`
      @keyframes pulse-soft {
      0% {
      transform: scale(1);
      opacity: 0.6;
      }
     50% {
        transform: scale(1.08);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 0.6;
      }
    }

    .animate-pulse-soft {
      animation: pulse-soft 1.6s ease-in-out infinite;
    }
    `}
    </style>
  ), []);


  if (isLoading) {
    return (
      <div className="relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh]">
        <BlurCircle top="100px" left="100px" />
        <div><BlurCircle bottom="0px" left="600px" /></div>
        <h1 className="text-lg font-semibold mb-4">My Bookings</h1>
        <Loading />
      </div>
    );
  }

  const onClickBookingCard = (b) => {
    // ❌ Paid cards are NOT clickable
    if (b.isPaid) return;

    // ❌ Pending cards also not clickable now
    if (!b.__localHold) return;

    // local hold case (optional)
    if (b.__localHold) {
      navigate("/review-booking", {
        state: { booking: b }
      });
    }
  };

  return (
    <>
      {animationStyles}
      <div className="relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh]">
        <BlurCircle top="100px" left="100px" />
        <div><BlurCircle bottom="0px" left="600px" /></div>
        <h1 className="text-lg font-semibold mb-4">My Bookings</h1>
        <div className="flex gap-3 mb-6">
          {["ALL", "PAID", "PENDING", "EXPIRED"].map((t) => (
            <button
              key={t}
              onClick={() => {
                if (filterType === t) return;
                setFilterType(t);
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition cursor-pointer
        ${filterType === t
                  ? "bg-teal-500 text-black"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
            >
              {t}
            </button>
          ))}
        </div>
        {shouldShowSkeleton ? (
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <MyBookingSkeleton key={i} />
            ))}
          </div>
        ) : visibleBookings.length === 0 ? (
          <div
            key={filterType}
            className="flex flex-col items-center justify-center mt-28 text-gray-400"
          >
            <div className="w-20 h-20 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-4 animate-pulse-soft">
              🎟️
            </div>
            <p className="text-lg font-medium">No bookings found</p>
            <p className="text-sm text-gray-500 mt-1">
              Your bookings will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleBookings.map((item, index) => {
              if (item.__localHold && paidShowIds.has(String(item.showId))) {
                return null;
              }
              const key = item.__localHold ? item._localKey : (item._id || item.id || index);
              const remaining = item.__localHold ? item.__remainingMs : (remainingMap[item._id || item.id || JSON.stringify(item)] ?? 0);
              const isExpired = remaining <= 0;
              const isPaid = !!item.isPaid;

              return (
                <div
                  key={key}
                  onClick={() => onClickBookingCard(item)}
                  className={`flex flex-col md:flex-row justify-between
  border border-white/6 rounded-lg mt-4 p-4 max-w-4xl shadow-md
  transition-transform duration-300
  ${item.__expired ? "opacity-50 grayscale pointer-events-none" : ""}
  ${isPaid ? "from-emerald-900/30" : "from-amber-900/30"} to-slate-800/60`}>
                  <div className="flex flex-col md:flex-row gap-4">
                    {safePoster(item) ? (
                      <img src={safePoster(item)} alt={safeTitle(item)} className="w-40 h-56 object-cover rounded-md shadow-sm" />
                    ) : (
                      <div className="w-40 h-56 bg-white/6 rounded-md flex items-center justify-center text-sm text-gray-400">No poster</div>
                    )}

                    <div className="flex flex-col justify-between py-1">
                      <div>
                        <p className="text-2xl font-bold">
                          {safeTitle(item)}
                          {resolveRuntime(item) && (
                            <span className="ml-2 text-sm font-medium text-gray-400">
                              • {formatRuntime(resolveRuntime(item))}
                            </span>
                          )}
                        </p>
                        <div className="mt-4">
                          <div className="text-xs text-gray-400">Theater & time</div>
                          <div className="font-medium mt-1">
                            {resolveTheaterName(item)} •{" "}
                            {resolveShowTime(item)}
                          </div>

                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-gray-400">Seats</div>
                          <div className="font-medium mt-1">{(item.seats || item.bookedSeats || []).join(", ") || "—"}</div>
                        </div>
                      </div>

                      {item.isPaid ? (
                        <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                          PAID
                        </div>
                      ) : (
                        <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
                          PENDING PAYMENT
                        </div>
                      )}
                      {item.__expired && (
                        <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                          EXPIRED
                        </div>
                      )}
                      {item.isPaid && (
                        <div className="mt-3 text-xs restaurant text-emerald-400">
                          Ticket confirmed
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end">
                    <div className="text-right">
                      <div className="text-3xl font-bold text-teal-400">{currency} {resolveAmount(item)}</div>

                      {!isPaid ? (
                        <>
                          {!isExpired ? (
                            <div className="mt-3 inline-flex items-center gap-3 bg-black/20 px-3 py-2 rounded">
                              <div className="text-xs text-gray-300">
                                {item.__localHold ? "Hold expires in" : "Pay within"}
                              </div>
                              <div className="font-mono text-sm">
                                {formatRemaining(remaining)}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-red-400 bg-black/10 px-3 py-1 rounded">
                              Expired
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-end gap-2 mt-3">
                          {/* DOWNLOAD TICKET */}
                          {item.isPaid && item.ticketUrl && !item.__expired && (
                            <a
                              href={`${API_BASE}${item.ticketUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition"
                            >
                              Download Ticket
                            </a>
                          )}

                          {item.__expired && (
                            <div className="text-xs text-red-400 mt-2">
                              Ticket expired
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {!isExpired && item.paymentLink && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = item.paymentLink;
                        }}
                        className="mt-3 px-6 py-2 cursor-pointer rounded-full text-sm font-semibold bg-teal-500 text-black hover:bg-teal-400 transition"
                      >
                        Pay Now
                      </button>
                    )}

                    <div className="text-sm text-gray-400 mt-4">
                      <div>Total Tickets: {(item.bookedSeats || item.seats || []).length}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>)
        }
      </div>
    </>
  );
};

export default MyBookings;