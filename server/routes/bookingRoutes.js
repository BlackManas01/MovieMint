// routes/bookingRoutes.js - Booking API routes (create, confirm, release, seats, ticket download)
import express from "express";
import rateLimit from "express-rate-limit";
import {
    createBooking,
    releaseBooking,
    confirmBooking,
    getSeatsForShow,
    seatsStream,
    getBooking,
    downloadTicketPdf,
} from "../controllers/bookingController.js";

const bookingRouter = express.Router();

// Rate limit for booking creation: 5 requests per minute per IP
const bookingCreateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { success: false, message: "Too many booking attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Note:
 * - SSE: GET /api/booking/seats/stream?showId=...
 *   This should be mounted before the /seats/:showId route to avoid path collisions.
 *
 * - Snapshot: GET /api/booking/seats/:showId
 *
 * - Booking detail: GET /api/booking/:bookingId
 *   Put this after the /seats routes so the :bookingId param doesn't capture "seats".
 */

/* ----------------------- booking routes ----------------------- */

// Create a pending booking / hold (returns bookingId, expiresAt, paymentLink if available)
bookingRouter.post("/create", bookingCreateLimiter, createBooking);

// Release a pending booking (owner or admin). Body: { bookingId }
bookingRouter.post("/release", releaseBooking);

// Confirm a booking after payment. Body: { bookingId }
bookingRouter.post("/confirm-booking", confirmBooking);

bookingRouter.get("/:bookingId/ticket", downloadTicketPdf);

// SSE stream for seats updates (query: ?showId=...)
bookingRouter.get("/seats/stream", seatsStream);

// Get seats snapshot for a show (returns confirmed occupied seats + pending held seats)
bookingRouter.get("/seats/:showId", getSeatsForShow);

// Get booking by id (used by review page / frontend)
bookingRouter.get("/:bookingId", getBooking);

export default bookingRouter;