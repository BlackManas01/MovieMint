// lib/genres.js - TMDB genre id -> name map + helper to read genres from any movie shape
export const TMDB_GENRES = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

// Returns an array of genre names for a movie that may carry either
// `genres` (array of { id, name }) or `genre_ids` (array of numbers).
export const genreNames = (movie) => {
  if (!movie) return [];
  if (Array.isArray(movie.genres) && movie.genres.length) {
    return movie.genres.map((g) => g?.name).filter(Boolean);
  }
  if (Array.isArray(movie.genre_ids) && movie.genre_ids.length) {
    return movie.genre_ids.map((id) => TMDB_GENRES[id]).filter(Boolean);
  }
  return [];
};
