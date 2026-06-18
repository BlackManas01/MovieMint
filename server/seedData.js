// seedData.js - One-time script to populate theaters, movies, and shows.
// Run with: node seedData.js   (from the server/ folder)
// Safe to delete after seeding. Does NOT modify any existing app code.

import 'dotenv/config';
import dns from 'node:dns';
import axios from 'axios';
import mongoose from 'mongoose';
import Theater from './models/theaterModel.js';
import Movie from './models/Movie.js';
import { ensureDefaultShowsForMovie } from './controllers/showController.js';
import { seedTheaters } from '../client/src/assets/seedTheaters.js';

// Prefer IPv6 so outbound TMDB requests use the WARP-tunneled IPv6 path
// (the IPv4 path is still reset by ISP DPI).
dns.setDefaultResultOrder('ipv6first');

const tmdb = axios.create({
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
});

const run = async () => {
    await mongoose.connect(`${process.env.MONGODB_URI}/moviemint`);
    console.log('Connected to DB');

    // 1) Seed theaters (only if none exist)
    const theaterCount = await Theater.countDocuments();
    if (theaterCount === 0) {
        const docs = seedTheaters.map((t) => ({
            name: t.name,
            city: t.city,
            address: t.area,
            amenities: t.experience ? [t.experience] : [],
            formats: t.defaultFormat ? [t.defaultFormat] : ['2D'],
            isActive: true,
        }));
        await Theater.insertMany(docs);
        console.log(`Seeded ${docs.length} theaters`);
    } else {
        console.log(`Theaters already present (${theaterCount}), skipping`);
    }

    // 2) Pull TMDB now-playing movies
    const { data } = await tmdb.get(
        'https://api.themoviedb.org/3/movie/now_playing?page=1'
    );
    const nowPlaying = data.results || [];
    console.log(`TMDB returned ${nowPlaying.length} now-playing movies`);

    // 3) Ensure each movie + its default shows exist
    for (const tmdbMovie of nowPlaying) {
        const movieId = String(tmdbMovie.id);

        let movie = await Movie.findById(movieId);
        if (!movie) {
            const [details, credits] = await Promise.all([
                tmdb.get(`https://api.themoviedb.org/3/movie/${movieId}`),
                tmdb.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`),
            ]);
            const m = details.data;
            movie = await Movie.create({
                _id: movieId,
                title: m.title,
                overview: m.overview,
                poster_path: m.poster_path,
                backdrop_path: m.backdrop_path,
                genres: m.genres,
                casts: credits.data.cast,
                release_date: m.release_date,
                original_language: m.original_language,
                tagline: m.tagline || '',
                vote_average: m.vote_average,
                runtime: m.runtime,
            });
            console.log(`Created movie: ${movie.title}`);
        }

        await ensureDefaultShowsForMovie(movie, 120);
    }

    console.log('Seeding complete');
    await mongoose.disconnect();
    process.exit(0);
};

run().catch((err) => {
    console.error('Seeding failed:', err?.response?.status, err?.response?.data || err);
    process.exit(1);
});
