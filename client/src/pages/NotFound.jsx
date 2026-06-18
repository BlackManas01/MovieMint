// pages/NotFound.jsx - Styled 404 page
import React from "react";
import { Link } from "react-router-dom";
import { FilmIcon, HomeIcon } from "lucide-react";
import BlurCircle from "../components/BlurCircle";

const NotFound = () => {
  return (
    <div className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      <BlurCircle top="80px" left="-60px" />
      <BlurCircle bottom="0px" right="-60px" />

      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.03] mb-6">
        <span className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-[spin_9s_linear_infinite]" />
        <FilmIcon className="relative w-9 h-9 text-primary/80" />
      </div>

      <h1 className="text-shade text-6xl md:text-7xl font-bold mx-auto">404</h1>
      <h2 className="text-xl md:text-2xl font-semibold mt-3">This screen has gone dark</h2>
      <p className="mt-2 max-w-md text-sm text-gray-400">
        The page you're looking for isn't showing right now. Let's get you back to the movies.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium bg-primary hover:bg-primary-dull text-black transition"
        >
          <HomeIcon className="w-4 h-4" /> Back to home
        </Link>
        <Link
          to="/movies"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 transition"
        >
          Browse movies
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
