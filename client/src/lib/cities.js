// lib/cities.js - Cities derived from the real theater data
import { seedTheaters } from "../assets/seedTheaters";

// Only cities that actually have cinemas (keeps the city filter honest).
export const CITIES = Array.from(new Set(seedTheaters.map((t) => t.city))).sort();

export const DEFAULT_CITY = CITIES.includes("Lucknow") ? "Lucknow" : CITIES[0] || "Lucknow";

export const normalizeCity = (c) => (CITIES.includes(c) ? c : DEFAULT_CITY);

// Whether a given movie is "playing" in a given city. The backend currently
// schedules every movie in every theater, so this curates the listing per city
// for realism — every shown movie is still genuinely bookable in that city.
export const movieInCity = (movieId, city) => {
  const idx = CITIES.indexOf(city);
  if (idx < 0) return true;
  const s = String(movieId || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  const combos = (1 << CITIES.length) - 1; // exclude the "no city" case
  const mask = (h % combos) + 1; // 1..(2^n - 1) → always at least one city
  return Boolean((mask >> idx) & 1);
};

