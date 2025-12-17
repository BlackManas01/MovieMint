// models/theaterModel.js
import mongoose from "mongoose";

const theaterSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },      // e.g. "PVR Infinity Mall"
        city: { type: String, required: true },      // e.g. "Mumbai"
        address: { type: String },                   // optional long address

        // Extra meta (optional but useful later)
        amenities: [{ type: String }],              // ["Recliner", "Dolby Atmos", "F&B"]
        formats: [{ type: String }],                // ["2D", "3D", "IMAX 2D", "4DX"]
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const Theater = mongoose.model("Theater", theaterSchema);

export default Theater;
