// components/DateSelect.jsx - Horizontally scrollable date picker for selecting show dates
import React, { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const VISIBLE_COUNT = 4;

const DateSelect = ({ dateTime, onDateChange }) => {
  const [selectedIndex, setSelectedIndex] = useState(-1); // index in dates[]
  const [startIndex, setStartIndex] = useState(0);        // first visible index
  const wheelLockRef = useRef(0);

  // All available dates sorted (YYYY-MM-DD)
  const dates = Object.keys(dateTime || {}).sort();
  const maxStart = Math.max(0, dates.length - VISIBLE_COUNT);

  const selectedDate =
    selectedIndex >= 0 && selectedIndex < dates.length
      ? dates[selectedIndex]
      : null;

  const visibleDates = dates.slice(startIndex, startIndex + VISIBLE_COUNT);

  const canSlideLeft = startIndex > 0;
  const canSlideRight = startIndex < maxStart;

  const canMoveSelLeft = selectedIndex > 0;
  const canMoveSelRight = selectedIndex < dates.length - 1;

  // Month + Year chip text (e.g. "Dec 2025")
  const selectedMonthYear = (() => {
    const base = selectedDate || visibleDates[0];
    if (!base) return null;
    const d = new Date(base);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  })();

  // Keep indices in range when dates change
  useEffect(() => {
    if (!dates.length) {
      setSelectedIndex(-1);
      setStartIndex(0);
      return;
    }

    setStartIndex((prev) => Math.min(prev, maxStart));

    setSelectedIndex((prev) => {
      if (prev < 0) return 0;                 // default: first date selected
      if (prev >= dates.length) return dates.length - 1;
      return prev;
    });
  }, [dates, maxStart]);

  // Whenever selected date changes → inform parent
  useEffect(() => {
    if (typeof onDateChange === "function") {
      if (selectedIndex >= 0 && selectedIndex < dates.length) {
        onDateChange(dates[selectedIndex]);
      } else {
        onDateChange(null);
      }
    }
  }, [selectedIndex, dates, onDateChange]);

  // Click on date card (toggle select + keep it in view)
  const selectDate = (date) => {
    const idx = dates.indexOf(date);
    if (idx === -1) return;

    setSelectedIndex((prev) => {
      // If same date is clicked again → unselect
      if (prev === idx) return -1;
      return idx;
    });

    // Adjust window so that selected date is visible
    if (idx < startIndex) {
      setStartIndex(idx);
    } else if (idx >= startIndex + VISIBLE_COUNT) {
      setStartIndex(Math.min(idx - (VISIBLE_COUNT - 1), maxStart));
    }
  };

  // ⬅ LEFT ARROW – slide window left 1 step + select first visible
  // ⬅ LEFT ARROW – move selection backward by 1
  const handlePrev = () => {
    if (!dates.length || selectedIndex <= 0) return;

    const newIndex = selectedIndex - 1;
    setSelectedIndex(newIndex);

    // If selection goes out of visible window → shift window
    if (newIndex < startIndex) {
      setStartIndex(newIndex);
    }
  };

  // ➡ RIGHT ARROW – move selection forward by 1
  const handleNext = () => {
    if (!dates.length || selectedIndex >= dates.length - 1) return;

    const newIndex = selectedIndex + 1;
    setSelectedIndex(newIndex);

    // If selection goes out of visible window → shift window
    if (newIndex >= startIndex + VISIBLE_COUNT) {
      setStartIndex(newIndex - (VISIBLE_COUNT - 1));
    }
  };


  // Keyboard navigation (← / →)
  useEffect(() => {
    const handleKey = (e) => {
      if (!dates.length) return;
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.length, startIndex, selectedIndex, maxStart, canSlideLeft, canSlideRight]);

  // Touchpad / mouse wheel horizontal feel
  const handleWheel = (e) => {
    if (!dates.length) return;

    // Only react to HORIZONTAL scroll. Ignore vertical scroll so the page
    // (and the showtimes below) can scroll normally without changing the date.
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

    const now = Date.now();
    if (now - wheelLockRef.current < 150) return;
    wheelLockRef.current = now;

    if (e.deltaX > 0) {
      handleNext();
    } else if (e.deltaX < 0) {
      handlePrev();
    }
  };

  return (
    <div className="pt-28" id="dateSelect">
      <div
        className="
          relative overflow-hidden rounded-3xl border border-primary/20
          p-6 md:p-9 mt-10
          bg-gradient-to-br from-[#15101c] via-[#0b0910] to-black
          backdrop-blur-2xl shadow-[0_25px_80px_-30px_rgba(168,85,247,0.45)]
        "
      >
        {/* Decorative ambient glows */}
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/20 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-[90px]" />

        {/* Title row + Month/Year chip */}
        <div className="relative flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_25px_-6px_rgba(168,85,247,0.6)]">
              <CalendarDays className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight bg-gradient-to-r from-white via-white to-primary/70 bg-clip-text text-transparent">
                Choose Your Show Date
              </h2>
              <p className="text-[11px] md:text-xs uppercase tracking-[0.22em] text-gray-400 mt-1">
                Pick a day to view available timings
              </p>
            </div>
          </div>

          {selectedMonthYear && (
            <span
              className="
              inline-flex items-center text-[11px] px-4 py-2 rounded-full
              bg-white/5 border border-primary/25
              text-gray-100 tracking-wide backdrop-blur-sm
              shadow-[0_0_20px_-10px_rgba(168,85,247,0.7)]
            "
            >
              {selectedMonthYear}
            </span>
          )}
        </div>

        <div className="relative flex items-center justify-between gap-6">
          {/* LEFT ARROW – fixed width so layout doesn’t jump */}
          <button
            onClick={handlePrev}
            className={`
              arrow-hover-l w-9 h-9 md:w-9 md:h-9 flex items-center justify-center 
              rounded-full transition
              ${canSlideLeft || canMoveSelLeft
                ? "bg-white/10 hover:bg-white/20 text-white shadow-md cursor-pointer"
                : "bg-white/5 text-white/30 opacity-50 pointer-events-none"
              }
            `}
          >
            <ChevronLeft className="w-4 h-4 arrow-ico" />
          </button>

          {/* DATES STRIP */}
          <div
            className="
              flex-1 flex items-center justify-center 
              gap-2.5 md:gap-3
            "
            onWheel={handleWheel}
          >
            {visibleDates.map((date) => {
              const d = new Date(date);
              const dayNum = d.getDate();
              const weekday = d.toLocaleDateString("en-GB", {
                weekday: "short",
              });

              const isActive = selectedDate === date;

              return (
                <button
                  key={date}
                  onClick={() => selectDate(date)}
                  className={`
                    flex flex-col items-center justify-center
                    w-[3.7rem] md:w-[3.9rem]
                    h-16 md:h-16
                    rounded-xl
                    border transition-all duration-200 
                    text-[11px] uppercase tracking-wide 
                    ${isActive
                      ? "bg-gradient-to-b from-primary to-primary-dull text-black border-primary shadow-[0_10px_30px_-10px_rgba(168,85,247,0.9)] scale-[1.06]"
                      : "bg-white/5 hover:bg-white/10 border-white/15 text-white/90 hover:border-primary/40"
                    }
                  `}
                >
                  <span className="text-[10px] opacity-80">{weekday}</span>
                  <span className="text-base md:text-lg font-bold leading-none mt-0.5">
                    {dayNum}
                  </span>
                </button>
              );
            })}
          </div>

          {/* RIGHT ARROW */}
          <button
            onClick={handleNext}
            className={`
              arrow-hover-r w-9 h-9 md:w-9 md:h-9 flex items-center justify-center 
              rounded-full transition
              ${canSlideRight || canMoveSelRight
                ? "bg-white/10 hover:bg-white/20 text-white shadow-md cursor-pointer"
                : "bg-white/5 text-white/30 opacity-50 pointer-events-none"
              }
            `}
          >
            <ChevronRight className="w-4 h-4 arrow-ico" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateSelect;