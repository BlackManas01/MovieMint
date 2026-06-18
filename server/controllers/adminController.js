// controllers/adminController.js - Admin dashboard, show listing, and booking management

import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import { adminClearStuck } from "./bookingController.js";

// GET /api/admin/is-admin - Returns true if the user passed the protectAdmin middleware
export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true });
};

/**
 * GET /api/admin/dashboard
 *
 * Lightweight dashboard data:
 *  - totalBookings  (paid bookings)
 *  - totalRevenue   (sum of booking.amount)
 *  - totalUser      (all users)
 *  - activeShows    (ONLY today's shows, minimal fields)
 */
export const getDashboardData = async (req, res) => {
    try {
        const now = new Date();

        // Build today's window: 00:00 -> 23:59:59.999
        const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0
        );
        const todayEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
        );

        // 1) Bookings + Users
        const [paidBookings, totalUser] = await Promise.all([
            Booking.find({ isPaid: true, deletedAt: null }).lean(),
            User.countDocuments(),
        ]);

        const totalBookings = paidBookings.length;
        const totalRevenue = paidBookings.reduce(
            (acc, b) => acc + (b.amount || 0),
            0
        );

        // 2) Only today's active (non-hidden) shows
        const activeShows = await Show.find({
            showDateTime: { $gte: todayStart, $lte: todayEnd },
            hidden: { $ne: true },
            isActive: { $ne: false },
        })
            .select(
                "movie theater showDateTime showPrice format experience" // only useful fields
            )
            .populate("movie", "title poster_path backdrop_path vote_average")
            .populate("theater", "name city address")
            .sort({ showDateTime: 1 })
            .lean();

        const dashboardData = {
            totalBookings,
            totalRevenue,
            activeShows,
            totalUser,
        };

        return res.json({ success: true, dashboardData });
    } catch (error) {
        console.error("getDashboardData error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Failed to fetch dashboard data" });
    }
};

/**
 * GET /api/admin/all-shows
 *
 * If some old pages still use this endpoint, keep it but make it safe:
 *  - Only today's shows
 *  - Minimal fields
 */
export const getAllShows = async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0
        );
        const todayEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
        );

        const shows = await Show.find({
            showDateTime: { $gte: todayStart, $lte: todayEnd },
        })
            .select(
                "movie theater showDateTime showPrice format experience hidden isActive"
            )
            .populate("movie", "title poster_path backdrop_path")
            .populate("theater", "name city address")
            .sort({ showDateTime: 1 })
            .lean();

        return res.json({ success: true, shows });
    } catch (error) {
        console.error("getAllShows error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Failed to fetch shows" });
    }
};

/**
 * GET /api/admin/all-bookings
 *
 * (unchanged, but kept here with error safety)
 */
export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ deletedAt: null })
            .populate("user", "name firstName lastName email")
            .populate({
                path: "show",
                populate: { path: "movie", select: "title" },
            })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, bookings });
    } catch (error) {
        console.error("getAllBookings error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Failed to fetch bookings" });
    }
};

/**
 * GET /api/admin/bin-bookings
 * Returns soft-deleted bookings (the Recycle Bin). Items are auto-purged
 * after 30 days by the cron job, so everything here is within retention.
 */
export const getBinBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ deletedAt: { $ne: null } })
            .populate("user", "name firstName lastName email")
            .populate({
                path: "show",
                populate: { path: "movie", select: "title" },
            })
            .sort({ deletedAt: -1 })
            .lean();

        return res.json({ success: true, bookings, retentionDays: 30 });
    } catch (error) {
        console.error("getBinBookings error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Failed to fetch bin" });
    }
};

/**
 * POST /api/admin/bookings/soft-delete
 * Body: { ids?: string[], fromDate?: ISO, toDate?: ISO }
 * Moves matching bookings into the Recycle Bin (sets deletedAt = now).
 * If `ids` is provided it takes precedence; otherwise a createdAt date range is used.
 */
export const softDeleteBookings = async (req, res) => {
    try {
        const { ids, fromDate, toDate } = req.body || {};
        const filter = { deletedAt: null };

        if (Array.isArray(ids) && ids.length) {
            filter._id = { $in: ids };
        } else if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        } else {
            return res
                .status(400)
                .json({ success: false, message: "Provide ids or a date range." });
        }

        const result = await Booking.updateMany(filter, {
            $set: { deletedAt: new Date() },
        });

        return res.json({
            success: true,
            movedToBin: result.modifiedCount ?? result.nModified ?? 0,
            message: "Bookings moved to Recycle Bin.",
        });
    } catch (error) {
        console.error("softDeleteBookings error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Failed to delete bookings" });
    }
};

/**
 * POST /api/admin/bookings/restore
 * Body: { ids: string[] }  (omit/empty ids to restore the entire bin)
 * Restores bookings from the Recycle Bin (sets deletedAt = null).
 */
export const restoreBookings = async (req, res) => {
    try {
        const { ids } = req.body || {};
        const filter = { deletedAt: { $ne: null } };
        if (Array.isArray(ids) && ids.length) filter._id = { $in: ids };

        const result = await Booking.updateMany(filter, {
            $set: { deletedAt: null },
        });

        return res.json({
            success: true,
            restored: result.modifiedCount ?? result.nModified ?? 0,
            message: "Bookings restored.",
        });
    } catch (error) {
        console.error("restoreBookings error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Failed to restore bookings" });
    }
};

/**
 * DELETE /api/admin/bookings/purge
 * Body: { ids?: string[] }  (omit to permanently empty the whole bin)
 * Permanently removes soft-deleted bookings. This cannot be undone.
 */
export const purgeBin = async (req, res) => {
    try {
        const { ids } = req.body || {};
        const filter = { deletedAt: { $ne: null } };
        if (Array.isArray(ids) && ids.length) filter._id = { $in: ids };

        const result = await Booking.deleteMany(filter);

        return res.json({
            success: true,
            purged: result.deletedCount ?? 0,
            message: "Bin emptied permanently.",
        });
    } catch (error) {
        console.error("purgeBin error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Failed to purge bin" });
    }
};
/**
 * GET /api/admin/shows-by-date?date=YYYY-MM-DD
 *
 * Returns:
 *  - One row per movie for that calendar day
 *  - Aggregated stats:
 *      • showsCount
 *      • bookingsCount
 *      • earnings
 *      • firstShowTime / lastShowTime (for display)
 *  - Also returns all slots for that movie+day so the UI
 *    can show a theater-wise breakdown in the "View slots" modal.
 */
export const getShowsByDate = async (req, res) => {
    try {
        const { date } = req.query; // expecting "YYYY-MM-DD"

        if (!date) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Query param 'date' (YYYY-MM-DD) is required",
                });
        }

        // 🔹 LOCAL day window: 00:00 – next day 00:00 (same style as getMovieSchedule / MovieDetails)
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        // 🔹 Saare shows us din ke (sirf active)
        const shows = await Show.find({
            showDateTime: {
                $gte: dayStart,
                $lt: dayEnd,
            },
            isActive: { $ne: false }, // ShowDetails / getMovieSchedule ke jaisa
        })
            .populate("movie")
            .populate("theater")
            .sort({ showDateTime: 1 });

        // Group by movie
        const byMovie = new Map();

        for (const show of shows) {
            const movie = show.movie;
            if (!movie) continue;

            const movieId = String(movie._id);

            if (!byMovie.has(movieId)) {
                byMovie.set(movieId, {
                    movieId,
                    movieTitle: movie.title || "Untitled",
                    poster_path: movie.poster_path,
                    backdrop_path: movie.backdrop_path,
                    vote_average: movie.vote_average,
                    // aggregated stats
                    showsCount: 0,
                    bookingsCount: 0,
                    earnings: 0,
                    firstShowTime: show.showDateTime,
                    lastShowTime: show.showDateTime,
                    // detailed slots for modal
                    slots: [],
                });
            }

            const entry = byMovie.get(movieId);

            // Count shows
            entry.showsCount += 1;

            // Count bookings (number of occupied seats)
            const occupied = show.occupiedSeats || {};
            const bookedCount = Object.keys(occupied).length;
            entry.bookingsCount += bookedCount;

            // Earnings = booked seats * price
            const price = show.showPrice || 0;
            entry.earnings += bookedCount * price;

            // Track first / last show time
            if (show.showDateTime < entry.firstShowTime) {
                entry.firstShowTime = show.showDateTime;
            }
            if (show.showDateTime > entry.lastShowTime) {
                entry.lastShowTime = show.showDateTime;
            }

            // Push slot for modal
            entry.slots.push({
                _id: show._id,
                time: show.showDateTime,
                showPrice: show.showPrice || 0,
                hidden: !!show.hidden,
                theaterId: show.theater?._id || null,
                theaterName: show.theater?.name || "",
                theaterCity: show.theater?.city || "",
                theaterAddress: show.theater?.address || "",
                format: show.format || "2D",          // default safe
                experience: show.experience || "Standard", // default safe
                occupiedSeats: show.occupiedSeats || {},
            });
        }

        // Convert Map -> array and sort by movie title
        const summaries = Array.from(byMovie.values()).sort((a, b) =>
            (a.movieTitle || "").localeCompare(b.movieTitle || "")
        );

        return res.json({
            success: true,
            date,
            summaries,
        });
    } catch (error) {
        console.error("getShowsByDate error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch shows summary for this date",
        });
    }
};

export const clearStuckBookings = async (req, res) => {
    return adminClearStuck(req, res);
};

export const cleanupExtraTimings = async (req, res) => {
    try {
        const now = new Date();

        // 👉 ALL future shows (no isAutoGenerated filter)
        const shows = await Show.find({
            showDateTime: { $gte: now },
        }).sort({ showDateTime: 1 });

        const map = new Map();

        // Group: movie + theater + date
        for (const show of shows) {
            const date = show.showDateTime.toISOString().split("T")[0];
            const key = `${show.movie}-${show.theater}-${date}`;

            if (!map.has(key)) map.set(key, []);
            map.get(key).push(show);
        }

        let deleteIds = [];

        for (const [, group] of map) {
            if (group.length <= 10) continue;

            // ✅ KEEP FIRST 8–10 (chronological)
            const keepCount = Math.min(
                group.length,
                Math.floor(Math.random() * 3) + 8 // 8–10
            );

            const keep = group.slice(0, keepCount);
            const keepIds = new Set(keep.map(s => String(s._id)));

            group.forEach(s => {
                if (!keepIds.has(String(s._id))) {
                    deleteIds.push(s._id);
                }
            });
        }

        if (deleteIds.length) {
            await Show.deleteMany({ _id: { $in: deleteIds } });
        }

        return res.json({
            success: true,
            deleted: deleteIds.length,
            message: "Extra timings cleaned successfully",
        });
    } catch (err) {
        console.error("cleanupExtraTimings error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};
