// components/MovieReviews.jsx - Ratings summary + sample audience reviews
import React from "react";
import { StarIcon, ThumbsUp } from "lucide-react";

const SAMPLE = [
  { name: "Aarav S.", rating: 5, text: "Absolute blockbuster — visuals and sound design were next level. Worth the IMAX upgrade!" },
  { name: "Priya M.", rating: 4, text: "Gripping story and strong performances. Slightly long in the second half but totally worth it." },
  { name: "Rohan K.", rating: 4, text: "Great popcorn entertainer. Went with friends and everyone loved it." },
  { name: "Neha T.", rating: 5, text: "One of the best I've seen this year. The climax gave me chills." },
];

const Stars = ({ value, size = "w-3.5 h-3.5" }) => (
  <span className="inline-flex items-center gap-0.5">
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
          {SAMPLE.map((r) => (
            <div key={r.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
                    {r.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{r.name}</span>
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
