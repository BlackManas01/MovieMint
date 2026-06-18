// controllers/bookingController.js - Booking CRUD, seat holding, payment confirmation, and ticket download
import mongoose from "mongoose";
import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import Stripe from "stripe";
import { generateTicketPdf } from "../utils/generateTicketPdf.js";
import { clerkClient } from "@clerk/express";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_SEATS_PER_BOOKING = 10;
const VALID_SEAT_REGEX = /^[A-Z]\d{1,2}$/;

const HOLD_MINUTES = Number(process.env.BOOKING_HOLD_MINUTES || 10); // default 10 minutes

// ----- Zone pricing (mirrors the client seat layout) -----
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const sliceRows = (start, count) => ALPHA.slice(start, start + count);

const sectionsForExperience = (experience, bp) => {
    const exp = (experience || "").toLowerCase();
    const laser = [
        { rows: sliceRows(0, 2), price: bp + 0 },
        { rows: sliceRows(2, 8), price: bp + 50 },
        { rows: sliceRows(10, 2), price: bp + 100 },
    ];
    if (!exp) return laser;
    if (exp.includes("imax") || exp.includes("dolby")) {
        return [
            { rows: sliceRows(0, 2), price: bp + 0 },
            { rows: sliceRows(2, 6), price: bp + 50 },
            { rows: sliceRows(8, 4), price: bp + 100 },
        ];
    }
    if (exp.includes("insignia")) return [{ rows: sliceRows(0, 6), price: bp + 120 }];
    if (exp.includes("4dx")) return [{ rows: sliceRows(0, 6), price: bp + 150 }];
    return laser;
};

const priceForSeat = (experience, bp, seatId) => {
    const row = String(seatId).match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
    const sections = sectionsForExperience(experience, bp);
    for (const s of sections) if (s.rows.includes(row)) return s.price;
    return bp;
};

// Helper: clean expired held seats on a show (server-side) and persist when changed
const cleanupExpiredHeldSeats = async (showDoc) => {
    const now = Date.now();
    if (!showDoc || !showDoc.heldSeats) return;
    let changed = false;
    for (const seat of Object.keys(showDoc.heldSeats)) {
        try {
            const entry = showDoc.heldSeats[seat];
            if (!entry || !entry.expiresAt) {
                delete showDoc.heldSeats[seat];
                changed = true;
                continue;
            }
            if (new Date(entry.expiresAt).getTime() <= now) {
                delete showDoc.heldSeats[seat];
                changed = true;
            }
        } catch (e) {
            // defense: remove problematic entry
            delete showDoc.heldSeats[seat];
            changed = true;
        }
    }
    if (changed) {
        showDoc.markModified("heldSeats");
        await showDoc.save();
    }
};

// POST /api/booking/create
export const createBooking = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { showId, selectedSeats = [], addonAmount = 0 } = req.body;
        const { origin } = req.headers;
        const clerkUser = await clerkClient.users.getUser(userId);

        if (!showId || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
            return res.status(400).json({ success: false, message: "showId and selectedSeats required" });
        }

        if (!mongoose.Types.ObjectId.isValid(showId)) {
            return res.status(400).json({ success: false, message: "Invalid showId" });
        }

        if (selectedSeats.length > MAX_SEATS_PER_BOOKING) {
            return res.status(400).json({ success: false, message: `Maximum ${MAX_SEATS_PER_BOOKING} seats per booking` });
        }

        if (!selectedSeats.every(s => typeof s === 'string' && VALID_SEAT_REGEX.test(s))) {
            return res.status(400).json({ success: false, message: "Invalid seat format" });
        }

        // load show and cleanup expired held seats
        const showData = await Show.findById(showId).populate("movie");
        if (!showData) return res.json({ success: false, message: "Show not found" });

        // Remove expired held seats first, persist if changed
        await cleanupExpiredHeldSeats(showData);

        // check availability
        const now = Date.now();

        for (const seat of selectedSeats) {
            if (showData.occupiedSeats?.[seat]) {
                return res.json({ success: false, message: "Seat already booked" });
            }

            const held = showData.heldSeats?.[seat];
            if (held && new Date(held.expiresAt).getTime() > now) {
                return res.json({ success: false, message: "Seat temporarily held" });
            }
        }

        // compute amount (you had showPrice earlier)
        const bp = Number(showData.showPrice);

        if (!bp || bp <= 0) {
            return res.json({
                success: false,
                message: "Invalid show price. Cannot proceed to payment."
            });
        }
        // Per-seat zone pricing (matches the seat layout the user saw)
        const seatsAmount = selectedSeats.reduce(
            (acc, seat) => acc + priceForSeat(showData.experience, bp, seat),
            0
        );

        // Optional snacks & beverages add-on (validated, capped)
        const snacksAmount = Math.max(0, Math.min(10000, Number(addonAmount) || 0));
        const totalAmount = seatsAmount + snacksAmount;

        // create booking (pending)
        const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000); // e.g., 10 minutes
        const booking = await Booking.create({
            user: userId,
            userSnapshot: {
                name:
                    clerkUser.fullName ||
                    `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
                email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
            },

            show: showId,
            amount: totalAmount,
            seats: selectedSeats,
            status: "pending",
            expiresAt,
        });

        // mark seats as HELD on Show (heldSeats map)
        if (!showData.heldSeats) showData.heldSeats = {}; // ensure object
        selectedSeats.forEach((seat) => {
            showData.heldSeats[seat] = {
                bookingId: booking._id.toString(),
                user: userId,
                expiresAt: expiresAt.toISOString(),
            };
        });
        showData.markModified("heldSeats");
        await showData.save();

        // Stripe: create checkout session if stripe configured
        let paymentLink = null;

        try {
            if (stripe) {
                const line_items = [
                    {
                        price_data: {
                            currency: process.env.STRIPE_CURRENCY || "usd",
                            product_data: { name: showData.movie?.title || "Ticket" },
                            unit_amount: Math.round(seatsAmount * 100),
                        },
                        quantity: 1,
                    },
                ];

                if (snacksAmount > 0) {
                    line_items.push({
                        price_data: {
                            currency: process.env.STRIPE_CURRENCY || "usd",
                            product_data: { name: "Snacks & Beverages" },
                            unit_amount: Math.round(snacksAmount * 100),
                        },
                        quantity: 1,
                    });
                }

                const session = await stripe.checkout.sessions.create({
                    success_url: `${origin}/payment-success?bookingId=${booking._id}`,
                    cancel_url: `${origin}/my-bookings`,
                    line_items,
                    mode: "payment",
                    metadata: {
                        bookingId: booking._id.toString(),
                    },
                })
                paymentLink = session.url;
                booking.paymentLink = session.url;
                await booking.save();
            }
        } catch (stripeErr) {
            console.error("Stripe create session error:", stripeErr?.message || stripeErr);
            // Clean up: delete booking and release held seats if Stripe fails
            await Booking.deleteOne({ _id: booking._id });
            for (const seat of selectedSeats) {
                if (showData.heldSeats?.[seat]?.bookingId === booking._id.toString()) {
                    delete showData.heldSeats[seat];
                }
            }
            showData.markModified("heldSeats");
            await showData.save();
            return res.status(500).json({ success: false, message: "Payment session creation failed" });
        }

        // schedule an Inngest job (or any scheduler) to check payment / expire the booking
        try {
            await inngest.send({
                name: "app/checkpayment",
                data: { bookingId: booking._id.toString() },
            });
        } catch (e) {
            console.error("inngest send failed:", e?.message || e);
        }

        return res.json({
            success: true,
            bookingId: booking._id.toString(),
            amount: totalAmount,
            expiresAt: expiresAt.toISOString(),
            paymentLink,
        });
    } catch (error) {
        console.error("createBooking error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to create booking" });
    }
};

// GET /api/booking/seats/:showId
// renamed to getSeatsForShow (used by router)
export const getSeatsForShow = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);
        if (!showData)
            return res.json({ success: false, message: "Show not found" });

        // ✅ clean expired holds (your existing logic)
        await cleanupExpiredHeldSeats(showData);

        const occupiedSeats = showData.occupiedSeats
            ? Object.keys(showData.occupiedSeats)
            : [];

        const now = Date.now();
        const heldMap = showData.heldSeats || {};

        // ✅ ONLY ACTIVE HOLDS
        const heldSeats = Object.keys(heldMap)
            .filter(seat => {
                const h = heldMap[seat];
                return h?.expiresAt && new Date(h.expiresAt).getTime() > now;
            })
            .map(seat => {
                const h = heldMap[seat];
                return {
                    seat,
                    bookingId: h.bookingId,
                    user: h.user,
                    expiresAt: h.expiresAt,
                };
            });

        return res.json({
            success: true,
            occupiedSeats,
            heldSeats
        });
    } catch (error) {
        console.error("getSeatsForShow error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch seats" });
    }
};

// SSE endpoint: GET /api/booking/seats/stream?showId=...
// Streams JSON payloads periodically with { occupiedSeats, heldSeats }
export const seatsStream = async (req, res) => {
    try {
        const showId = req.query.showId;
        if (!showId) {
            res.status(400).end("showId required");
            return;
        }

        // set SSE headers
        res.set({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        });
        res.flushHeaders?.();

        let closed = false;
        req.on("close", () => {
            closed = true;
        });

        const sendSnapshot = async () => {
            try {
                const now = Date.now();
                const showData = await Show.findById(showId);
                if (!showData) {
                    res.write(`event: seats\n`);
                    res.write(`data: ${JSON.stringify({ error: "show not found" })}\n\n`);
                    return;
                }
                // cleanup expired holds then fetch fresh
                await cleanupExpiredHeldSeats(showData);

                const occupiedSeats = showData.occupiedSeats ? Object.keys(showData.occupiedSeats) : [];
                const heldMap = showData.heldSeats || {};
                const heldSeats = Object.keys(heldMap)
                    .filter(seat => {
                        const h = heldMap[seat];
                        return h?.expiresAt && new Date(h.expiresAt).getTime() > now;
                    })
                    .map(seat => {
                        const h = heldMap[seat];
                        return {
                            seat,
                            bookingId: h.bookingId,
                            user: h.user,
                            expiresAt: h.expiresAt,
                        };
                    });

                const payload = { occupiedSeats, heldSeats, timestamp: new Date().toISOString() };
                res.write(`event: seats\n`);
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            } catch (e) {
                console.error("seatsStream snapshot error:", e);
            }
        };

        // send initial snapshot
        await sendSnapshot();

        // then interval
        const iv = setInterval(async () => {
            if (closed) {
                clearInterval(iv);
                return;
            }
            await sendSnapshot();
        }, 5000); // every 5s

        // keep connection open until close
    } catch (error) {
        console.log("seatsStream error:", error?.message || error);
        try { res.end(); } catch (e) { }
    }
};

// GET /api/booking/:bookingId
export const getBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!bookingId) return res.status(400).json({ success: false, message: "bookingId required" });

        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: "Invalid bookingId" });
        }

        const booking = await Booking.findById(bookingId)
            .populate({
                path: "show",
                populate: {
                    path: "theater",
                    select: "name city address"
                }
            })
            .populate({
                path: "show",
                populate: {
                    path: "movie",
                    select: "title poster_path"
                }
            })
            .populate("user");
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

        // Authorization: only the booking owner can view their booking
        const { userId } = req.auth();
        if (userId && String(booking.user?._id || booking.user) !== String(userId)) {
            return res.status(403).json({ success: false, message: "Not authorized to view this booking" });
        }

        return res.json({ success: true, booking });
    } catch (error) {
        console.error("getBooking error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch booking" });
    }
};

// POST /api/booking/release
export const releaseBooking = async (req, res) => {
    try {
        // allow admin OR owner to release
        const { userId } = req.auth();
        const { bookingId } = req.body;
        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "bookingId is required"
            });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.json({ success: false, message: "Booking not found" });

        // Authorization: allow owner OR admin (adapt to your auth)
        if (String(booking.user) !== String(userId) && !req.user?.isAdmin) {
            // You can enforce admin-only here if desired.
            // For now we allow owner and admin; if neither, return unauthorized.
            return res.json({ success: false, message: "Not authorized to release this booking" });
        }

        // If booking already confirmed, do not release
        if (booking.status === "confirmed") {
            return res.json({ success: false, message: "Booking already confirmed" });
        }

        // mark booking cancelled
        booking.status = "cancelled";
        booking.expiresAt = new Date(Date.now() - 1000);
        await booking.save();

        // remove held seats from show
        const show = await Show.findById(booking.show);
        if (show && show.heldSeats) {
            let removed = false;
            for (const seat of (booking.seats || [])) {
                if (show.heldSeats[seat] && String(show.heldSeats[seat].bookingId) === String(booking._id)) {
                    delete show.heldSeats[seat];
                    removed = true;
                }
            }
            if (removed) {
                show.markModified("heldSeats");
                await show.save();
            }
        }

        return res.json({ success: true, message: "Released hold" });
    } catch (error) {
        console.error("releaseBooking error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to release booking" });
    }
};

// POST /api/booking/confirm
// Confirm a booking after payment. Body: { bookingId }
// This will mark booking as confirmed, set isPaid, status 'confirmed',
// move held seats into show.occupiedSeats and remove held seats.
export const confirmBooking = async (req, res) => {
    try {
        const { bookingId } = req.body;
        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "bookingId is required",
            });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.json({ success: false, message: "Booking not found" });
        }

        // already confirmed
        if (booking.status === "confirmed") {
            return res.json({ success: true, message: "Already confirmed" });
        }

        // expired check
        if (
            booking.expiresAt &&
            new Date(booking.expiresAt).getTime() <= Date.now() &&
            booking.status === "pending"
        ) {
            booking.status = "cancelled";
            await booking.save();
            return res.json({ success: false, message: "Booking expired" });
        }

        // ✅ MARK PAID (UNCHANGED)
        booking.status = "confirmed";
        booking.isPaid = true;
        booking.paymentLink = null;
        booking.paidAt = new Date();
        await booking.save();

        // 🔥 MOVE SEATS (UNCHANGED — DO NOT TOUCH)
        const show = await Show.findById(booking.show);
        if (!show) {
            return res.json({ success: true, message: "Confirmed (show missing)" });
        }

        if (!show.occupiedSeats) {
            show.occupiedSeats = {};
        }

        for (const seat of booking.seats || []) {
            show.occupiedSeats[seat] = booking.user.toString();

            if (show.heldSeats?.[seat]) {
                delete show.heldSeats[seat];
            }
        }

        show.markModified("occupiedSeats");
        show.markModified("heldSeats");
        await show.save();

        // 🔴 NEW: POPULATE & GENERATE TICKET
        const populatedBooking = await Booking.findById(booking._id)
            .populate({
                path: "show",
                populate: ["movie", "theater"],
            });

        const { url, path } = await generateTicketPdf(populatedBooking);

        booking.ticketUrl = url;
        booking.ticketPath = path;
        await booking.save();

        // background email / tasks
        try {
            await inngest.send({
                name: "app/show.booked",
                data: { bookingId: booking._id.toString() },
            });
        } catch (e) {
            console.error("inngest error:", e?.message || e);
        }

        // 🔴 send ticketUrl to frontend
        return res.json({
            success: true,
            message: "Booking confirmed",
            ticketUrl: booking.ticketUrl,
        });
    } catch (error) {
        console.error("confirmBooking error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to confirm booking" });
    }
};

// Admin: clear stuck bookings (scans pending bookings expired and releases them)
export const adminClearStuck = async (req, res) => {
    try {
        // protectAdmin middleware should be used on this route
        const now = new Date();
        // find bookings that are pending and expired
        const stuck = await Booking.find({ status: "pending", expiresAt: { $lte: now } });

        for (const b of stuck) {
            // mark cancelled
            b.status = "cancelled";
            await b.save();

            // remove held seats on the Show
            const show = await Show.findById(b.show);
            if (show && show.heldSeats) {
                let removed = false;
                for (const seat of (b.seats || [])) {
                    if (show.heldSeats[seat] && String(show.heldSeats[seat].bookingId) === String(b._id)) {
                        delete show.heldSeats[seat];
                        removed = true;
                    }
                }
                if (removed) {
                    show.markModified("heldSeats");
                    await show.save();
                }
            }
        }

        return res.json({ success: true, message: `Cleared ${stuck.length} stuck bookings` });
    } catch (error) {
        console.error("adminClearStuck error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to clear stuck bookings" });
    }
};

export const downloadTicketPdf = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId)
        .populate({
            path: "show",
            populate: "movie",
        });

    if (!booking || !booking.isPaid) {
        return res.status(403).send("Invalid ticket");
    }

    // optional expiry check
    const runtime = booking.show?.movie?.runtime;
    if (runtime) {
        const showStart = new Date(booking.show.showDateTime).getTime();
        const expiry = showStart + runtime * 60 * 1000 - 10 * 60 * 1000;
        if (Date.now() > expiry) {
            return res.status(410).send("Ticket expired");
        }
    }

    res.download(booking.ticketPath);
};