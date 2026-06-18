// lib/screenLabel.js - Helpers to present screen/format/showtime info like a real booking app

// Combine experience + format into one clean token: "IMAX 2D", "Dolby Atmos 2D",
// "4DX 3D", or just "2D" — avoiding redundant strings like "IMAX • IMAX 2D".
export const formatScreen = (experience, format) => {
  const exp = (experience || "").trim();
  const fmt = (format || "2D").trim();
  const e = exp.toLowerCase();

  const expClean = !exp || e === "standard" || e === "normal" || e === "regular" ? "" : exp;
  if (!expClean) return fmt; // e.g. "2D"

  // Avoid duplicate tokens (e.g. experience "IMAX" + format "IMAX 2D")
  if (expClean.toLowerCase().includes(fmt.toLowerCase())) return expClean;
  if (fmt.toLowerCase().includes(expClean.toLowerCase())) return fmt;

  return `${expClean} ${fmt}`;
};

// Bucket a showtime into a part of the day for grouping.
export const PARTS_OF_DAY = ["Morning", "Afternoon", "Evening", "Night"];
export const partOfDay = (date) => {
  const h = new Date(date).getHours();
  if (Number.isNaN(h)) return "Evening";
  if (h < 12) return "Morning";
  if (h < 16) return "Afternoon";
  if (h < 20) return "Evening";
  return "Night";
};

// Seat-fill -> availability bucket (used for the green/amber/red chip dot).
// ratio is occupied / capacity (0..1). Returns { label, dot, text }.
export const availabilityFromRatio = (ratio) => {
  if (ratio == null || Number.isNaN(ratio)) {
    return { label: "Available", dot: "bg-emerald-400", text: "text-emerald-400" };
  }
  if (ratio >= 1) return { label: "Sold out", dot: "bg-gray-500", text: "text-gray-500" };
  if (ratio >= 0.85) return { label: "Almost full", dot: "bg-red-400", text: "text-red-400" };
  if (ratio >= 0.6) return { label: "Filling fast", dot: "bg-amber-400", text: "text-amber-400" };
  return { label: "Available", dot: "bg-emerald-400", text: "text-emerald-400" };
};

// Stable pseudo seat-pressure (0..1) derived from a show id, so the
// availability colours look varied but don't flicker between renders.
export const seatPressure = (id) => {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 100) / 100;
};

// Languages a movie can be shown in (dubbed/original). Most shows are in the
// original language; some are offered in other languages for wider reach.
const LANG_POOL = ["English", "English", "English", "Hindi", "Hindi", "Tamil", "Telugu"];
export const langFor = (id) => {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 37 + s.charCodeAt(i)) >>> 0;
  return LANG_POOL[h % LANG_POOL.length];
};
