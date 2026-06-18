// components/Footer.jsx - Site footer with logo, links, and download buttons
import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { assets } from "../assets/assets";

const companyLinks = [
    { label: "Home", to: "/" },
    { label: "Now Showing", to: "/movies" },
    { label: "Coming Soon", to: "/movies" },
    { label: "Favorites", to: "/favorite" },
];

const Footer = () => {
    return (
        <footer
            className="
        relative w-full
        px-6 md:px-16 lg:px-24 xl:px-44 
        text-gray-300 
        overflow-hidden       /* prevent horizontal scroll */
      "
        >
            {/* Soft background glow kept inside the footer width */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute bottom-[-80px] left-0 h-56 w-56 bg-primary/18 blur-[100px]" />
                <div className="absolute top-[-60px] right-0 h-56 w-56 bg-primary/15 blur-[110px]" />
                {/* Fade the top into the page background so there is no seam with the section above */}
                <div className="absolute top-0 inset-x-0 h-40 surface-fade-down" />
            </div>

            {/* Soft centered divider instead of a hard full-width line */}
            <div className="pointer-events-none absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Main content – same width feeling as rest of the page */}
            <div className="max-w-6xl mx-auto">
                {/* Top row */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-10 py-10 border-b border-gray-700/40">
                    {/* Brand + text + stores */}
                    <div className="max-w-sm space-y-5">
                        <span className="text-3xl font-semibold tracking-tight"><span className="text-white">Movie</span><span className="text-primary">Mint</span></span>
                        <p className="text-sm opacity-80 leading-relaxed">
                            Book your favorite movies easily with our smooth and fast booking
                            experience. Entertainment made simple 🎬
                        </p>

                        <div className="flex items-center gap-3">
                            <img
                                src={assets.googlePlay}
                                alt="Google Play"
                                className="h-9 w-auto hover:scale-105 transition"
                            />
                            <img
                                src={assets.appStore}
                                alt="App Store"
                                className="h-9 w-auto hover:scale-105 transition"
                            />
                        </div>

                        {/* Social icons */}
                        <div className="flex items-center gap-3 pt-1">
                            {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    aria-label="social link"
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-primary hover:border-primary/40 transition"
                                >
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links */}
                    <div className="flex-1 flex gap-16 md:gap-24">
                        <div>
                            <h2 className="font-semibold mb-4 text-white">Company</h2>
                            <ul className="text-sm space-y-2">
                                {companyLinks.map(({ label, to }) => (
                                    <li key={label}>
                                        <Link
                                            to={to}
                                            onClick={() => window.scrollTo(0, 0)}
                                            className="hover:text-primary transition cursor-pointer"
                                        >
                                            {label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h2 className="font-semibold mb-4 text-white">Get in touch</h2>
                            <div className="text-sm space-y-2 opacity-80">
                                <p>
                                    <a href="tel:+1234567890" className="hover:text-primary transition">+1 234 567 890</a>
                                </p>
                                <p>
                                    <a href="mailto:support@moviemint.com" className="hover:text-primary transition">support@moviemint.com</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom row */}
                <p className="text-center text-xs md:text-sm py-4 opacity-70">
                    © {new Date().getFullYear()} MovieMint. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
};

export default Footer;
