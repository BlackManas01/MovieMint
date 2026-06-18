// components/SearchOverlay.jsx - Full-screen search for movies (title match)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchIcon, X, StarIcon } from "lucide-react";
import { useAppContext } from "../context/AppContext";

const SearchOverlay = ({ open, onClose }) => {
  const { shows, image_base_url } = useAppContext();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const list = Array.isArray(shows) ? shows : [];
    const query = q.trim().toLowerCase();
    if (!query) return list.slice(0, 8);
    return list
      .filter((m) => (m.title || "").toLowerCase().includes(query))
      .slice(0, 12);
  }, [shows, q]);

  if (!open) return null;

  const go = (m) => {
    onClose();
    navigate(`/movies/${m._id || m.id}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[rgb(var(--surface-rgb)/0.96)] backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <SearchIcon className="w-5 h-5 text-primary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies…"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-gray-500"
          />
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No movies found.</p>
          ) : (
            <>
              {!q.trim() && (
                <p className="px-3 py-2 text-[11px] uppercase tracking-wide text-gray-500">
                  Now showing
                </p>
              )}
              {results.map((m) => (
                <button
                  key={m._id || m.id}
                  onClick={() => go(m)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition text-left cursor-pointer"
                >
                  {m.poster_path ? (
                    <img
                      src={image_base_url + m.poster_path}
                      alt={m.title}
                      className="w-10 h-14 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded-md bg-white/5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{m.title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {(m.genres || []).slice(0, 2).map((g) => g.name).join(" • ")}
                    </p>
                  </div>
                  {m.vote_average != null && (
                    <span className="flex items-center gap-1 text-xs text-gray-300 shrink-0">
                      <StarIcon className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      {Number(m.vote_average).toFixed(1)}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
