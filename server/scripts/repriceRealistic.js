// scripts/repriceRealistic.js
// One-time migration: re-price all existing movies & shows to realistic INR values.
// Usage: node scripts/repriceRealistic.js
import "dotenv/config";
import mongoose from "mongoose";
import Show from "../models/Show.js";
import Movie from "../models/Movie.js";

const FORMAT_DEFAULT_PRICES = {
    "2D": 180,
    "3D": 230,
    "IMAX 2D": 400,
    "4DX-3D": 550,
};
const DEFAULT_BASE = 180;

const run = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI not set");
    }
    await mongoose.connect(`${process.env.MONGODB_URI}/moviemint`);
    console.log("✓ Connected to MongoDB");

    // 1) Update every movie's per-format pricing + fallback.
    const movies = await Movie.find({}).select("_id");
    for (const m of movies) {
        await Movie.updateOne(
            { _id: m._id },
            { $set: { priceByFormat: FORMAT_DEFAULT_PRICES, defaultShowPrice: DEFAULT_BASE } }
        );
    }
    console.log(`✓ Updated ${movies.length} movies' priceByFormat`);

    // 2) Re-price every show by its format.
    let updated = 0;
    for (const [format, price] of Object.entries(FORMAT_DEFAULT_PRICES)) {
        const r = await Show.updateMany({ format }, { $set: { showPrice: price } });
        updated += r.modifiedCount || 0;
    }
    // Shows with an unknown/missing format → base default.
    const r2 = await Show.updateMany(
        { format: { $nin: Object.keys(FORMAT_DEFAULT_PRICES) } },
        { $set: { showPrice: DEFAULT_BASE } }
    );
    updated += r2.modifiedCount || 0;
    console.log(`✓ Re-priced ${updated} shows`);

    await mongoose.disconnect();
    console.log("✓ Done");
};

run().catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
});
