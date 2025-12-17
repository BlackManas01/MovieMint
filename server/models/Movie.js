import mongoose from "mongoose";

const movieSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },
        title: { type: String, required: true },
        overview: { type: String, required: true },
        poster_path: { type: String, required: true },
        backdrop_path: { type: String, required: true },
        release_date: { type: String, required: true },
        original_language: { type: String },
        tagline: { type: String },
        genres: { type: Array, required: true },
        casts: { type: Array, required: true },
        vote_average: { type: Number, required: true },
        runtime: { type: Number, required: true },

        hiddenFromHome: {
            type: Boolean,
            default: false,
        },

        showTimesTemplate: {
            type: [String],
            default: ["10:00", "13:00", "16:00", "19:00", "22:00"],
        },
        priceByFormat: {
            type: Object,
            default: {},
        },

        autoScheduleEnabled: { type: Boolean, default: true },
        autoShowsInitialized: {
            type: Boolean,
            default: false,
        },

        defaultShowPrice: { type: Number, default: 29 },
    },
    { timestamps: true }
);

const Movie = mongoose.model("Movie", movieSchema);

export default Movie;
