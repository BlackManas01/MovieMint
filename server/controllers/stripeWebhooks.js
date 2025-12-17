import stripe from "stripe";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

export const stripeWebhooks = async (request, response) => {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];

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

    console.log("🔥 STRIPE WEBHOOK HIT:", event.type);

    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const bookingId = session.metadata?.bookingId;

            if (!bookingId) {
                console.log("❌ bookingId missing");
                return response.json({ received: true });
            }

            const booking = await Booking.findById(bookingId);
            if (!booking) return response.json({ received: true });

            if (booking.isPaid && booking.status === "confirmed") {
                console.log("⚠️ already confirmed");
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

            console.log("✅ Seats occupied via webhook:", booking.seats);
        }
    } catch (err) {
        console.error("Webhook processing error:", err);
        response.status(500).send("Internal Server Error");
    }
};