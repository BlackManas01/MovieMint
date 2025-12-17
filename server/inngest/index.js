// inngest/index.js
import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

/**
 * Helpers
 */
const getShowDateValue = (show) => {
    // Different show schemas sometimes name the field differently.
    return show?.showDateTime || show?.showTime || show?.time || show?.dateTime || null;
};

/**
 * Sync user creation (from clerk)
 */
const syncUserCreation = inngest.createFunction(
    { id: "sync-user-from-clerk" },
    { event: "clerk/user.created" },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses?.[0]?.email_address,
            name: (first_name || "") + " " + (last_name || ""),
            image: image_url,
        };
        await User.create(userData);
    }
);

/**
 * Sync user deletion
 */
const syncUserDeletion = inngest.createFunction(
    { id: "delete-user-with-clerk" },
    { event: "clerk/user.deleted" },
    async ({ event }) => {
        const { id } = event.data;
        await User.findByIdAndDelete(id);
    }
);

/**
 * Sync user update
 */
const syncUserUpdation = inngest.createFunction(
    { id: "update-user-from-clerk" },
    { event: "clerk/user.updated" },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses?.[0]?.email_address,
            name: (first_name || "") + " " + (last_name || ""),
            image: image_url,
        };
        await User.findByIdAndUpdate(id, userData, { upsert: true });
    }
);

/**
 * releaseSeatsAndDeleteBooking
 *
 * Trigger: app/checkpayment
 * Behaviour:
 *  - Sleeps until booking.expiresAt if provided, else 10 minutes from event start
 *  - If booking not paid and still pending, marks booking cancelled and removes heldSeats entries on Show
 *  - Does NOT remove confirmed bookings
 */
const releaseSeatsAndDeleteBooking = inngest.createFunction(
    { id: "release-seats-delete-booking" },
    { event: "app/checkpayment" },
    async ({ event, step }) => {
        const bookingId = event.data?.bookingId;
        if (!bookingId) return;

        // Load booking early
        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        // Calculate sleepUntil time: prefer booking.expiresAt if present else 10 minutes from now
        const expiresAt = booking.expiresAt ? new Date(booking.expiresAt) : new Date(Date.now() + 10 * 60 * 1000);
        await step.sleepUntil("wait-until-expiry", expiresAt);

        // After waiting, re-check booking status & payment
        await step.run("check-and-release", async () => {
            const freshBooking = await Booking.findById(bookingId);
            if (!freshBooking) return;

            // If paid or already confirmed, nothing to do
            if (freshBooking.isPaid || freshBooking.status === "confirmed") {
                return;
            }

            // If still pending and expired -> cancel & release seats
            const now = Date.now();
            const expired = freshBooking.expiresAt ? new Date(freshBooking.expiresAt).getTime() <= now : true;
            if (!expired) {
                // If not expired yet, do nothing (shouldn't happen because we slept until expiresAt)
                return;
            }

            // mark booking cancelled (keep record)
            freshBooking.status = "cancelled";
            await freshBooking.save();

            // release held seats on related show (heldSeats map)
            const show = await Show.findById(freshBooking.show);
            if (show) {
                // heldSeats expected shape: { "A1": { bookingId, user, expiresAt }, ... }
                if (show.heldSeats && typeof show.heldSeats === "object") {
                    let modified = false;
                    const seatsList = Array.isArray(freshBooking.seats) && freshBooking.seats.length ? freshBooking.seats : (Array.isArray(freshBooking.bookedSeats) ? freshBooking.bookedSeats : []);
                    for (const seat of seatsList) {
                        if (show.heldSeats[seat] && String(show.heldSeats[seat].bookingId) === String(freshBooking._id)) {
                            delete show.heldSeats[seat];
                            modified = true;
                        }
                    }
                    if (modified) {
                        show.markModified("heldSeats");
                        await show.save();
                    }
                } else {
                    // fallback: if your show used occupiedSeats only before, try to remove from occupiedSeats if present and matches this user (less likely)
                    if (show.occupiedSeats && typeof show.occupiedSeats === "object") {
                        let mod = false;
                        const seatsList = Array.isArray(freshBooking.seats) && freshBooking.seats.length ? freshBooking.seats : (Array.isArray(freshBooking.bookedSeats) ? freshBooking.bookedSeats : []);
                        for (const seat of seatsList) {
                            if (show.occupiedSeats[seat] && String(show.occupiedSeats[seat]) === String(freshBooking.user)) {
                                delete show.occupiedSeats[seat];
                                mod = true;
                            }
                        }
                        if (mod) {
                            show.markModified("occupiedSeats");
                            await show.save();
                        }
                    }
                }
            }
        });
    }
);

/**
 * sendBookingConfirmationEmail
 *
 * Trigger: app/show.booked
 * Expects: event.data.bookingId
 */
const sendBookingConfirmationEmail = inngest.createFunction(
    { id: "send-booking-confirmation-email" },
    { event: "app/show.booked" },
    async ({ event }) => {
        const bookingId = event.data?.bookingId;
        if (!bookingId) return;

        const booking = await Booking.findById(bookingId)
            .populate({
                path: "show",
                populate: { path: "movie", model: "Movie" },
            })
            .populate("user");

        if (!booking) return;
        if (!booking.user || !booking.show) return;

        // determine show date/time
        const show = booking.show;
        const showDateVal = getShowDateValue(show);
        const showDateStr = showDateVal ? new Date(showDateVal).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" }) : "TBA";
        const showTimeStr = showDateVal ? new Date(showDateVal).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" }) : "TBA";

        await sendEmail({
            to: booking.user.email,
            subject: `Payment Confirmation: "${booking.show.movie?.title || 'Your show'}" booked!`,
            body: `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
                <h2>Hi ${booking.user.name},</h2>
                <p>Your booking for <strong style="color: #F84565;">"${booking.show.movie?.title || 'the show'}"</strong> is confirmed.</p>
                <p>
                  <strong>Date:</strong> ${showDateStr}<br/>
                  <strong>Time:</strong> ${showTimeStr}
                </p>
                <p>Seats: ${Array.isArray(booking.seats) ? booking.seats.join(", ") : (Array.isArray(booking.bookedSeats) ? booking.bookedSeats.join(", ") : "N/A")}</p>
                <p>Enjoy the show! 🍿</p>
                <p>Thanks for booking with us!<br/>— MovieMint Team</p>
              </div>`,
        });
    }
);

/**
 * sendShowReminders
 *
 * Cron every 8 hours — sends reminders for shows ~8 hours ahead
 */
const sendShowReminders = inngest.createFunction(
    { id: "send-show-reminders" },
    { cron: "0 */8 * * *" }, // Every 8 hours
    async ({ step }) => {
        const now = new Date();
        const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        // windowStart ensures we capture shows roughly at ~8 hours mark +/- 10 minutes
        const windowStart = new Date(in8Hours.getTime() - 10 * 60 * 1000);

        const reminderTasks = await step.run("prepare-reminder-tasks", async () => {
            // Try querying various date fields; pick the one you use in Show schema
            const shows = await Show.find({
                // if you have a unified field like showTime or showDateTime, replace accordingly
                $or: [
                    { showTime: { $gte: windowStart, $lte: in8Hours } },
                    { showDateTime: { $gte: windowStart, $lte: in8Hours } },
                    { time: { $gte: windowStart, $lte: in8Hours } },
                ],
            }).populate("movie");

            const tasks = [];

            for (const show of shows) {
                if (!show || !show.movie) continue;
                // show.occupiedSeats expected as an object map { seat: userId }
                if (!show.occupiedSeats || typeof show.occupiedSeats !== "object") continue;

                const userIds = [...new Set(Object.values(show.occupiedSeats))].filter(Boolean);
                if (!userIds.length) continue;

                const users = await User.find({ _id: { $in: userIds } }).select("name email");
                const showTime = getShowDateValue(show);

                for (const user of users) {
                    tasks.push({
                        userEmail: user.email,
                        userName: user.name,
                        movieTitle: show.movie.title,
                        showTime,
                    });
                }
            }
            return tasks;
        });

        if (!reminderTasks || reminderTasks.length === 0) {
            return { sent: 0, message: "No reminders to send." };
        }

        const results = await step.run("send-all-reminders", async () => {
            return await Promise.allSettled(
                reminderTasks.map((task) =>
                    sendEmail({
                        to: task.userEmail,
                        subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,
                        body: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                      <h2>Hello ${task.userName},</h2>
                      <p>This is a quick reminder that your movie:</p>
                      <h3 style="color: #F84565;">"${task.movieTitle}"</h3>
                      <p>
                        is scheduled for <strong>${task.showTime ? new Date(task.showTime).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" }) : "TBA"}</strong> at 
                        <strong>${task.showTime ? new Date(task.showTime).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" }) : "TBA"}</strong>.
                      </p>
                      <p>It starts in approximately <strong>8 hours</strong> - make sure you're ready!</p>
                      <br/>
                      <p>Enjoy the show!<br/>MovieMint Team</p>
                    </div>`,
                    })
                )
            );
        });

        const sent = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.length - sent;

        return {
            sent,
            failed,
            message: `Sent ${sent} reminder(s), ${failed} failed.`,
        };
    }
);

/**
 * sendNewShowNotifications
 */
const sendNewShowNotifications = inngest.createFunction(
    { id: "send-new-show-notifications" },
    { event: "app/show.added" },
    async ({ event }) => {
        const { movieTitle } = event.data;
        const users = await User.find({});

        for (const user of users) {
            const userEmail = user.email;
            const userName = user.name;

            const subject = `🎬 New Show Added: ${movieTitle}`;
            const body = `<div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Hi ${userName},</h2>
                    <p>We've just added a new show to our library:</p>
                    <h3 style="color: #F84565;">"${movieTitle}"</h3>
                    <p>Visit our website</p>
                    <br/>
                    <p>Thanks,<br/>MovieMint Team</p>
                  </div>`;

            await sendEmail({
                to: userEmail,
                subject,
                body,
            });
        }

        return { message: "Notifications sent." };
    }
);

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendShowReminders,
    sendNewShowNotifications,
];