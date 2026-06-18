// components/AgeGate.jsx - Age verification modal for adult-rated (18+) titles
import React from "react";

const AgeGate = ({ open, certificate = "A · 18+", onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[rgb(var(--surface-rgb)/0.98)] backdrop-blur-xl p-7 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-lg mb-4">
          18+
        </div>
        <h2 className="text-xl font-semibold">Age verification</h2>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          This title is rated{" "}
          <span className="text-red-400 font-semibold">{certificate}</span> and may
          contain content suitable only for adults. Please confirm your age to continue.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-full border border-white/15 text-sm hover:bg-white/5 transition cursor-pointer"
          >
            I'm under 18
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-full bg-primary text-black font-semibold text-sm hover:bg-primary-dull transition cursor-pointer"
          >
            I am 18 or older
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-4">
          By continuing you confirm you meet the minimum age requirement.
        </p>
      </div>
    </div>
  );
};

export default AgeGate;
