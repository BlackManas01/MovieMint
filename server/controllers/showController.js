import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";
import Theater from "../models/theaterModel.js";

/* -------------------------------------------------------------------------- */
/*                                HELPERS                                     */
/* -------------------------------------------------------------------------- */

// In-memory cache to avoid running auto-scheduling multiple times
// for the same movie and window within a single server process.
const autoScheduleCache = new Set();
const VISIBLE_WINDOW_DAYS = 7;
const AUTO_SCHEDULE_DAYS = 120;

const localDayWindow = (dateIso) => {
    // dateIso expected "YYYY-MM-DD"
    const start = new Date(dateIso);
    start.setHours(0, 0, 0, 0);          // local midnight of that day
    const end = new Date(start);
    end.setDate(end.getDate() + 1);   // next day local midnight
    return { start, end };
};

const buildDateTime = (baseDateIso, timeStr) => {
    // baseDateIso = "YYYY-MM-DD", timeStr = "HH:mm"
    const [hh, mm] = timeStr.split(":").map(Number);
    const parts = baseDateIso.split("-");
    const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
    const dt = new Date(y, m, d, hh, mm, 0, 0); // local time
    return dt;
};


const ensureMovieInDbFromTmdb = async (movieId) => {
    // Try existing movie from DB
    let movie = await Movie.findById(movieId);
    if (movie) return movie;

    // Otherwise pull from TMDB and create
    const headers = { Authorization: `Bearer ${process.env.TMDB_API_KEY}` };

    const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, { headers }),
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
            headers,
        }),
    ]);

    const movieApiData = movieDetailsResponse.data;
    const movieCreditsData = movieCreditsResponse.data;

    const movieDetails = {
        _id: movieId, // TMDB id ko as-is use kar rahe
        title: movieApiData.title,
        overview: movieApiData.overview,
        poster_path: movieApiData.poster_path,
        backdrop_path: movieApiData.backdrop_path,
        genres: movieApiData.genres,
        casts: movieCreditsData.cast,
        release_date: movieApiData.release_date,
        original_language: movieApiData.original_language,
        tagline: movieApiData.tagline || "",
        vote_average: movieApiData.vote_average,
        runtime: movieApiData.runtime,
    };

    movie = await Movie.create(movieDetails);
    return movie;
};

// Default daily time slots (24h format)
const DEFAULT_TIMES = [
    "09:10",
    "09:30",
    "10:00",
    "10:30",
    "10:50",
    "11:45",
    "12:35",
    "13:25",
    "14:00",
    "14:15",
    "14:45",
    "16:15",
    "18:30",
    "20:45",
    "22:30",
    "23:55",
];

// ----------------- FORMATS + EXPERIENCES (NEW LOGIC) ----------------------

// Experience → Format mapping
//  Laser       → 2D
//  IMAX        → IMAX 2D
//  Dolby Atmos → 3D
//  Insignia    → 4DX-3D
//  4DX         → 4DX-3D
const EXPERIENCE_FORMAT_PAIRS = [
    { experience: "Laser", format: "2D" },
    { experience: "IMAX", format: "IMAX 2D" },
    { experience: "Dolby Atmos", format: "3D" },
    { experience: "Insignia", format: "4DX-3D" },
    { experience: "4DX", format: "4DX-3D" },
];

// 4 supported formats (used for pricing UI etc.)
const SUPPORTED_FORMATS = [...new Set(EXPERIENCE_FORMAT_PAIRS.map(p => p.format))];

// 5 experiences (agar kahi list / dropdown me chahiye)
const EXPERIENCES = EXPERIENCE_FORMAT_PAIRS.map(p => p.experience);

// Some sensible defaults (fallback)
const FORMAT_DEFAULT_PRICES = {
    "2D": 19,
    "3D": 29,
    "IMAX 2D": 39,
    "4DX-3D": 59,
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

/*
 * Ensures default shows for a movie across all theaters for the next `days` days
 * starting from max(today, releaseDate).
 *
 * Optimizations:
 * - Uses an in-memory cache so the same movie + days combination is not
 *   re-scheduled multiple times per server process.
 * - Loads existing shows only once for the movie and date window.
 * - Uses an in-memory Set to avoid duplicate show creation.
 * - Performs a single bulk insert (`insertMany`) instead of many `create` calls.
 * - Uses per-format pricing: movie.priceByFormat[format] → defaultShowPrice → 250
 */
export const ensureDefaultShowsForMovie = async (movie, days = 90) => {
    if (!movie || !movie.release_date) return;

    // ⛔ already initialized → skip
    if (movie.autoShowsInitialized) return;

    const today = new Date();
    const release = new Date(movie.release_date);

    const start = today > release ? today : release;
    const end = new Date(release);
    end.setDate(end.getDate() + days);

    if (start > end) return;

    const theaters = await Theater.find({ isActive: { $ne: false } });
    if (!theaters.length) return;

    // existing shows (DB level safety)
    const existingShows = await Show.find({
        movie: movie._id,
        showDateTime: { $gte: start, $lte: end },
    }).select("theater showDateTime");

    const existingSet = new Set(
        existingShows.map(
            s => `${s.theater}-${s.showDateTime.toISOString()}`
        )
    );

    const showsToInsert = [];
    const now = new Date();

    const FIRST_TIME = DEFAULT_TIMES[0]; // "09:10"
    const LAST_TIME = DEFAULT_TIMES[DEFAULT_TIMES.length - 1]; // "23:55"
    const MIDDLE_TIMES = DEFAULT_TIMES.slice(1, -1); // between

    for (
        let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        d <= end;
        d.setDate(d.getDate() + 1)
    ) {
        const dateStr = d.toISOString().split("T")[0];

        for (const theater of theaters) {
            // 🔒 per theater + day safety
            const localSet = new Set();

            // 🎯 total shows = 8–10
            const totalCount = Math.floor(Math.random() * 3) + 10; // 8,9,10
            const middleCount = Math.max(totalCount - 2, 0); // after first+last

            // 🎲 pick RANDOM middle times
            const shuffledMiddle = [...MIDDLE_TIMES].sort(
                () => 0.5 - Math.random()
            );

            const pickedMiddle = shuffledMiddle.slice(0, middleCount);

            // ✅ final ordered list
            const dayTimes = [
                FIRST_TIME,
                ...pickedMiddle.sort(),
                LAST_TIME,
            ];

            for (const t of dayTimes) {
                const dt = buildDateTime(dateStr, t);

                const key = `${theater._id}-${dt.toISOString()}`;
                if (existingSet.has(key)) continue;
                if (localSet.has(key)) continue;

                localSet.add(key);
                existingSet.add(key);

                const pair = pickRandom(EXPERIENCE_FORMAT_PAIRS);

                showsToInsert.push({
                    movie: movie._id,
                    theater: theater._id,
                    showDateTime: dt,
                    showPrice: movie.defaultShowPrice || 250,
                    format: pair.format,
                    experience: pair.experience,
                    isActive: true,
                    hidden: false,
                    isAutoGenerated: true,
                    occupiedSeats: {},
                });
            }
        }
    }

    if (showsToInsert.length) {
        await Show.insertMany(showsToInsert, { ordered: false });
        console.log(`ensureDefaultShowsForMovie: Created ${showsToInsert.length} show(s) for movie ${movie.title}`);
    }
    movie.autoShowsInitialized = true;
    await movie.save();
};

const fetchWithRetry = async (url, headers, retries = 5, delay = 1000) => {
    try {
        return await axios.get(url, { headers });
    } catch (err) {
        if (retries === 0) throw err;
        console.log(`Retry fetching URL — attempts left: ${retries}`);
        await new Promise((res) => setTimeout(res, delay));
        return fetchWithRetry(url, headers, retries - 1, delay);
    }
};

/* -------------------------------------------------------------------------- */
/*                             TMDB: NOW PLAYING                              */
/* -------------------------------------------------------------------------- */

export const getNowPlayingMovies = async (req, res) => {
    try {
        const headers = { Authorization: `Bearer ${process.env.TMDB_API_KEY}` };

        let { region } = req.query;
        if (region && typeof region === "string") {
            region = region.toUpperCase();
            if (region.length !== 2) region = undefined;
        }

        const baseUrl = "https://api.themoviedb.org/3/movie/now_playing";
        const url = region ? `${baseUrl}?page=1&region=${region}` : `${baseUrl}?page=1`;

        const { data } = await fetchWithRetry(url, headers);

        const movies = data.results || [];
        res.json({ success: true, movies });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const getNowPlayingMovieDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const headers = {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        };

        const [detailsRes, creditsRes, videosRes, imagesRes, similarRes] =
            await Promise.all([
                fetchWithRetry(`https://api.themoviedb.org/3/movie/${id}`, headers),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/credits`,
                    headers
                ),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/videos`,
                    headers
                ),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/images?include_image_language=en,null`,
                    headers
                ),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/similar`,
                    headers
                ),
            ]);

        const movie = detailsRes.data;
        const credits = creditsRes.data;
        const videos = videosRes.data;
        const images = imagesRes.data;
        const similar = similarRes.data.results || [];

        const trailer = videos.results?.find(
            (v) => v.type === "Trailer" && v.site === "YouTube"
        );

        res.json({
            success: true,
            movie: {
                ...movie,
                casts: credits.cast?.slice(0, 12) || [],
                trailer: trailer
                    ? `https://www.youtube.com/watch?v=${trailer.key}`
                    : null,
                images,
                similar: similar.slice(0, 10),
            },
        });
    } catch (err) {
        console.log("Failed after multiple retries ➜", err.message);
        res.status(500).json({ success: false, message: "TMDB slow, try again" });
    }
};

/* -------------------------------------------------------------------------- */
/*                               TMDB: UPCOMING                               */
/* -------------------------------------------------------------------------- */

export const getUpcomingMovies = async (req, res) => {
    try {
        let allMovies = [];
        let page = 1;
        const maxPages = 8;

        const headers = { Authorization: `Bearer ${process.env.TMDB_API_KEY}` };

        let { region } = req.query;
        if (region && typeof region === "string") {
            region = region.toUpperCase();
            if (region.length !== 2) region = undefined;
        }

        while (page <= maxPages) {
            const baseUrl = `https://api.themoviedb.org/3/movie/upcoming?page=${page}`;
            const url = region ? `${baseUrl}&region=${region}` : baseUrl;

            const { data } = await fetchWithRetry(url, headers);

            if (!data?.results?.length) break;

            allMovies.push(...data.results);
            page++;
        }

        res.json({ success: true, movies: allMovies });
    } catch (err) {
        console.error("Upcoming Movies Fetch Error:", err.message);
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch upcoming movies" });
    }
};

export const getUpcomingMovieDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const headers = {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        };

        const [detailsRes, creditsRes, videosRes, imagesRes, similarRes] =
            await Promise.all([
                fetchWithRetry(`https://api.themoviedb.org/3/movie/${id}`, headers),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/credits`,
                    headers
                ),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/videos`,
                    headers
                ),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/images?include_image_language=en,null`,
                    headers
                ),
                fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${id}/similar`,
                    headers
                ),
            ]);

        const movie = detailsRes.data;
        const credits = creditsRes.data;
        const videos = videosRes.data;
        const images = imagesRes.data;
        const similar = similarRes.data.results || [];

        const trailer = videos.results?.find(
            (v) => v.type === "Trailer" && v.site === "YouTube"
        );

        res.json({
            success: true,
            movie: {
                ...movie,
                casts: credits.cast?.slice(0, 12) || [],
                trailer: trailer
                    ? `https://www.youtube.com/watch?v=${trailer.key}`
                    : null,
                images,
                similar: similar.slice(0, 10),
            },
        });
    } catch (err) {
        console.log("Failed after multiple retries ➜", err.message);
        res.status(500).json({ success: false, message: "TMDB slow, try again" });
    }
};

/* -------------------------------------------------------------------------- */
/*                          TMDB: GENERIC FULL DETAILS                        */
/* -------------------------------------------------------------------------- */

export const getTmdbMovieDetails = async (req, res) => {
    try {
        const { movieId } = req.params;
        const fast = req.query.fast;
        const extras = req.query.extras;
        const headers = {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        };

        // Only Basic Details (Fast Load)
        if (fast) {
            const [movieRes, creditsRes] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, { headers }),
                axios.get(
                    `https://api.themoviedb.org/3/movie/${movieId}/credits`,
                    { headers }
                ),
            ]);

            return res.json({
                success: true,
                movie: movieRes.data,
                credits: creditsRes.data,
            });
        }

        // Heavy Media = Load Later
        if (extras) {
            const [videosRes, imagesRes, similarRes] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/videos`, {
                    headers,
                }),
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/images`, {
                    headers,
                }),
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/similar`, {
                    headers,
                }),
            ]);

            return res.json({
                success: true,
                videos: videosRes.data.results,
                images: imagesRes.data,
                similar: similarRes.data.results,
            });
        }

        return res.json({ success: false, message: "Invalid query" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

/* -------------------------------------------------------------------------- */
/*                       TMDB: TRAILERS (NOW / UPCOMING / BOTH)               */
/* -------------------------------------------------------------------------- */

export const getNowPlayingTrailers = async (req, res) => {
    try {
        const headers = {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        };

        let { region } = req.query;
        if (region && typeof region === "string") {
            region = region.toUpperCase();
            if (region.length !== 2) region = undefined;
        }

        const baseUrl = "https://api.themoviedb.org/3/movie/now_playing?page=1";
        const url = region ? `${baseUrl}&region=${region}` : baseUrl;

        const nowRes = await fetchWithRetry(url, headers);
        const nowPlaying = (nowRes.data.results || []).slice(0, 15);

        const trailerPromises = nowPlaying.map(async (movie) => {
            try {
                const videosRes = await fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${movie.id}/videos`,
                    headers
                );

                const trailer = videosRes.data.results?.find(
                    (v) => v.type === "Trailer" && v.site === "YouTube"
                );

                if (!trailer) return null;

                return {
                    id: movie.id,
                    title: movie.title,
                    image: movie.backdrop_path || movie.poster_path,
                    videoUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
                };
            } catch (err) {
                console.log(
                    "Now-playing trailer fetch failed for",
                    movie.id,
                    err.message
                );
                return null;
            }
        });

        let trailers = await Promise.all(trailerPromises);
        trailers = trailers.filter(Boolean);

        return res.json({ success: true, trailers });
    } catch (err) {
        console.log("Failed after multiple retries ➜", err.message);
        return res
            .status(500)
            .json({ success: false, message: "TMDB slow, try again" });
    }
};

export const getUpcomingTrailers = async (req, res) => {
    try {
        const headers = {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        };

        let { region } = req.query;
        if (region && typeof region === "string") {
            region = region.toUpperCase();
            if (region.length !== 2) region = undefined;
        }

        const baseUrl = "https://api.themoviedb.org/3/movie/upcoming?page=1";
        const url = region ? `${baseUrl}&region=${region}` : baseUrl;

        const upcomingRes = await fetchWithRetry(url, headers);
        const upcoming = (upcomingRes.data.results || []).slice(0, 10);

        const trailerPromises = upcoming.map(async (movie) => {
            try {
                const videosRes = await fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${movie.id}/videos`,
                    headers
                );

                const trailer = videosRes.data.results?.find(
                    (v) => v.type === "Trailer" && v.site === "YouTube"
                );

                if (!trailer) return null;

                return {
                    id: movie.id,
                    title: movie.title,
                    image: movie.backdrop_path || movie.poster_path,
                    videoUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
                };
            } catch (err) {
                console.log(
                    "Upcoming trailer fetch failed for",
                    movie.id,
                    err.message
                );
                return null;
            }
        });

        let trailers = await Promise.all(trailerPromises);
        trailers = trailers.filter(Boolean);

        return res.json({ success: true, trailers });
    } catch (err) {
        console.log("Failed after multiple retries ➜", err.message);
        return res
            .status(500)
            .json({ success: false, message: "TMDB slow, try again" });
    }
};

export const getCombinedTrailers = async (req, res) => {
    try {
        const headers = {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        };

        let { region } = req.query;
        if (region && typeof region === "string") {
            region = region.toUpperCase();
            if (region.length !== 2) region = undefined;
        }

        const nowBase = "https://api.themoviedb.org/3/movie/now_playing?page=1";
        const upcomingBase = "https://api.themoviedb.org/3/movie/upcoming?page=1";

        const nowUrl = region ? `${nowBase}&region=${region}` : nowBase;
        const upcomingUrl = region
            ? `${upcomingBase}&region=${region}`
            : upcomingBase;

        const [nowRes, upcomingRes] = await Promise.all([
            fetchWithRetry(nowUrl, headers),
            fetchWithRetry(upcomingUrl, headers),
        ]);

        const nowMovies = (nowRes.data.results || []).slice(0, 10);
        const upcomingMovies = (upcomingRes.data.results || []).slice(0, 10);

        const fetchTrailerForMovie = async (movie, tag) => {
            try {
                const videosRes = await fetchWithRetry(
                    `https://api.themoviedb.org/3/movie/${movie.id}/videos`,
                    headers
                );

                const trailer = videosRes.data.results?.find(
                    (v) => v.type === "Trailer" && v.site === "YouTube"
                );

                if (!trailer) return null;

                return {
                    id: movie.id,
                    title: movie.title,
                    image: movie.backdrop_path || movie.poster_path,
                    videoUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
                    source: tag,
                };
            } catch (err) {
                console.log(
                    `Trailer fetch failed for ${tag} movie`,
                    movie.id,
                    err.message
                );
                return null;
            }
        };

        const nowTrailerPromises = nowMovies.map((m) =>
            fetchTrailerForMovie(m, "now")
        );
        const upcomingTrailerPromises = upcomingMovies.map((m) =>
            fetchTrailerForMovie(m, "upcoming")
        );

        let [nowTrailers, upcomingTrailers] = await Promise.all([
            Promise.all(nowTrailerPromises),
            Promise.all(upcomingTrailerPromises),
        ]);

        nowTrailers = nowTrailers.filter(Boolean);
        upcomingTrailers = upcomingTrailers.filter(Boolean);

        const combined = [...nowTrailers, ...upcomingTrailers];

        return res.json({ success: true, trailers: combined });
    } catch (err) {
        console.log("Failed after multiple retries ➜", err.message);
        return res
            .status(500)
            .json({ success: false, message: "TMDB slow, try again" });
    }
};

/* -------------------------------------------------------------------------- */
/*                              ADMIN: ADD SHOW                               */
/* -------------------------------------------------------------------------- */

export const addShow = async (req, res) => {
    try {
        const { movieId, showsInput, showPrice } = req.body;

        // ✅ Reuse helper instead of duplicating TMDB logic
        const movie = await ensureMovieInDbFromTmdb(movieId);

        const showsToCreate = [];

        (showsInput || []).forEach((show) => {
            const showDate = show.date;
            (show.time || []).forEach((time) => {
                const dateTimeString = `${showDate}T${time}`;
                showsToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(dateTimeString),
                    showPrice,
                    occupiedSeats: {},
                });
            });
        });

        if (showsToCreate.length > 0) {
            await Show.insertMany(showsToCreate);
        }

        await inngest.send({
            name: "app/show.added",
            data: { movieTitle: movie.title },
        });

        res.json({ success: true, message: "Show Added successfully." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// ADMIN: Sync TMDB now_playing -> Movie DB + generate default shows for all theaters
export const syncNowPlayingToDbAndGenerateShows = async (req, res) => {
    try {
        const headers = { Authorization: `Bearer ${process.env.TMDB_API_KEY}` };

        // Optional region support (?region=IN etc.)
        let { region } = req.query;
        if (region && typeof region === "string") {
            region = region.toUpperCase();
            if (region.length !== 2) region = undefined;
        }

        const baseUrl = "https://api.themoviedb.org/3/movie/now_playing?page=1";
        const url = region ? `${baseUrl}&region=${region}` : baseUrl;

        const { data } = await fetchWithRetry(url, headers);
        const nowPlaying = data.results || [];

        if (!nowPlaying.length) {
            return res.json({
                success: true,
                movies: [],
                message: "No now_playing movies returned from TMDB.",
            });
        }

        const importedMovies = [];

        // Process each TMDB now-playing movie.
        for (const tmdbMovie of nowPlaying) {
            const movieId = String(tmdbMovie.id);

            // 1) Ensure movie exists in MongoDB.
            const movie = await ensureMovieInDbFromTmdb(movieId);

            // 2) Ensure auto-generated shows exist for up to 120 days from release.
            await ensureDefaultShowsForMovie(movie, 120);

            importedMovies.push(movie);
        }

        // Sort by latest release date first.
        importedMovies.sort((a, b) => {
            const ad = new Date(a.release_date || "1970-01-01");
            const bd = new Date(b.release_date || "1970-01-01");
            return bd - ad;
        });

        return res.json({
            success: true,
            movies: importedMovies,
            count: importedMovies.length,
            message:
                "Synced TMDB now_playing movies into DB and generated default shows.",
        });
    } catch (err) {
        console.error("syncNowPlayingToDbAndGenerateShows error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to sync now_playing movies",
        });
    }
};

/* -------------------------------------------------------------------------- */
/*                     ADMIN: NOW IN THEATERS (MOVIE LIST)                    */
/* -------------------------------------------------------------------------- */
// ADMIN: Now in Theaters (only movies that have shows in next VISIBLE_WINDOW_DAYS)
export const getAdminNowInTheatersMovies = async (req, res) => {
    try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const visibleEnd = new Date(now);
        visibleEnd.setDate(visibleEnd.getDate() + (VISIBLE_WINDOW_DAYS - 1));
        visibleEnd.setHours(23, 59, 59, 999);

        // find distinct movie ids that have shows inside the admin-visible window
        const movieIds = await Show.distinct("movie", {
            showDateTime: { $gte: now, $lte: visibleEnd },
            isActive: { $ne: false },
        });

        if (!movieIds.length) {
            return res.json({ success: true, movies: [], message: "No movies with shows in the 7-day window." });
        }

        const movies = await Movie.find({
            _id: { $in: movieIds },
            hiddenFromHome: { $ne: true },
        }).sort({ release_date: -1 });

        return res.json({ success: true, movies });
    } catch (err) {
        console.error("getAdminNowInTheatersMovies error:", err);
        return res.json({ success: false, message: err.message });
    }
};


// Old adminGetNowInTheaters (router me import ho raha hai) → same logic reuse
export const adminGetNowInTheaters = async (req, res) => {
    return getAdminNowInTheatersMovies(req, res);
};

// Toggle movie visibility for home "Now in Theaters"
export const updateMovieHomeVisibility = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { hidden } = req.body;

        const movie = await Movie.findByIdAndUpdate(
            movieId,
            { hiddenFromHome: !!hidden },
            { new: true }
        );

        if (!movie) {
            return res.json({ success: false, message: "Movie not found" });
        }

        res.json({
            success: true,
            movie,
            message: hidden
                ? "Movie hidden from Now in Theaters."
                : "Movie visible on Now in Theaters.",
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: err.message });
    }
};

/* -------------------------------------------------------------------------- */
/*                ADMIN: PER-MOVIE SHOWS (ShowDetails Drawer)                 */
/* -------------------------------------------------------------------------- */

export const getMovieShowsAdmin = async (req, res) => {
    try {
        const { movieId } = req.params;

        const now = new Date();
        const visibleEnd = new Date(now);
        visibleEnd.setDate(visibleEnd.getDate() + (VISIBLE_WINDOW_DAYS - 1));

        const shows = await Show.find({
            movie: movieId,
            showDateTime: { $gte: now, $lte: visibleEnd },
        }).sort({ showDateTime: 1 });

        return res.json({ success: true, shows });
    } catch (err) {
        console.error("getMovieShowsAdmin error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Shows fetch error" });
    }
};


export const updateShowActiveStatus = async (req, res) => {
    try {
        const { showId } = req.params;
        const { isActive } = req.body;

        const show = await Show.findByIdAndUpdate(
            showId,
            { isActive: !!isActive },
            { new: true }
        );

        if (!show) {
            return res.json({ success: false, message: "Show not found" });
        }

        res.json({
            success: true,
            show,
            message: isActive ? "Show enabled" : "Show hidden",
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: err.message });
    }
};

export const toggleShowHidden = async (req, res) => {
    try {
        const { showId } = req.params;
        const { hidden } = req.body;

        const show = await Show.findByIdAndUpdate(
            showId,
            { hidden: !!hidden },
            { new: true }
        );

        if (!show) {
            return res.json({ success: false, message: "Show not found" });
        }

        return res.json({ success: true, show });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: err.message });
    }
};

// Hide/unhide all shows for a movie (and hide from home)
export const hideMovieShows = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { hidden } = req.body;

        const movie = await Movie.findByIdAndUpdate(
            movieId,
            { hiddenFromHome: !!hidden },
            { new: true }
        );
        if (!movie) {
            return res.json({ success: false, message: "Movie not found" });
        }

        const now = new Date();

        await Show.updateMany(
            { movie: movieId, showDateTime: { $gte: now } },
            { hidden: !!hidden }
        );

        return res.json({
            success: true,
            movie,
            message: hidden
                ? "All upcoming shows for this movie are now hidden."
                : "Movie shows are visible again.",
        });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: err.message });
    }
};

// Hide/unhide all shows for a movie on a given date (YYYY-MM-DD)
export const hideDateForMovie = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { date, hidden } = req.body;

        if (!date) {
            return res.json({ success: false, message: "Date is required" });
        }

        // const dayStart = new Date(`${date}T00:00:00.000Z`);
        // const dayEnd = new Date(dayStart);
        // dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        const { start: dayStart, end: dayEnd } = localDayWindow(date);

        const result = await Show.updateMany(
            {
                movie: movieId,
                showDateTime: { $gte: dayStart, $lt: dayEnd },
            },
            { hidden: !!hidden }
        );

        res.json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: hidden
                ? `Hidden ${result.modifiedCount} show(s) on ${date}`
                : `Unhidden ${result.modifiedCount} show(s) on ${date}`,
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: err.message });
    }
};

// Hide/unhide shows for a specific theater.
// - If `date` is provided, only that calendar day's shows are affected.
// - If `date` is omitted, all upcoming shows for this theater are affected.
export const hideShowsByTheater = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { theaterId, hidden, date } = req.body;

        if (!theaterId) {
            return res.json({ success: false, message: "theaterId is required" });
        }

        // Base filter: same movie + same theater
        const filter = {
            movie: movieId,
            theater: theaterId,
        };

        if (date) {
            // Apply filter only for that specific calendar day in UTC
            const dayStart = new Date(`${date}T00:00:00.000Z`);
            const dayEnd = new Date(dayStart);
            dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

            filter.showDateTime = { $gte: dayStart, $lt: dayEnd };
        } else {
            // Fallback: all upcoming shows for this theater
            const now = new Date();
            filter.showDateTime = { $gte: now };
        }

        const result = await Show.updateMany(filter, { hidden: !!hidden });

        return res.json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: hidden
                ? "Selected theater's shows have been hidden."
                : "Selected theater's shows have been made visible.",
        });
    } catch (err) {
        console.error("hideShowsByTheater error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Failed to update shows" });
    }
};


/* -------------------------------------------------------------------------- */
/*                       ADMIN: TIME TEMPLATE (LEGACY)                        */
/* -------------------------------------------------------------------------- */
/*  Ye tum ab use nahi kar rahe, lekin router me import ho raha hai isliye
    simple version rakh raha hoon. Agar future me time template chahiye ho
    to isko use kar sakte ho.                                           */

export const updateTimeTemplate = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { times, autoScheduleEnabled, defaultShowPrice } = req.body;

        const update = {};
        if (Array.isArray(times) && times.length) {
            update.showTimesTemplate = times;
        }
        if (typeof autoScheduleEnabled === "boolean") {
            update.autoScheduleEnabled = autoScheduleEnabled;
        }
        if (typeof defaultShowPrice === "number") {
            update.defaultShowPrice = defaultShowPrice;
        }

        const movie = await Movie.findByIdAndUpdate(movieId, update, { new: true });

        if (!movie) {
            return res.json({ success: false, message: "Movie not found" });
        }

        res.json({
            success: true,
            movie,
            message: "Time template updated",
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: err.message });
    }
};

// Legacy auto-generate using template (agar kabhi chahiye ho)
export const generateAutoShows = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { days, fromDate, showPrice } = req.body || {};

        const movie = await Movie.findById(movieId);
        if (!movie) {
            return res.json({ success: false, message: "Movie not found" });
        }

        if (!movie.release_date) {
            return res.json({
                success: false,
                message: "Movie release_date is missing",
            });
        }

        const template = movie.showTimesTemplate || [];
        if (!template.length) {
            return res.json({
                success: false,
                message: "Movie has no time template configured",
            });
        }

        if (movie.autoScheduleEnabled === false) {
            return res.json({
                success: false,
                message: "Auto scheduling disabled for this movie",
            });
        }

        const releaseDate = new Date(movie.release_date);
        releaseDate.setHours(0, 0, 0, 0);

        const releaseEnd = new Date(releaseDate);
        releaseEnd.setDate(releaseEnd.getDate() + 30);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let start = fromDate ? new Date(fromDate) : today;
        start.setHours(0, 0, 0, 0);
        if (start < releaseDate) start = new Date(releaseDate);

        const requestedDays = Number(days) || 30;
        let end = new Date(start);
        end.setDate(end.getDate() + requestedDays - 1);

        if (end > releaseEnd) end = releaseEnd;

        if (start > releaseEnd) {
            return res.json({
                success: false,
                message: "Requested window is after the 30-day release window",
            });
        }

        const priceToUse =
            typeof showPrice === "number"
                ? showPrice
                : movie.defaultShowPrice || 29;

        const existingShows = await Show.find({
            movie: movieId,
            showDateTime: { $gte: start, $lte: end },
        });

        const existingSet = new Set(
            existingShows.map((s) => s.showDateTime.toISOString())
        );

        const showsToCreate = [];

        const cursor = new Date(start);
        while (cursor <= end) {
            const dateStr = cursor.toISOString().split("T")[0];

            for (const timeStr of template) {
                const dateTime = new Date(`${dateStr}T${timeStr}:00.000Z`);
                const iso = dateTime.toISOString();

                if (!existingSet.has(iso)) {
                    showsToCreate.push({
                        movie: movieId,
                        showDateTime: dateTime,
                        showPrice: priceToUse,
                        occupiedSeats: {},
                        hidden: false,
                        isAutoGenerated: true,
                    });
                }
            }

            cursor.setDate(cursor.getDate() + 1);
        }

        let created = [];
        if (showsToCreate.length) {
            created = await Show.insertMany(showsToCreate);
        }

        res.json({
            success: true,
            createdCount: created.length,
            message:
                created.length > 0
                    ? `Generated ${created.length} show(s) for this movie`
                    : "No new shows were needed (all slots already exist)",
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: err.message });
    }
};

/* -------------------------------------------------------------------------- */
/*                             ADMIN: DELETE SHOW                             */
/* -------------------------------------------------------------------------- */

export const deleteShow = async (req, res) => {
    try {
        const { showId } = req.params;
        await Show.findByIdAndDelete(showId);
        res.json({ success: true, message: "Show deleted successfully" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

/* -------------------------------------------------------------------------- */
/*                      PUBLIC: HOME / MOVIES PAGE LIST                       */
/* -------------------------------------------------------------------------- */

export const getShows = async (req, res) => {
    try {
        const now = new Date();
        const visibleEnd = new Date(now);
        visibleEnd.setDate(visibleEnd.getDate() + (VISIBLE_WINDOW_DAYS - 1));

        // Only shows in the next 7 days, visible and active
        const dbShows = await Show.find({
            showDateTime: { $gte: now, $lte: visibleEnd },
            hidden: { $ne: true },
            isActive: { $ne: false },
        })
            // minimal movie projection to keep documents smaller
            .populate("movie", "title poster_path backdrop_path release_date vote_average hiddenFromHome genres")
            .sort({ showDateTime: 1 });

        // Unique movies (respect movie.hiddenFromHome)
        const movieMap = new Map();

        dbShows.forEach((show) => {
            const movie = show.movie;
            if (!movie) return;

            if (movie.hiddenFromHome) return;

            const key = String(movie._id);
            if (!movieMap.has(key)) {
                movieMap.set(key, movie);
            }
        });

        res.json({
            success: true,
            shows: Array.from(movieMap.values()),
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

/**
 * GET /api/show/:movieId
 *
 * Used by USER side (MovieDetails screen).
 * Behaviour:
 *  - Ensures movie exists (imports from TMDB if needed).
 *  - Ensures default shows exist up to release + 120 days.
 *  - Returns a strict 7-day rolling window from TODAY.
 *  - Hidden shows are excluded for users.
 */
export const getShow = async (req, res) => {
    try {
        const { movieId } = req.params;

        // 1) Ensure movie exists (same as before)
        let movie = await Movie.findById(movieId);

        if (!movie) {
            const headers = { Authorization: `Bearer ${process.env.TMDB_API_KEY}` };

            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, { headers }),
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
                    headers,
                }),
            ]);

            const movieApiData = movieDetailsResponse.data;
            const movieCreditsData = movieCreditsResponse.data;

            const movieDetails = {
                _id: movieId,
                title: movieApiData.title,
                overview: movieApiData.overview,
                poster_path: movieApiData.poster_path,
                backdrop_path: movieApiData.backdrop_path,
                genres: movieApiData.genres,
                casts: movieCreditsData.cast,
                release_date: movieApiData.release_date,
                original_language: movieApiData.original_language,
                tagline: movieApiData.tagline || "",
                vote_average: movieApiData.vote_average,
                runtime: movieApiData.runtime,
            };

            movie = await Movie.create(movieDetails);
        }

        // 2) Ensure default shows for next N days
        await ensureDefaultShowsForMovie(movie, AUTO_SCHEDULE_DAYS);

        const now = new Date();
        const visibleEnd = new Date(now);
        visibleEnd.setDate(visibleEnd.getDate() + (VISIBLE_WINDOW_DAYS - 1));

        // 3) Load only shows in the visible window
        const shows = await Show.find({
            movie: movie._id,
            showDateTime: { $gte: now, $lte: visibleEnd },
            isActive: { $ne: false },
        })
            .populate("theater")
            .sort({ showDateTime: 1 });

        const dateTime = {};

        shows.forEach((show) => {
            // ❶ Do not show hidden slots to the end user
            if (show.hidden) return;

            // ❷ Ignore legacy shows that do not have a valid theater attached
            if (!show.theater || !show.theater.name) return;

            const iso = show.showDateTime.toISOString();
            const [date] = iso.split("T");

            if (!dateTime[date]) dateTime[date] = [];

            dateTime[date].push({
                time: show.showDateTime,
                showId: show._id,
                showPrice: show.showPrice,
                hidden: show.hidden || false,

                theaterId: show.theater._id,
                theaterName: show.theater.name,
                theaterCity: show.theater.city,
                theaterAddress: show.theater.address,

                format: show.format,
                experience: show.experience,
            });
        });

        return res.json({
            success: true,
            movie,
            dateTime,
        });
    } catch (error) {
        console.error("getShow error:", error);
        return res.json({ success: false, message: error.message });
    }
};


/* -------------------------------------------------------------------------- */
/*                       ADMIN: ADD THEATER SLOT MANUAL                       */
/* -------------------------------------------------------------------------- */

export const addTheaterSlot = async (req, res) => {
    try {
        const { movieId } = req.params;
        let { theaterId, date, time, showPrice, format, experience } = req.body;

        const movie = await Movie.findById(movieId);
        if (!movie) {
            return res.json({ success: false, message: "Movie not found" });
        }

        const theater = await Theater.findById(theaterId);
        if (!theater) {
            return res.json({ success: false, message: "Theater not found" });
        }

        const dt = buildDateTime(date, time);

        const exists = await Show.findOne({
            movie: movieId,
            theater: theaterId,
            showDateTime: dt,
        });

        if (exists) {
            return res.json({ success: false, message: "Show already exists" });
        }

        // 🔹 4DX ko normalize karke 4DX-3D treat karo
        const normalizeFormat = (fmt) =>
            fmt === "4DX" ? "4DX-3D" : fmt;

        if (format) format = normalizeFormat(format);

        // 🔹 Pair resolve karo:
        //  - Agar experience diya hai → uska pair
        //  - Warna agar format diya hai → format ka pair
        //  - Warna random pair
        let pair = null;

        if (experience) {
            pair = EXPERIENCE_FORMAT_PAIRS.find(
                (p) => p.experience === experience
            );
        }

        if (!pair && format) {
            pair = EXPERIENCE_FORMAT_PAIRS.find(
                (p) => p.format === format
            );
        }

        if (!pair) {
            pair = pickRandom(EXPERIENCE_FORMAT_PAIRS);
        }

        const finalFormat = pair.format;
        const finalExperience = pair.experience;

        const show = await Show.create({
            movie: movieId,
            theater: theaterId,
            showDateTime: dt,
            showPrice: showPrice || 250,
            format: finalFormat,
            experience: finalExperience,
            isActive: true,
            hidden: false,
            autoGenerated: false,
        });

        return res.json({ success: true, show });
    } catch (err) {
        console.error(err);
        return res
            .status(500)
            .json({ success: false, message: "Failed to add theater slot" });
    }
};

/* -------------------------------------------------------------------------- */
/*                      ADMIN: GENERATE FOR ALL RECENT MOVIES                 */
/* -------------------------------------------------------------------------- */

export const generateShowsForAllRecentMovies = async (req, res) => {
    try {
        const DAYS_BACK = 90;

        const today = new Date();
        const cutoff = new Date(today);
        cutoff.setDate(today.getDate() - DAYS_BACK);

        const movies = await Movie.find({
            release_date: {
                $gte: cutoff.toISOString().slice(0, 10),
                $lte: today.toISOString().slice(0, 10),
            },
        });

        for (const m of movies) {
            await ensureDefaultShowsForMovie(m, 120);
        }

        return res.json({
            success: true,
            count: movies.length,
            message: "Auto shows generated for all recent movies",
        });
    } catch (err) {
        console.error(err);
        return res
            .status(500)
            .json({ success: false, message: "Failed to generate shows" });
    }
};

/**
 * GET /api/show/admin/:movieId/schedule
 *
 * Used by ADMIN ShowDetails drawer.
 * Behaviour:
 *  - Ensures movie + default shows up to release+120 days.
 *  - Returns a strict 7-day rolling window from TODAY.
 *  - Hidden shows are INCLUDED so that:
 *      • "Hide entire day" does NOT remove the date from admin view.
 *      • Admin can always unhide days later.
 */
export const getMovieSchedule = async (req, res) => {
    try {
        const { movieId } = req.params;

        // 1) Ensure movie exists (reuse helper if you like)
        let movie = await Movie.findById(movieId);
        if (!movie) {
            movie = await ensureMovieInDbFromTmdb(movieId);
        }

        // 2) Ensure default shows are generated (up to 120 days)
        await ensureDefaultShowsForMovie(movie, 120);

        // 3) 7-day window from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const windowStart = today;
        let windowEnd = new Date(windowStart);
        windowEnd.setDate(windowEnd.getDate() + 6); // exactly 7 days

        // Cap by (release_date + 120 days)
        if (movie.release_date) {
            const release = new Date(movie.release_date);
            const maxEnd = new Date(release);
            maxEnd.setDate(maxEnd.getDate() + 120);

            if (windowEnd > maxEnd) {
                windowEnd = maxEnd;
            }
        }

        // 4) Fetch all shows in this window (hidden included)
        const shows = await Show.find({
            movie: movie._id,
            showDateTime: { $gte: windowStart, $lte: windowEnd },
            isActive: { $ne: false },
        })
            .populate("theater")
            .sort({ showDateTime: 1 });

        // 5) Build date → slots[] for admin
        const dateTime = {};

        shows.forEach((show) => {
            const iso = show.showDateTime.toISOString();
            const [date] = iso.split("T");

            if (!dateTime[date]) dateTime[date] = [];

            dateTime[date].push({
                time: show.showDateTime,
                showId: show._id,
                showPrice: show.showPrice,
                hidden: show.hidden || false,

                theaterId: show.theater?._id,
                theaterName: show.theater?.name,
                theaterCity: show.theater?.city,
                theaterAddress: show.theater?.address,

                format: show.format,
                experience: show.experience,
            });
        });

        return res.json({
            success: true,
            movie,
            dateTime,
        });
    } catch (err) {
        console.error("getMovieSchedule error:", err);
        return res.json({ success: false, message: err.message });
    }
};

/**
 * GET /api/show/admin/:movieId/format-prices
 * Returns per-format pricing for a movie.
 */
export const getFormatPricesForMovie = async (req, res) => {
    try {
        const { movieId } = req.params;

        const movie = await Movie.findById(movieId);
        if (!movie) {
            return res.json({ success: false, message: "Movie not found" });
        }

        const priceByFormat = movie.priceByFormat || {};
        const defaultBase =
            typeof movie.defaultShowPrice === "number"
                ? movie.defaultShowPrice
                : 250;

        const formats = SUPPORTED_FORMATS.map((fmt) => {
            let price;
            if (typeof priceByFormat[fmt] === "number") {
                price = priceByFormat[fmt];
            } else if (typeof FORMAT_DEFAULT_PRICES[fmt] === "number") {
                price = FORMAT_DEFAULT_PRICES[fmt];
            } else {
                price = defaultBase;
            }
            return { format: fmt, price };
        });

        return res.json({ success: true, formats });
    } catch (err) {
        console.error("getFormatPricesForMovie error:", err);
        return res.json({ success: false, message: err.message });
    }
};

// Top of file pe Movie, Show already import honge
// import Movie from "../models/Movie.js";
// import Show from "../models/Show.js";

/**
 * ADMIN: Update base prices per format for a movie
 *  - Updates Movie.priceByFormat
 *  - Optionally adjusts Movie.defaultShowPrice
 *  - Re-prices all FUTURE shows of this movie based on new format prices
 *
 * Request:
 *   PATCH /api/show/admin/:movieId/format-prices
 *   body: {
 *     priceByFormat: {
 *       "2D": 19,
 *       "3D": 29,
 *       "IMAX 2D": 39,
 *       "4DX-3D": 59
 *     }
 *   }
 */
export const updateFormatPricesForMovie = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { priceByFormat } = req.body || {};

        if (!priceByFormat || typeof priceByFormat !== "object") {
            return res.json({
                success: false,
                message: "priceByFormat (object) is required",
            });
        }

        const movie = await Movie.findById(movieId);
        if (!movie) {
            return res.json({ success: false, message: "Movie not found" });
        }

        // ---------------- Clean and normalize input ----------------
        const cleaned = {};
        for (const [format, value] of Object.entries(priceByFormat)) {
            const num = Number(value);
            if (Number.isFinite(num) && num > 0) {
                cleaned[format] = num;
            }
        }

        // Persist on Movie
        movie.priceByFormat = cleaned;

        // Optional: derive defaultShowPrice as smallest configured price
        const values = Object.values(cleaned);
        if (values.length) {
            const min = Math.min(...values);
            movie.defaultShowPrice = min;
        }

        await movie.save();

        // ---------------- Re-price ALL shows for this movie ----------------
        // NOTE: yaha date filter hata diya hai, taaki past + future sabka price sync ho jaye
        const shows = await Show.find({
            movie: movieId,
        }).select("_id format experience");

        if (shows.length) {
            // Map: experience -> format (new combos)
            const expToFormat = EXPERIENCE_FORMAT_PAIRS.reduce((m, p) => {
                m[p.experience] = p.format;
                return m;
            }, {});

            // Legacy normalize maps
            const LEGACY_EXPERIENCE_NORMALIZE = {
                "Laser Screen": "Laser",
                "4DX Screen": "4DX",
                "Standard": null, // Standard => fall back to 2D
            };

            const LEGACY_FORMAT_NORMALIZE = {
                "4DX": "4DX-3D",
            };

            const ops = shows.map((s) => {
                let fmt = s.format || null;

                // 1) Legacy format ko normalize karo (4DX => 4DX-3D)
                if (fmt && LEGACY_FORMAT_NORMALIZE[fmt]) {
                    fmt = LEGACY_FORMAT_NORMALIZE[fmt];
                }

                // 2) Agar format missing hai, to experience se nikaalo
                if (!fmt && s.experience) {
                    const rawExp = s.experience;
                    const normalizedExp =
                        LEGACY_EXPERIENCE_NORMALIZE[rawExp] ?? rawExp;

                    if (normalizedExp && expToFormat[normalizedExp]) {
                        fmt = expToFormat[normalizedExp];
                    }
                }

                // 3) Agar abhi bhi kuch nahi mila, to safe default 2D
                if (!fmt) fmt = "2D";

                // 4) Final price resolve
                const price =
                    (cleaned &&
                        Object.prototype.hasOwnProperty.call(cleaned, fmt)
                        ? cleaned[fmt]
                        : movie.defaultShowPrice) ?? 250;

                return {
                    updateOne: {
                        filter: { _id: s._id },
                        update: { $set: { showPrice: price, format: fmt } },
                    },
                };
            });

            await Show.bulkWrite(ops);
        }

        return res.json({
            success: true,
            movie,
            updatedShows: shows.length,
            message:
                "Format prices updated for movie and saare shows (past + upcoming) re-priced ho gaye.",
        });
    } catch (err) {
        console.error("updateFormatPricesForMovie error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update format prices",
        });
    }
};


// ---------------------------------------------------------------------------
// ADMIN: One-time migration to normalize format <-> experience mapping
// ---------------------------------------------------------------------------
export const fixShowFormatAndExperience = async (req, res) => {
    try {
        // 4DX ko pehle 4DX-3D me normalize karo
        const res4dx = await Show.updateMany(
            { format: "4DX" },
            { $set: { format: "4DX-3D" } }
        );

        // 2D -> Laser
        const res2d = await Show.updateMany(
            { format: "2D" },
            { $set: { experience: "Laser" } }
        );

        // 3D -> Dolby Atmos
        const res3d = await Show.updateMany(
            { format: "3D" },
            { $set: { experience: "Dolby Atmos" } }
        );

        // IMAX 2D -> IMAX
        const resImax = await Show.updateMany(
            { format: "IMAX 2D" },
            { $set: { experience: "IMAX" } }
        );

        // 4DX-3D -> 4DX (experience)
        const res4dx3d = await Show.updateMany(
            { format: "4DX-3D" },
            { $set: { experience: "4DX" } }
        );

        return res.json({
            success: true,
            message: "Show format/experience normalized for existing shows.",
            stats: {
                updatedFrom4DX: res4dx.modifiedCount,
                set2D_Laser: res2d.modifiedCount,
                set3D_Dolby: res3d.modifiedCount,
                setIMAX: resImax.modifiedCount,
                set4DX3D_4DX: res4dx3d.modifiedCount,
            },
        });
    } catch (err) {
        console.error("fixShowFormatAndExperience error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Failed to normalize shows" });
    }
};

// ---------------------------------------------------------------------------
// ADMIN: Auto-delete expired shows (all shows whose showDateTime is in past)
// ---------------------------------------------------------------------------
export const deleteExpiredShows = async (req, res) => {
    try {
        const now = new Date();

        // Delete all shows that already finished.
        // If you want to keep manual shows, you can add filter like:
        // { isAutoGenerated: true } etc.
        const result = await Show.deleteMany({
            showDateTime: { $lt: now },
        });

        return res.json({
            success: true,
            deletedCount: result.deletedCount || 0,
            message: `Deleted ${result.deletedCount || 0} expired show(s).`,
        });
    } catch (err) {
        console.error("deleteExpiredShows error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete expired shows",
        });
    }
};
