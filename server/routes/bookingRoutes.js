// src/routes/bookingRouter.js
import express from "express";
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
bookingRouter.post("/create", createBooking);

// Release a pending booking (owner or admin). Body: { bookingId }
bookingRouter.post("/release", releaseBooking);

// Confirm a booking after payment. Body: { bookingId }
bookingRouter.post("/confirm", confirmBooking);

bookingRouter.get("/:bookingId/ticket", downloadTicketPdf);

// SSE stream for seats updates (query: ?showId=...)
bookingRouter.get("/seats/stream", seatsStream);

// Get seats snapshot for a show (returns confirmed occupied seats + pending held seats)
bookingRouter.get("/seats/:showId", getSeatsForShow);

// Get booking by id (used by review page / frontend)
bookingRouter.get("/:bookingId", getBooking);

bookingRouter.post("/confirm-booking", confirmBooking);

export default bookingRouter;