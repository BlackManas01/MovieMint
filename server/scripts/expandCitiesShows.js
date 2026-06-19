// scripts/expandCitiesShows.js
// Safe, idempotent migration: add the new theaters from seedTheaters and give
// each NEW theater a realistic but lightweight set of showtimes.
//
// Design choices that keep us within MongoDB free-tier limits:
//  - Existing theaters & their shows are never touched (matched by name+city).
//  - Only theaters with NO future shows get backfilled (re-running is safe).
//  - Limited window (WINDOW_DAYS) and few slots/day instead of 120 days.
//
// Usage:  node scripts/expandCitiesShows.js
import "dotenv/config";
import mongoose from "mongoose";
import Show from "../models/Show.js";
import Movie from "../models/Movie.js";
import Theater from "../models/theaterModel.js";
import { seedTheaters } from "../../client/src/assets/seedTheaters.js";

const WINDOW_DAYS = 14;      // how far ahead to schedule new-theater shows
const SLOTS_PER_DAY = 6;     // shows per theater per day

const TIME_POOL = [
    "09:30", "11:45", "13:25", "14:45", "16:15", "18:30", "20:45", "22:30",
];

const EXPERIENCE_FORMAT_PAIRS = [
    { experience: "Laser", format: "2D" },
    { experience: "IMAX", format: "IMAX 2D" },
    { experience: "Dolby Atmos", format: "3D" },
    { experience: "Insignia", format: "4DX-3D" },
    { experience: "4DX", format: "4DX-3D" },
];

const FORMAT_DEFAULT_PRICES = {
    "2D": 180,
    "3D": 230,
    "IMAX 2D": 400,
    "4DX-3D": 550,
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const buildDateTime = (baseDate, timeStr) => {
    const [hh, mm] = timeStr.split(":").map(Number);
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hh, mm, 0, 0);
};

const run = async () => {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI not set");
    await mongoose.connect(`${process.env.MONGODB_URI}/moviemint`);
    console.log("✓ Connected to MongoDB");

    /* 1) Upsert theaters (keep existing, add new) — idempotent by name+city. */
    let added = 0;
    for (const t of seedTheaters) {
        const res = await Theater.updateOne(
            { name: t.name, city: t.city },
            {
                $set: {
                    name: t.name,
                    city: t.city,
                    address: t.area || "",
                    amenities: t.experience ? [t.experience] : [],
                    isActive: true,
                },
                $setOnInsert: { formats: t.defaultFormat ? [t.defaultFormat] : ["2D"] },
            },
            { upsert: true }
        );
        if (res.upsertedCount) added++;
    }
    console.log(`✓ Theaters synced (${added} newly added, ${seedTheaters.length} total in catalog)`);

    /* 2) Find theaters that have NO future shows → these need a backfill. */
    const now = new Date();
    const theaters = await Theater.find({ isActive: { $ne: false } }).select("_id name city");
    const theatersToFill = [];
    for (const th of theaters) {
        const future = await Show.exists({ theater: th._id, showDateTime: { $gte: now } });
        if (!future) theatersToFill.push(th);
    }
    console.log(`✓ ${theatersToFill.length} theater(s) need showtimes`);
    if (!theatersToFill.length) {
        console.log("Nothing to backfill. Done.");
        await mongoose.disconnect();
        process.exit(0);
    }

    /* 3) Generate a light window of shows for each empty theater. */
    const movies = await Movie.find({ release_date: { $exists: true, $ne: null } })
        .select("_id release_date defaultShowPrice");
    console.log(`✓ Scheduling across ${movies.length} movies`);

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);

    let totalInserted = 0;
    for (const th of theatersToFill) {
        const batch = [];
        for (const movie of movies) {
            const release = new Date(movie.release_date);
            const start = now > release ? now : release;
            if (start > windowEnd) continue; // movie opens after our window

            const dayCursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            for (; dayCursor <= windowEnd; dayCursor.setDate(dayCursor.getDate() + 1)) {
                // pick SLOTS_PER_DAY distinct times for this day
                const times = [...TIME_POOL].sort(() => 0.5 - Math.random()).slice(0, SLOTS_PER_DAY).sort();
                for (const time of times) {
                    const dt = buildDateTime(dayCursor, time);
                    if (dt <= now) continue; // never create past shows
                    const pair = pickRandom(EXPERIENCE_FORMAT_PAIRS);
                    batch.push({
                        movie: movie._id,
                        theater: th._id,
                        showDateTime: dt,
                        showPrice: FORMAT_DEFAULT_PRICES[pair.format] || movie.defaultShowPrice || 180,
                        format: pair.format,
                        experience: pair.experience,
                        language: "English",
                        isActive: true,
                        hidden: false,
                        isAutoGenerated: true,
                        occupiedSeats: {},
                    });
                }
            }
        }
        if (batch.length) {
            await Show.insertMany(batch, { ordered: false });
            totalInserted += batch.length;
            console.log(`  • ${th.name} (${th.city}): +${batch.length} shows`);
        }
    }

    console.log(`\n✓ Done. Inserted ${totalInserted} shows across ${theatersToFill.length} theaters.`);
    await mongoose.disconnect();
    process.exit(0);
};

run().catch((err) => {
    console.error("Expand-cities migration failed:", err);
    process.exit(1);
});
