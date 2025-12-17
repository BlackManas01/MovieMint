import Stripe from "stripe";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
    try {
        const { bookingId, showId, seats } = req.body;
        const userId = req.user._id;

        if (!showId || !seats || !seats.length) {
            return res.json({
                success: false,
                message: "Invalid booking data",
            });
        }

        let booking;

        // 1️⃣ If booking already exists
        if (bookingId) {
            booking = await Booking.findById(bookingId);
            if (!booking) {
                return res.json({ success: false, message: "Booking not found" });
            }
            if (booking.isPaid) {
                return res.json({ alreadyPaid: true });
            }
        }

        // 2️⃣ Create booking if not exists
        if (!booking) {
            booking = await Booking.create({
                user: userId,
                show: showId,
                seats,
                status: "pending",
                isPaid: false,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            });

            // move seats to heldSeats
            const show = await Show.findById(showId);
            if (!show.heldSeats) show.heldSeats = {};

            seats.forEach((seat) => {
                show.heldSeats[seat] = {
                    bookingId: booking._id,
                    user: userId,
                    expiresAt: booking.expiresAt,
                };
            });

            show.markModified("heldSeats");
            await show.save();
        }

        // 3️⃣ Create Stripe session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: req.user.email,
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Movie Ticket Booking",
                        },
                        unit_amount: booking.amount * 100 || 1000,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                bookingId: booking._id.toString(),
            },
            success_url: `${process.env.CLIENT_URL}/my-bookings`,
            cancel_url: `${process.env.CLIENT_URL}/review-booking/${booking._id}`,
        });

        booking.paymentLink = session.url;
        await booking.save();

        res.json({ url: session.url });
    } catch (err) {
        console.error("Stripe session error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to create Stripe session",
        });
    }
};