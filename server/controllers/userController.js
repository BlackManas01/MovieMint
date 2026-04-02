// controllers/userController.js - Handles user-specific operations (bookings, favorites)
import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";


// GET /api/user/bookings - Fetch all bookings for the authenticated user
export const getUserBookings = async (req, res) => {
    try {
        const user = req.auth().userId;

        const bookings = await Booking.find({ user })
            .sort({ createdAt: -1 })
            .populate({
                path: "show",
                populate: [
                    {
                        path: "movie",
                        select: "title poster_path runtime"
                    },
                    {
                        path: "theater",
                        select: "name city address"
                    }
                ]
            });
        res.json({ success: true, bookings })
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
}

// POST /api/user/update-favorite - Toggle a movie in the user's favorites list (stored in Clerk metadata)
export const updateFavorite = async (req, res) => {
    try {
        const { movieId } = req.body;
        const userId = req.auth().userId;

        const user = await clerkClient.users.getUser(userId)

        if (!user.privateMetadata.favorites) {
            user.privateMetadata.favorites = []
        }

        if (!user.privateMetadata.favorites.includes(movieId)) {
            user.privateMetadata.favorites.push(movieId)
        } else {
            user.privateMetadata.favorites = user.privateMetadata.favorites.filter(item => item !== movieId)
        }

        await clerkClient.users.updateUserMetadata(userId, { privateMetadata: user.privateMetadata })

        res.json({ success: true, message: "Favorite movies updated" })
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
}

// GET /api/user/favorites - Retrieve user's favorite movies from Clerk metadata
export const getFavorites = async (req, res) => {
    try {
        const user = await clerkClient.users.getUser(req.auth().userId)
        const favorites = user.privateMetadata.favorites;

        // Getting movies from database
        const movies = await Movie.find({ _id: { $in: favorites } })

        res.json({ success: true, movies })
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
}