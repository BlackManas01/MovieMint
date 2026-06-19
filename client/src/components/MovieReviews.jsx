// components/MovieReviews.jsx - Ratings summary + sample audience reviews
import React from "react";
import { StarIcon, ThumbsUp } from "lucide-react";

// A pool of spoiler-free audience reviews; each movie deterministically shows a
// different set of 4 so the section feels genuine instead of identical everywhere.
const NAMES = [
  "Aarav S.", "Priya M.", "Rohan K.", "Neha T.", "Vikram R.", "Ananya P.",
  "Karan D.", "Sneha V.", "Arjun N.", "Diya K.", "Rahul B.", "Meera J.",
  "Aditya G.", "Ishaan M.", "Riya S.", "Sahil A.",
];

const TEXTS = [
  "Absolute blockbuster — the visuals and sound design were next level.",
  "Gripping from start to finish. The performances really carried it.",
  "Great popcorn entertainer. Went with friends and everyone loved it.",
  "One of the best I've seen this year. Goosebumps in the final act.",
  "Solid direction and a tight screenplay. Time just flew by.",
  "A bit slow in the middle, but the payoff was completely worth it.",
  "The cinematography alone is worth the ticket. Stunning on the big screen.",
  "Emotional, thrilling, and beautifully shot. Loved every minute.",
  "Background score gave me chills. Watch it in a good theatre.",
  "Well-paced and engaging — the cast had brilliant chemistry.",
  "Didn't expect to enjoy it this much. Pleasant surprise!",
  "Worth the IMAX upgrade. Immersive all the way through.",
  "Strong first half, even stronger climax. Highly recommend.",
  "A proper big-screen film. Don't wait for OTT on this one.",
];

const hashStr = (s) => {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

// Build 4 deterministic, distinct reviews for a given movie.
const buildReviews = (movieId, score) => {
  let h = hashStr(movieId) || 7;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const base = Math.max(3, Math.min(5, Math.round(score / 2) || 4));
  const usedT = new Set();
  const usedN = new Set();
  const out = [];
  let guard = 0;
  while (out.length < 4 && guard++ < 200) {
    const ti = Math.floor(rand() * TEXTS.length);
    const ni = Math.floor(rand() * NAMES.length);
    if (usedT.has(ti) || usedN.has(ni)) continue;
    usedT.add(ti);
    usedN.add(ni);
    // Slight per-review variation around the movie's overall score.
    const jitter = rand() < 0.4 ? -1 : 0;
    out.push({ name: NAMES[ni], text: TEXTS[ti], rating: Math.max(3, Math.min(5, base + jitter)) });
  }
  return out;
};

const Stars = ({ value, size = "w-3.5 h-3.5" }) => (
  <span className="inline-flex items-center gap-0.5 shrink-0">
    {Array.from({ length: 5 }).map((_, i) => (
      <StarIcon
        key={i}
        className={`${size} ${i < value ? "text-amber-400 fill-amber-400" : "text-gray-600"}`}
      />
    ))}
  </span>
);

const MovieReviews = ({ movie }) => {
  const score = Number(movie?.vote_average || 0);
  const liked = Math.min(99, Math.round((score / 10) * 100));
  const votes = movie?.vote_count ? Number(movie.vote_count).toLocaleString() : "2,480";
  const reviews = React.useMemo(
    () => buildReviews(movie?._id || movie?.id || movie?.title, score),
    [movie?._id, movie?.id, movie?.title, score]
  );

  return (
    <section className="px-6 md:px-16 lg:px-40 xl:px-44 mt-20">
      <p className="text-xl font-semibold mb-8 tracking-tight bg-gradient-to-r from-white to-primary/70 bg-clip-text text-transparent w-max">
        Ratings &amp; Reviews
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Summary card */}
        <div className="lg:w-64 shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex flex-col items-center justify-center text-center">
          <div className="flex items-end gap-1">
            <span className="text-5xl font-bold text-white">{score.toFixed(1)}</span>
            <span className="text-gray-400 mb-1.5">/10</span>
          </div>
          <div className="mt-2">
            <Stars value={Math.round(score / 2)} size="w-5 h-5" />
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
            <ThumbsUp className="w-4 h-4" /> {liked}% liked it
          </p>
          <p className="text-xs text-gray-500 mt-1">{votes} ratings</p>
        </div>

        {/* Reviews list */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <div key={r.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
                    {r.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium truncate">{r.name}</span>
                </div>
                <Stars value={r.rating} />
              </div>
              <p className="text-sm text-gray-300 mt-3 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MovieReviews;
