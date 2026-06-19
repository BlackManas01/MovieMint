// components/CitySelector.jsx - City picker (context-driven), lists only cities with cinemas
import React, { useEffect, useRef, useState } from "react";
import { MapPinIcon, ChevronDown } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { CITIES } from "../lib/cities";

const CitySelector = ({ onDark = false }) => {
  const { city, setCity } = useAppContext();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (c) => {
    setCity(c);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition cursor-pointer ${
          onDark
            ? "text-[#ffffff] border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.12)]"
            : "nav-chip text-current hover:border-primary/40"
        }`}
      >
        <MapPinIcon className="w-4 h-4 text-primary" />
        {city}
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/10 bg-[rgb(var(--surface-rgb)/0.97)] backdrop-blur-xl shadow-2xl p-1 z-[80]">
          {CITIES.map((c) => (
            <button
              key={c}
              onClick={() => pick(c)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition cursor-pointer ${
                c === city ? "bg-primary/15 text-primary" : "hover:bg-white/5 text-gray-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CitySelector;
