// components/Navbar.jsx - Top navigation bar with logo, links, auth button, and mobile menu
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { MenuIcon, TicketPlus, XIcon, SearchIcon } from "lucide-react";
import { useClerk, UserButton, useUser } from "@clerk/clerk-react";
import CitySelector from "./CitySelector";
import SearchOverlay from "./SearchOverlay";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();

  // The home page opens with a full-screen dark hero. The navbar floats
  // transparently over the WHOLE hero (white chrome). Once scrolled past the
  // hero, it becomes a solid theme-coloured bar so its text always stays
  // readable over whatever content is behind it (dark players, posters, etc).
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight - 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const isHome = location.pathname === "/";
  const overHero = isHome && !pastHero;

  // City selection is irrelevant once you're inside a specific booking flow
  // (seat selection / review / payment) — you've already chosen a theater.
  const hideCity =
    /^\/movies\/[^/]+\/[^/]+/.test(location.pathname) ||
    location.pathname.startsWith("/review-booking") ||
    location.pathname.startsWith("/payment");

  return (
    <div
      style={overHero ? { color: "#ffffff" } : undefined}
      className="fixed top-0 left-0 z-50 w-full flex items-center px-6 md:px-16 lg:px-36 py-5 transition-colors duration-300"
    >
      {/* Soft dark scrim only over the hero (keeps the cinematic white chrome
          legible). Off the hero we use floating chips instead of a bar fade. */}
      {overHero && (
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-black/60 via-black/25 to-transparent" />
      )}

      {/* Left: Logo (flex-1 on desktop for centering nav) */}
      <Link to="/" className="max-md:flex-1 md:flex-1">
        <span className="inline-flex items-center text-2xl md:text-3xl font-semibold tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
          <span>Movie</span>
          <span className="text-primary">Mint</span>
        </span>
      </Link>

      {/* Center: Nav links (mobile = full-screen overlay, desktop = centered pill) */}
      <div
        className={`
          max-md:absolute max-md:top-0 max-md:left-0
          max-md:font-medium max-md:text-lg
          z-50 flex flex-col md:flex-row items-center
          max-md:justify-center gap-8
          md:px-8 py-3
          max-md:h-screen md:rounded-full
          backdrop-blur
          bg-black/70
          overflow-hidden
          transition-[width,background-color] duration-300
          ${overHero ? "md:bg-black/30 md:border md:border-white/20" : "nav-chip-md"}
          ${isOpen ? "max-md:w-full" : "max-md:w-0"}
        `}
      >
        {/* Close icon (mobile only) */}
        <XIcon
          className="md:hidden absolute top-6 right-6 w-6 h-6 cursor-pointer"
          onClick={() => setIsOpen(false)}
        />

        <Link
          onClick={() => {
            scrollTo(0, 0);
            setIsOpen(false);
          }}
          to="/"
        >
          Home
        </Link>
        <Link
          onClick={() => {
            scrollTo(0, 0);
            setIsOpen(false);
          }}
          to="/movies"
        >
          Movies
        </Link>

        <Link
          onClick={() => {
            scrollTo(0, 0);
            setIsOpen(false);
          }}
          to="/favorite"
        >
          Favorites
        </Link>

        {user && (
          <Link
            onClick={() => {
              scrollTo(0, 0);
              setIsOpen(false);
            }}
            to="/my-bookings"
          >
            My Bookings
          </Link>
        )}
      </div>

      {/* Right: Login / User (flex-1 + justify-end to balance logo) */}
      <div className="flex items-center gap-3 md:flex-1 md:justify-end">
        {!hideCity && <CitySelector onDark={overHero} />}
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search movies"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition cursor-pointer hover:border-primary/50 ${
            overHero
              ? "border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.12)] text-[#ffffff]"
              : "nav-chip text-current"
          }`}
        >
          <SearchIcon className="w-[18px] h-[18px]" />
        </button>
        {!user ? (
          <button
            onClick={openSignIn}
            className="px-4 py-1 sm:px-7 sm:py-2 bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer"
          >
            Login
          </button>
        ) : (
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Action
                label="My Bookings"
                labelIcon={<TicketPlus width={15} />}
                onClick={() => navigate("/my-bookings")}
              />
            </UserButton.MenuItems>
          </UserButton>
        )}
      </div>

      {/* Mobile hamburger icon */}
      <MenuIcon
        className="max-md:ml-4 md:hidden w-8 h-8 cursor-pointer"
        onClick={() => setIsOpen(true)}
      />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default Navbar;
