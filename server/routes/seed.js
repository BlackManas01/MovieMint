// server/routes/seed.js

import express from "express";
import Theater from "../models/theaterModel.js";

// NOTE: This import assumes the folder structure:
// QuickShow-FullStack/
//   client/src/assets/seedTheaters.js
//   server/routes/seed.js (this file)
import { seedTheaters } from "../../client/src/assets/seedTheaters.js";

const router = express.Router();

/**
 * Seed basic theater data into the database.
 *
 * - This endpoint is intended for development/initial setup only.
 * - It clears all existing Theater documents to avoid duplicates
 *   and then inserts a clean set from `seedTheaters`.
 */
router.get("/seed-theaters", async (req, res) => {
    try {
        // Remove existing theaters to ensure a consistent baseline.
        await Theater.deleteMany({});

        // Map the client-side seed data to the Theater schema fields.
        const docs = seedTheaters.map((t) => ({
            name: t.name,
            city: t.city,
            // `area` from client seed is mapped into `address` in the Theater model.
            address: t.area,
            // Store the "experience" text inside amenities so we can display it later.
            amenities: t.experience ? [t.experience] : [],
            // Wrap the defaultFormat in an array to match the `formats: [String]` schema.
            formats: t.defaultFormat ? [t.defaultFormat] : ["2D"],
            isActive: true,
        }));

        const inserted = await Theater.insertMany(docs);

        return res.json({
            success: true,
            count: inserted.length,
            theaters: inserted,
            message: "Theaters seeded successfully.",
        });
    } catch (err) {
        console.error("Theater seeding error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to seed theaters.",
            error: err.message,
        });
    }
});

export default router;
