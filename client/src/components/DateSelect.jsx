import React, { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

    const now = Date.now();
    if (now - wheelLockRef.current < 150) return;
    wheelLockRef.current = now;

    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

    if (delta > 0) {
      handleNext();
    } else if (delta < 0) {
      handlePrev();
    }
  };

  return (
    <div className="pt-28" id="dateSelect">
      <div
        className="
          relative rounded-2xl border border-white/8 
          p-6 md:p-7 mt-10
          bg-gradient-to-br from-black/60 via-black/45 to-black/70 
          backdrop-blur-2xl shadow-[0_0_40px_-12px_rgba(255,0,150,0.45)]
        "
      >
        {/* Title row + Month/Year chip */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <p className="text-lg md:text-xl font-semibold text-white">
            🎬 Choose Your Show Date
          </p>

          {selectedMonthYear && (
            <span
              className="
              text-[11px] px-3 py-1 rounded-full 
              bg-white/5 border border-white/15 
              text-gray-200 tracking-wide
            "
            >
              {selectedMonthYear}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-6">
          {/* LEFT ARROW – fixed width so layout doesn’t jump */}
          <button
            onClick={handlePrev}
            className={`
              w-9 h-9 md:w-9 md:h-9 flex items-center justify-center 
              rounded-full transition
              ${canSlideLeft || canMoveSelLeft
                ? "bg-white/10 hover:bg-white/20 text-white shadow-md cursor-pointer"
                : "bg-white/5 text-white/30 opacity-50 pointer-events-none"
              }
            `}
          >
            <ChevronLeft className="w-4 h-4" />
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
                    rounded-lg
                    border transition-all duration-200 
                    text-[11px] uppercase tracking-wide 
                    ${isActive
                      ? "bg-white text-black border-pink-400 shadow-lg scale-[1.04]"
                      : "bg-white/5 hover:bg-white/10 border-white/15 text-white/90"
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
              w-9 h-9 md:w-9 md:h-9 flex items-center justify-center 
              rounded-full transition
              ${canSlideRight || canMoveSelRight
                ? "bg-white/10 hover:bg-white/20 text-white shadow-md cursor-pointer"
                : "bg-white/5 text-white/30 opacity-50 pointer-events-none"
              }
            `}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateSelect;