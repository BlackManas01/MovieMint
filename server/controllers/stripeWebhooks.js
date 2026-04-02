// controllers/stripeWebhooks.js - Handles Stripe webhook events (payment confirmation)
import stripe from "stripe";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

// POST /api/stripe - Stripe webhook handler for checkout.session.completed events
// Confirms booking, moves held seats to occupied, and triggers ticket generation
export const stripeWebhooks = async (request, response) => {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];

    // Verify webhook signature to ensure it's from Stripe
    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(
            request.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        return response.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const bookingId = session.metadata?.bookingId;

            if (!bookingId) {
                return response.json({ received: true });
            }

            const booking = await Booking.findById(bookingId);
            if (!booking) return response.json({ received: true });

            if (booking.isPaid && booking.status === "confirmed") {
                return response.json({ received: true });
            }

            booking.isPaid = true;
            booking.status = "confirmed";
            booking.paymentLink = "";
            await booking.save();

            const show = await Show.findById(booking.show);
            if (!show) return response.json({ received: true });

            if (!show.occupiedSeats) show.occupiedSeats = {};
            if (!show.heldSeats) show.heldSeats = {};

            booking.seats.forEach((seat) => {
                show.occupiedSeats[seat] = booking.user.toString();

                if (
                    show.heldSeats[seat] &&
                    String(show.heldSeats[seat].bookingId) === String(booking._id)
                ) {
                    delete show.heldSeats[seat];
                }
            });

            show.markModified("occupiedSeats");
            show.markModified("heldSeats");
            await show.save();

            await inngest.send({
                name: "app/show.booked",
                data: { bookingId },
            });
        }

        return response.json({ received: true });
    } catch (err) {
        console.error("Webhook processing error:", err);
        return response.status(500).send("Internal Server Error");
    }
};