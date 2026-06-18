// models/Movie.js - Movie schema (data synced from TMDB + admin config)
import mongoose from "mongoose";

const movieSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },                      // TMDB movie ID
        title: { type: String, required: true },                    // Movie title
        overview: { type: String, required: true },                 // Plot summary
        poster_path: { type: String, required: true },              // TMDB poster image path
        backdrop_path: { type: String, required: true },            // TMDB backdrop image path
        release_date: { type: String, required: true },             // Release date (YYYY-MM-DD)
        original_language: { type: String },                        // e.g., "en", "hi"
        tagline: { type: String },                                  // Movie tagline
        genres: { type: Array, required: true },                    // Array of genre objects
        casts: { type: Array, required: true },                     // Array of cast members
        vote_average: { type: Number, required: true },             // TMDB rating (0-10)
        runtime: { type: Number, required: true },                  // Duration in minutes

        // Admin configuration fields
        hiddenFromHome: {                                           // Hide from "Now in Theaters" section
            type: Boolean,
            default: false,
        },
        showTimesTemplate: {                                        // Default time slots for auto-scheduling
            type: [String],
            default: ["10:00", "13:00", "16:00", "19:00", "22:00"],
        },
        priceByFormat: {                                            // Per-format pricing (e.g., { "2D": 19, "3D": 29 })
            type: Object,
            default: {},
        },
        autoScheduleEnabled: { type: Boolean, default: true },      // Allow auto-generation of shows
        autoShowsInitialized: {                                     // Flag: default shows already created
            type: Boolean,
            default: false,
        },
        defaultShowPrice: { type: Number, default: 180 },            // Fallback price per ticket
    },
    { timestamps: true }
);

const Movie = mongoose.model("Movie", movieSchema);

export default Movie;
