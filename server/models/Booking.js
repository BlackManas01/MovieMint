// models/Booking.js
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    user: { type: String, required: true, ref: "User" },
    show: { type: String, required: true, ref: "Show" },
    amount: { type: Number, required: true },
    seats: { type: Array, required: true }, // seat IDs
    isPaid: { type: Boolean, default: false },
    paymentLink: { type: String },
    status: {
        type: String,
        enum: ["pending", "confirmed", "cancelled"],
        default: "pending",
    },
    expiresAt: { type: Date },
    ticketUrl: { type: String },
    ticketPath: { type: String },
}, { timestamps: true });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
