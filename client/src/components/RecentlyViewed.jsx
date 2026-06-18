// components/RecentlyViewed.jsx - Horizontal row of recently viewed movies (home)
import React from "react";
import MovieCard from "./MovieCard";
import HScroller from "./HScroller";
import { getRecent } from "../lib/recentlyViewed";

const RecentlyViewed = ({ excludeId }) => {
  const items = getRecent().filter((m) => (m._id || m.id) !== excludeId);
  if (items.length < 2) return null;

  return (
    <section className="px-6 md:px-16 lg:px-24 xl:px-44 pt-16">
      <p className="text-shade font-semibold text-2xl mb-6">Recently viewed</p>
      <HScroller>
        <div className="flex gap-6 w-max pb-2 px-1">
          {items.map((m) => (
            <div key={m._id || m.id} className="shrink-0">
              <MovieCard movie={m} />
            </div>
          ))}
        </div>
      </HScroller>
    </section>
  );
};

export default RecentlyViewed;
