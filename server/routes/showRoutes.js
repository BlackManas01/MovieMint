import express from "express";
import {
    addTheaterSlot,
    adminGetNowInTheaters,
    deleteExpiredShows,
    deleteShow,
    fixShowFormatAndExperience,
    generateAutoShows,
    generateShowsForAllRecentMovies,
    getAdminNowInTheatersMovies,
    getCombinedTrailers,
    getFormatPricesForMovie,
    getMovieSchedule,
    getMovieShowsAdmin,
    getNowPlayingMovieDetails,
    getNowPlayingMovies,
    getNowPlayingTrailers,
    getShow,
    getShows,
    getTmdbMovieDetails,
    getUpcomingMovieDetails,
    getUpcomingMovies,
    getUpcomingTrailers,
    hideDateForMovie,
    hideMovieShows,
    hideShowsByTheater,
    syncNowPlayingToDbAndGenerateShows,
    toggleShowHidden,
    updateFormatPricesForMovie,
    updateMovieHomeVisibility,
    updateShowActiveStatus,
    updateTimeTemplate
} from "../controllers/showController.js";
import { protectAdmin } from "../middleware/auth.js";

const showRouter = express.Router();

/* ----------------------------- TMDB: MOVIES ----------------------------- */

// Now-playing list (TMDB) – admin only
showRouter.get("/now-playing", protectAdmin, getNowPlayingMovies);
// Now-playing single detail (TMDB)
showRouter.get("/now-playing/:id", getNowPlayingMovieDetails);

// Upcoming list (TMDB)
showRouter.get("/upcoming", getUpcomingMovies);
// Upcoming single detail (TMDB)
showRouter.get("/upcoming/:id", getUpcomingMovieDetails);

// Generic TMDB details (fast / extras)
showRouter.get("/tmdb/:movieId", getTmdbMovieDetails);

/* ----------------------------- TMDB: TRAILERS ---------------------------- */

showRouter.get("/now-playing-trailers", getNowPlayingTrailers);
showRouter.get("/upcoming-trailers", getUpcomingTrailers);
showRouter.get("/trailers", getCombinedTrailers);

/* ----------------------- ADMIN: PER-MOVIE SHOW MGMT ---------------------- */

// Admin drawer – all upcoming shows for a movie (multi-theater)
showRouter.get("/admin/:movieId/shows", protectAdmin, getMovieShowsAdmin);

// Toggle active (soft disable)
showRouter.patch(
    "/admin/show/:showId/active",
    protectAdmin,
    updateShowActiveStatus
);

// Time-slot level hide/unhide
showRouter.patch(
    "/admin/show/:showId/hide",
    protectAdmin,
    toggleShowHidden
);

// Hide/unhide **all shows on a specific date** for this movie
showRouter.patch(
    "/admin/:movieId/hide-date",
    protectAdmin,
    hideDateForMovie
);

// Hide/unhide **all shows for a theater** for this movie
showRouter.patch(
    "/admin/:movieId/hide-by-theater",
    protectAdmin,
    hideShowsByTheater
);

// Hide/unhide **all upcoming shows for this movie**
showRouter.patch(
    "/admin/:movieId/hide-all",
    protectAdmin,
    hideMovieShows
);

/* ----------------------- ADMIN: TIME TEMPLATE (LEGACY) ------------------- */

// Optional – agar tum future me per-movie template use karna chaho
showRouter.patch(
    "/admin/:movieId/time-template",
    protectAdmin,
    updateTimeTemplate
);

showRouter.post(
    "/admin/:movieId/generate-schedule",
    protectAdmin,
    generateAutoShows
);

/* ------------------------ ADMIN: NOW IN THEATERS ------------------------- */

// Old endpoint (agar kahin se POST call kar rahe ho)
showRouter.post("/admin/now-in-theaters", protectAdmin, adminGetNowInTheaters);

// Main endpoint jo tum use kar rahe ho ShowDetails me
showRouter.get(
    "/admin/now-in-theaters",
    protectAdmin,
    getAdminNowInTheatersMovies
);

showRouter.get(
    "/admin/:movieId/schedule",
    protectAdmin,
    getMovieSchedule
);

// ADMIN – per-format pricing
showRouter.get(
    "/admin/:movieId/format-prices",
    protectAdmin,
    getFormatPricesForMovie
);

showRouter.patch(
    "/admin/:movieId/format-prices",
    protectAdmin,
    updateFormatPricesForMovie
);

// Home pe movie dikhani/hide karni (Now in Theaters strip)
showRouter.patch(
    "/admin/home-visibility/:movieId",
    protectAdmin,
    updateMovieHomeVisibility
);

showRouter.patch(
    "/admin/fix-format-experience",
    protectAdmin,
    fixShowFormatAndExperience
);

/* -------------------------- ADMIN: BULK GENERATION ----------------------- */

// Saare recent movies (last 3 months) ke liye auto-generate shows
showRouter.post(
    "/admin/generate-all",
    protectAdmin,
    generateShowsForAllRecentMovies
);

/* ------------------------ ADMIN: MANUAL THEATER SLOT --------------------- */

showRouter.post(
    "/admin/:movieId/add-theater-slot",
    protectAdmin,
    addTheaterSlot
);

// ADMIN: TMDB now_playing → Movie DB + default shows for all theaters
showRouter.post(
    "/admin/sync-now-playing",
    protectAdmin,
    syncNowPlayingToDbAndGenerateShows
);

/* ---------------------------- ADMIN: DELETE SHOW ------------------------- */

showRouter.delete("/admin/show/:showId", protectAdmin, deleteShow);


// Admin: cleanup expired shows
showRouter.delete(
    "/admin/cleanup-expired-shows",
    protectAdmin,
    deleteExpiredShows
);

/* ----------------------------- PUBLIC: CLIENT ---------------------------- */

// Home / Movies page – unique movies with future shows
showRouter.get("/all", getShows);

// MovieDetails page – movie + dateTime (multi-theater slots)
showRouter.get("/:movieId", getShow);

export default showRouter;
