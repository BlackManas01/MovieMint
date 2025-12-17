import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { assets } from "../assets/assets";
import { MenuIcon, TicketPlus, XIcon } from "lucide-react";
import { useClerk, UserButton, useUser } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const { favoriteMovies } = useAppContext();

  return (
    <div className="fixed top-0 left-0 z-50 w-full flex items-center px-6 md:px-16 lg:px-36 py-5">
      {/* Left: Logo (flex-1 on desktop for centering nav) */}
      <Link to="/" className="max-md:flex-1 md:flex-1">
        <img src={assets.logo} alt="" className="w-36 h-auto" />
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
          bg-black/70 md:bg-white/10
          md:border border-gray-300/20
          overflow-hidden
          transition-[width] duration-300
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
          to="/upcoming"
        >
          Upcoming
        </Link>

        {favoriteMovies.length > 0 && (
          <Link
            onClick={() => {
              scrollTo(0, 0);
              setIsOpen(false);
            }}
            to="/favorite"
          >
            Favorites
          </Link>
        )}
      </div>

      {/* Right: Login / User (flex-1 + justify-end to balance logo) */}
      <div className="flex items-center gap-8 md:flex-1 md:justify-end">
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
    </div>
  );
};

export default Navbar;
