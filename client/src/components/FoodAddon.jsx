// components/FoodAddon.jsx - Optional snacks & beverages (pay at counter) on the seat page
import React, { useEffect, useMemo, useState } from "react";
import { Popcorn, Plus, Minus, ChevronDown, Lock } from "lucide-react";

const ITEMS = [
  { id: "combo", name: "Large Popcorn + Pepsi", price: 350, emoji: "🍿" },
  { id: "nachos", name: "Loaded Nachos", price: 280, emoji: "🧀" },
  { id: "coke", name: "Soft Drink (500ml)", price: 150, emoji: "🥤" },
  { id: "samosa", name: "Cheese Garlic Bread", price: 220, emoji: "🧄" },
];

const FoodAddon = ({ currency = "₹", disabled = false, onTotalChange }) => {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState({});

  const total = useMemo(
    () => ITEMS.reduce((s, it) => s + (qty[it.id] || 0) * it.price, 0),
    [qty]
  );
  const count = useMemo(
    () => Object.values(qty).reduce((a, b) => a + b, 0),
    [qty]
  );

  // Report total/count up to the parent (seat page) for the grand total.
  useEffect(() => {
    onTotalChange?.({ total, count });
  }, [total, count, onTotalChange]);

  // Reset snacks if seats get cleared (add-on becomes locked).
  useEffect(() => {
    if (disabled) {
      setQty({});
      setOpen(false);
    }
  }, [disabled]);

  const set = (id, delta) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }));

  return (
    <div
      className={`w-full max-w-4xl mt-8 rounded-2xl border overflow-hidden transition ${
        disabled
          ? "border-white/10 bg-white/[0.02] opacity-60"
          : "border-primary/15 bg-gradient-to-br from-[#15101c] to-black"
      }`}
    >
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-5 py-4 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            {disabled ? <Lock className="w-5 h-5 text-gray-400" /> : <Popcorn className="w-5 h-5 text-primary" />}
          </div>
          <div className="text-left">
            <p className="font-semibold">Add snacks &amp; beverages</p>
            <p className="text-xs text-gray-400">
              {disabled
                ? "Select your seats first to add snacks"
                : count > 0
                ? `${count} item(s) added to your order`
                : "Optional — add to your order"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && !disabled && (
            <span className="text-sm font-semibold text-primary">
              {currency} {total}
            </span>
          )}
          {!disabled && (
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          )}
        </div>
      </button>

      {open && !disabled && (
        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ITEMS.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{it.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{it.name}</p>
                  <p className="text-xs text-gray-400">{currency} {it.price}</p>
                </div>
              </div>
              {qty[it.id] ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => set(it.id, -1)} className="h-7 w-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center cursor-pointer hover:border-primary/50">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">{qty[it.id]}</span>
                  <button onClick={() => set(it.id, 1)} className="h-7 w-7 rounded-full bg-primary text-black flex items-center justify-center cursor-pointer hover:bg-primary-dull">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => set(it.id, 1)}
                  className="shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition cursor-pointer"
                >
                  Add
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FoodAddon;
