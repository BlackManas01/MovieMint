import React from "react";
import { assets } from "../assets/assets";

const Footer = () => {
    return (
        <footer
            className="
        relative w-full
        px-6 md:px-16 lg:px-24 xl:px-44 
        text-gray-300 
        border-t border-white/10 
        overflow-hidden       /* prevent horizontal scroll */
      "
        >
            {/* Soft background glow kept inside the footer width */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute bottom-[-80px] left-0 h-56 w-56 bg-primary/18 blur-[100px]" />
                <div className="absolute top-[-60px] right-0 h-56 w-56 bg-fuchsia-700/18 blur-[110px]" />
            </div>

            {/* Main content – same width feeling as rest of the page */}
            <div className="max-w-6xl mx-auto">
                {/* Top row */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-10 py-10 border-b border-gray-700/40">
                    {/* Brand + text + stores */}
                    <div className="max-w-sm space-y-5">
                        <img className="w-32 md:w-36 h-auto" src={assets.logo} alt="logo" />
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
                    </div>

                    {/* Links */}
                    <div className="flex-1 flex gap-16 md:gap-24">
                        <div>
                            <h2 className="font-semibold mb-4 text-white">Company</h2>
                            <ul className="text-sm space-y-2">
                                {["Home", "About us", "Contact us", "Privacy policy"].map(
                                    (text) => (
                                        <li key={text}>
                                            <a
                                                href="#"
                                                className="hover:text-primary transition cursor-pointer"
                                            >
                                                {text}
                                            </a>
                                        </li>
                                    )
                                )}
                            </ul>
                        </div>

                        <div>
                            <h2 className="font-semibold mb-4 text-white">Get in touch</h2>
                            <div className="text-sm space-y-2 opacity-80">
                                <p>+1 234 567 890</p>
                                <p>support@moviemint.com</p>
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
