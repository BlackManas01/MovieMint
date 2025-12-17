// src/pages/ReviewYourBooking.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import isoTimeFormat from "../lib/isoTimeFormat";
import { ArrowLeftIcon } from "lucide-react";

/**
 * ReviewYourBooking (styling updated: vertically centered)
 * - Keeps all existing logic (fetch, countdown, back->hold, pay flow).
 * - Card is vertically centered in the viewport (so it appears in the middle, not stuck to header).
 * - Visual styling preserved from the last version.
 */

const LS = {
    TEMP_HOLD: (movieId, date, showId) => `tempHold:${movieId}:${date}:${showId}`,
};

const formatCountdown = (ms) => {
    if (ms <= 0) return "00:00";
    const s = Math.floor(ms / 1000);
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
};

const ReviewYourBooking = () => {
    const { bookingId } = useParams(); // optional
    const navigate = useNavigate();
    const location = useLocation();
    const { axios, getToken, user, image_base_url } = useAppContext();

    // booking may arrive via location.state (from SeatLayout) or via bookingId fetch
    const incomingBooking = location.state?.booking || null;
    const [booking, setBooking] = useState(incomingBooking);
    const [loading, setLoading] = useState(!incomingBooking && !!bookingId);
    const [payLoading, setPayLoading] = useState(false);

    // countdown state
    const [timeLeft, setTimeLeft] = useState(() => {
        const t = incomingBooking?.expiresAt || (booking && booking.expiresAt) || null;
        return t ? Math.max(0, new Date(t).getTime() - Date.now()) : null;
    });
    const timerRef = useRef(null);

    useEffect(() => {
        // If we don't have a booking and bookingId param exists, fetch it
        if (!incomingBooking && !bookingId) {
            setLoading(false);
            return;
        }
        if (!incomingBooking && bookingId) {
            const fetchBooking = async () => {
                try {
                    setLoading(true);
                    const { data } = await axios.get(`/api/booking/${bookingId}`);
                    if (data?.success) {
                        setBooking(data.booking);
                        if (data.booking?.expiresAt) setTimeLeft(Math.max(0, new Date(data.booking.expiresAt).getTime() - Date.now()));
                    } else {
                        toast.error(data?.message || "Booking not found");
                        setBooking(null);
                    }
                } catch (err) {
                    console.error("fetchBooking error:", err);
                    toast.error("Failed to load booking");
                    setBooking(null);
                } finally {
                    setLoading(false);
                }
            };
            fetchBooking();
        }
        // eslint-disable-next-line
    }, [bookingId, incomingBooking]);

    const normalizeBooking = async ({ booking, axios, image_base_url }) => {
        if (!booking) return booking;

        // already hydrated
        if (
            booking.movie?.title &&
            booking.show?.theaterName &&
            booking.show?.showTime
        ) {
            return booking;
        }

        const movieId = booking.movieId || booking.movie?._id;
        const showId = booking.show?.showId || booking.showId;

        if (!movieId || !showId) return booking;

        try {
            const { data } = await axios.get(`/api/show/${movieId}`);
            if (!data?.success) return booking;

            const movie = data.movie;
            let foundShow = null;

            // 🔥 find matching show by showId
            Object.values(data.dateTime || {}).forEach((slots) => {
                slots.forEach((s) => {
                    if (
                        String(s.showId || s._id) === String(showId)
                    ) {
                        foundShow = s;
                    }
                });
            });

            if (!foundShow) return booking;

            return {
                ...booking,
                movieId: movie._id,
                movie,
                show: {
                    showId,
                    theaterName:
                        foundShow.theaterName ||
                        foundShow.theater?.name ||
                        "",
                    showTime: foundShow.time,
                },
                poster: movie.poster_path
                    ? image_base_url + movie.poster_path
                    : booking.poster,
                date:
                    booking.date ||
                    new Date(foundShow.time).toISOString().slice(0, 10),
            };
        } catch (e) {
            console.warn("normalizeBooking failed", e);
            return booking;
        }
    };


    useEffect(() => {
        if (!booking) return;

        (async () => {
            const full = await normalizeBooking({
                booking,
                axios,
                image_base_url,
            });
            setBooking(full);
        })();
    }, [booking?.bookingId, booking?.show?.showId]);


    // start/refresh countdown whenever booking.expiresAt changes
    useEffect(() => {
        const expires = incomingBooking?.expiresAt || booking?.expiresAt;
        if (!expires) {
            setTimeLeft(null);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }
        setTimeLeft(Math.max(0, new Date(expires).getTime() - Date.now()));
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const left = Math.max(0, new Date(expires).getTime() - Date.now());
            setTimeLeft(left);
            if (left <= 0 && timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [incomingBooking?.expiresAt, booking?.expiresAt]);

    useEffect(() => {
        const onReleased = (e) => {
            const releasedShowId = e.detail?.showId;
            if (releasedShowId && booking?.show?.showId === releasedShowId) {
                toast("Seats were released");
                navigate(-1);
            }
        };

        window.addEventListener("TEMP_HOLD_RELEASED", onReleased);
        return () =>
            window.removeEventListener("TEMP_HOLD_RELEASED", onReleased);
    }, [booking]);

    // const handlePayNow = async () => {
    //     console.log("🔥 PAY NOW bookingId:", booking?.bookingId);

    //     try {
    //         setPayLoading(true);

    //         const token = await getToken();

    //         // 🔥 CREATE BOOKING + STRIPE SESSION
    //         const { data } = await axios.post(
    //             "/api/booking/create",
    //             {
    //                 showId: booking.showId || booking.show?.showId,
    //                 selectedSeats: booking.seats,
    //             },
    //             {
    //                 headers: { Authorization: `Bearer ${token}` },
    //             }
    //         );

    //         if (!data.success || !data.paymentLink) {
    //             toast.error("Payment link not available");
    //             return;
    //         }

    //         // 🔥 update bookingId locally (VERY IMPORTANT)
    //         setBooking((prev) => ({
    //             ...prev,
    //             bookingId: data.bookingId,
    //             expiresAt: data.expiresAt,
    //         }));

    //         // 🔥 REDIRECT TO STRIPE PAGE
    //         window.location.href = data.paymentLink;

    //     } catch (err) {
    //         console.error(err);
    //         toast.error("Failed to start payment");
    //     } finally {
    //         setPayLoading(false);
    //     }
    // };

    const handlePayNow = async () => {
        if (!booking?.paymentLink) {
            toast.error("Payment link not available");
            return;
        }

        // ✅ JUST REDIRECT
        window.location.href = booking.paymentLink;
    };


    // Back handler: save temp-hold and navigate explicitly back to SeatLayout with showId/time query params
    const handleBackAndHold = () => {
        if (!booking) {
            navigate(-1);
            return;
        }

        const source = location.state?.source;

        // 🔥 from MyBookings → go back to MyBookings
        if (source === "my-bookings") {
            navigate("/my-bookings");
            return;
        }

        // 🔥 from SeatLayout → ALWAYS go back to SeatLayout
        if (source === "seat-layout") {
            const movieId = booking.movieId;
            const dateVal = booking.date;
            const showId = booking.show?.showId;
            const timeIso = booking.show?.showTime
                ? new Date(booking.show.showTime).toISOString()
                : "";

            navigate(
                `/movies/${movieId}/${dateVal}?showId=${showId}&time=${encodeURIComponent(
                    timeIso
                )}`
            );
            return;
        }

        // 🔥 fallback (deep link / refresh case)
        navigate(-1);
    };

    if (loading) return <Loading />;

    if (!booking) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="w-full max-w-xl text-center">
                    <h2 className="text-2xl font-semibold mb-3">No booking data</h2>
                    <p className="text-sm text-gray-400 mb-4">Open this page from the seat selection flow or use a bookingId link.</p>
                    <div className="flex justify-center gap-3">
                        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded border border-white/10 hover:bg-white/5">Go back</button>
                        <button onClick={() => navigate("/")} className="px-4 py-2 rounded bg-teal-600 text-white">Home</button>
                    </div>
                    <div className="mt-6 w-full bg-black/60 border border-white/10 p-4 rounded text-xs text-gray-300">
                        <div><strong>Debug</strong></div>
                        <pre className="whitespace-pre-wrap text-[12px] mt-2">{JSON.stringify({ bookingId, locationState: location.state }, null, 2)}</pre>
                    </div>
                </div>
            </div>
        );
    }

    const movie = booking.movie || {};
    const posterUrl =
        booking.movie?.poster_path
            ? image_base_url + booking.movie.poster_path
            : booking.poster || booking.movie?.poster || null;
    const amountValue = booking.amount ?? booking.total ?? null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-6 flex items-center">
            {/* container centered vertically (so card appears in the middle of the viewport) */}
            <div className="w-full max-w-5xl mx-auto">
                {/* Top small title bar (kept, but moved visually above the centered card) */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={handleBackAndHold}
                        className="flex items-center cursor-pointer gap-2 px-3 py-2 rounded-md bg-white/6 hover:bg-white/8 text-white/90"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Back
                    </button>

                    <div>
                        <div className="text-sm text-gray-300">Review</div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">Review Your Booking</h1>
                        <div className="text-sm text-gray-400 mt-1">Confirm details & complete payment</div>
                    </div>
                </div>

                {/* Movie / details card (stylish) */}
                <div className="bg-gradient-to-r from-slate-900/80 via-indigo-900/80 to-rose-900/80 rounded-2xl p-6 shadow-2xl border border-white/6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Poster */}
                        <div className="w-full md:w-44 flex-shrink-0">
                            {posterUrl ? (
                                <img src={posterUrl} alt={movie.title} className="w-full h-auto rounded-lg object-cover shadow-lg" />
                            ) : (
                                <div className="w-full h-64 bg-white/6 rounded-lg flex items-center justify-center text-gray-400">No poster</div>
                            )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="text-xs text-gray-300">Movie</div>
                                <div className="text-2xl md:text-3xl font-bold text-white mt-1">{movie.title || booking.movieTitle || "Movie"}</div>

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <div className="text-xs text-gray-300">Theater & time</div>
                                        <div className="font-medium text-white mt-1">{booking.show?.theaterName || booking.theaterName || ""}</div>
                                        <div className="text-sm text-gray-300 mt-1">{booking.show?.showTime ? isoTimeFormat(booking.show.showTime) : (booking.time ? isoTimeFormat(booking.time) : "")}</div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-gray-300">Seats</div>
                                        <div className="font-medium text-white mt-1">{(booking.seats || []).join(", ") || "None"}</div>
                                    </div>

                                    <div className="flex flex-col">
                                        <div className="text-xs text-gray-300">Amount</div>
                                        <div className="text-2xl md:text-3xl font-extrabold text-emerald-400 mt-1">{amountValue !== null ? `$ ${amountValue}` : "—"}</div>
                                    </div>
                                </div>
                            </div>

                            {/* bottom row inside card: timer + pay button */}
                            <div className="mt-6 flex items-center justify-between">
                                <div className="inline-flex items-center gap-4 bg-white/5 border border-white/6 px-4 py-2 rounded-lg">
                                    <div className="text-xs text-gray-300">Hold expires in</div>
                                    <div className="text-lg md:text-2xl font-semibold text-orange-300">{formatCountdown(timeLeft ?? 0)}</div>
                                    {booking.expiresAt && <div className="text-xs text-gray-300">• {new Date(booking.expiresAt).toLocaleString()}</div>}
                                </div>

                                <div>
                                    <button
                                        onClick={handlePayNow}
                                        disabled={payLoading}
                                        className={`px-6 py-3 rounded-full cursor-pointer text-white font-semibold shadow-lg transform transition-all ${payLoading ? "opacity-80 cursor-wait bg-emerald-500" : "bg-emerald-500 hover:scale-[1.02] hover:shadow-2xl"}`}
                                    >
                                        {payLoading ? "Preparing…" : "Pay now"}
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

export default ReviewYourBooking;