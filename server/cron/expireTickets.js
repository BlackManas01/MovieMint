// cron/expireTickets.js
import cron from "node-cron";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

cron.schedule("*/2 * * * *", async () => {
    const now = new Date();

    // 🔥 ONLY pending expired bookings
    const expired = await Booking.find({
        status: "pending",
        expiresAt: { $lte: now },
    });

    for (const booking of expired) {
        booking.status = "cancelled";
        await booking.save();

        const show = await Show.findById(booking.show);
        if (!show?.heldSeats) continue;

        for (const seat of booking.seats) {
            if (
                show.heldSeats[seat] &&
                String(show.heldSeats[seat].bookingId) === String(booking._id)
            ) {
                delete show.heldSeats[seat];
            }
        }

        show.markModified("heldSeats");
        await show.save();
    }

    console.log("✅ Expired holds cleaned. Occupied seats untouched.");
});