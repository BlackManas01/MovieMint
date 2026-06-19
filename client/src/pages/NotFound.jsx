// pages/NotFound.jsx - Styled 404 page
import React, { Suspense } from "react";
import { Link } from "react-router-dom";
import { HomeIcon } from "lucide-react";
import BlurCircle from "../components/BlurCircle";

// 3D film reel is lazy-loaded so three.js only downloads on this page.
const FilmReel3D = React.lazy(() => import("../components/FilmReel3D"));

const NotFound = () => {
  return (
    <div className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      <BlurCircle top="80px" left="-60px" />
      <BlurCircle bottom="0px" right="-60px" />

      {/* 3D film reel — drag to spin it */}
      <div className="relative h-44 w-44 md:h-52 md:w-52 mb-2">
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">Loading…</div>}>
          <FilmReel3D />
        </Suspense>
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
