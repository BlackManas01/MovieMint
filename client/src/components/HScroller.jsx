// components/HScroller.jsx - Reusable horizontal scroller with animated left/right arrows + edge fades.
import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * HScroller
 * Wraps a horizontally scrollable row. Shows a left arrow once scrolled,
 * and a right arrow while more content remains — both scroll smoothly on click.
 * Soft edge fades + a gentle "in motion" nudge hint when more content exists.
 *
 * Props:
 *  - children: the row content (e.g. a flex container of items)
 *  - className: extra classes for the outer wrapper
 *  - contentClassName: extra classes for the inner scroll container
 *  - fade: show edge fades (default true)
 */
const HScroller = ({ children, className = "", contentClassName = "", fade = true }) => {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Re-check once layout/images settle.
    const t = setTimeout(update, 300);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      clearTimeout(t);
    };
  }, [update, children]);

  const scrollByDir = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        aria-label="Scroll left"
        tabIndex={canLeft ? 0 : -1}
        className={`hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-black/70 border border-white/15 text-gray-100 backdrop-blur shadow-lg transition-all duration-300 hover:bg-primary hover:text-black hover:border-primary
          ${canLeft ? "opacity-100 -translate-x-1/2" : "opacity-0 pointer-events-none translate-x-0"}`}
      >
        <ChevronLeft className="w-5 h-5 animate-nudge-x-rev" />
      </button>

      {/* Left edge fade */}
      {fade && (
        <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-14 fade-left-edge z-10 transition-opacity duration-300 ${canLeft ? "opacity-100" : "opacity-0"}`} />
      )}

      <div ref={scrollRef} className={`overflow-x-auto no-scrollbar ${contentClassName}`}>
        {children}
      </div>

      {/* Right edge fade */}
      {fade && (
        <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-14 fade-right-edge z-10 transition-opacity duration-300 ${canRight ? "opacity-100" : "opacity-0"}`} />
      )}

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        aria-label="Scroll right"
        tabIndex={canRight ? 0 : -1}
        className={`hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-black/70 border border-white/15 text-gray-100 backdrop-blur shadow-lg transition-all duration-300 hover:bg-primary hover:text-black hover:border-primary
          ${canRight ? "opacity-100 translate-x-1/2" : "opacity-0 pointer-events-none translate-x-0"}`}
      >
        <ChevronRight className="w-5 h-5 animate-nudge-x" />
      </button>
    </div>
  );
};

export default HScroller;
