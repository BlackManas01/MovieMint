// components/ThemeToggle.jsx - Sun/Moon button to switch between light and dark mode
import React from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const ThemeToggle = ({ className = "", onDark = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const chip = onDark
    ? "border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.12)] text-[#ffffff]"
    : "nav-chip text-current";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full ${chip} backdrop-blur hover:border-primary/50 hover:text-primary transition cursor-pointer ${className}`}
    >
      {isDark ? <MoonIcon className="w-[18px] h-[18px]" /> : <SunIcon className="w-[18px] h-[18px]" />}
    </button>
  );
};

export default ThemeToggle;
