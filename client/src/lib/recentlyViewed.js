// lib/recentlyViewed.js - Track recently viewed movies in localStorage
const KEY = "recentlyViewed";
const MAX = 12;

export const getRecent = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const addRecent = (movie) => {
  if (!movie) return;
  const id = movie._id || movie.id;
  if (!id) return;
  const entry = {
    _id: movie._id,
    id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    vote_average: movie.vote_average,
    genres: movie.genres,
    release_date: movie.release_date,
    runtime: movie.runtime,
  };
  try {
    const list = getRecent().filter((m) => (m._id || m.id) !== id);
    list.unshift(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
};
