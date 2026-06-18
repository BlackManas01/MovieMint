// models/Booking.js - Booking schema for ticket reservations
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    user: { type: String, required: true, ref: "User" },       // Clerk user ID
    show: { type: String, required: true, ref: "Show" },       // Show being booked
    amount: { type: Number, required: true },                   // Total price paid
    seats: { type: Array, required: true },                     // Array of seat IDs (e.g., ["A1", "A2"])
    isPaid: { type: Boolean, default: false },                  // Whether payment is confirmed
    paymentLink: { type: String },                              // Stripe checkout URL
    status: {                                                   // Booking lifecycle status
        type: String,
        enum: ["pending", "confirmed", "cancelled"],
        default: "pending",
    },
    expiresAt: { type: Date },                                  // Hold expiry (seats released after this)
    ticketUrl: { type: String },                                // Public URL to download ticket PDF
    ticketPath: { type: String },                               // Server file path to ticket PDF
    userSnapshot: {                                             // Snapshot of user info at booking time
        name: String,
        email: String
    },
    deletedAt: { type: Date, default: null },                  // Soft-delete timestamp (Recycle Bin); auto-purged after 30 days
}, { timestamps: true });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
