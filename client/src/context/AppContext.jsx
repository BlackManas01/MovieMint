// context/AppContext.jsx - Global app state: auth, shows, favorites, admin check, and shared utilities
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CITIES, normalizeCity } from "../lib/cities";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [shows, setShows] = useState([]);
    const [loadingShows, setLoadingShows] = useState(true);
    const [showsError, setShowsError] = useState(false);
    const [favoriteMovies, setFavoriteMovies] = useState([]);
    const [city, setCityState] = useState(() => {
        try {
            return normalizeCity(localStorage.getItem("city"));
        } catch {
            return normalizeCity(null);
        }
    });

    const setCity = (c) => {
        const next = normalizeCity(c);
        setCityState(next);
        try {
            localStorage.setItem("city", next);
        } catch {
            /* ignore */
        }
    };

    // Auto-detect the user's city from their location on first visit only.
    // If they've already picked a city we never override it, and if detection
    // fails (denied / offline / unsupported city) we simply keep the default
    // so they can choose manually from the city selector.
    useEffect(() => {
        let alreadyChosen = null;
        try { alreadyChosen = localStorage.getItem("city"); } catch { /* ignore */ }
        if (alreadyChosen) return;
        if (typeof navigator === "undefined" || !navigator.geolocation) return;

        let cancelled = false;
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const { latitude, longitude } = pos.coords;
                    const res = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    const data = await res.json();
                    const candidates = [data.city, data.locality, data.principalSubdivision]
                        .filter(Boolean)
                        .map((s) => String(s).toLowerCase());
                    const match = CITIES.find((c) =>
                        candidates.some((x) => x.includes(c.toLowerCase()) || c.toLowerCase().includes(x))
                    );
                    if (!cancelled && match) {
                        setCityState(match);
                        try { localStorage.setItem("city", match); } catch { /* ignore */ }
                    }
                } catch { /* ignore — fall back to manual selection */ }
            },
            () => { /* permission denied / error — keep manual selection */ },
            { timeout: 8000, maximumAge: 600000 }
        );
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const image_base_url = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;

    const { user } = useUser();
    const { getToken } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const fetchIsAdmin = async () => {
        try {
            const { data } = await axios.get("/api/admin/is-admin", {
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                },
            });

            setIsAdmin(data.isAdmin);

            if (!data.isAdmin && location.pathname.startsWith("/admin")) {
                navigate("/");
                toast.error("You are not authorized to access admin dashboard");
            }
        } catch (error) {
            console.error(error);
            setIsAdmin(false);
        }
    };

    const fetchShows = async () => {
        setLoadingShows(true);
        setShowsError(false);
        try {
            const { data } = await axios.get("/api/show/all");
            if (data.success) {
                setShows(Array.isArray(data.shows) ? data.shows : []);
            } else {
                setShowsError(true);
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            setShowsError(true);
        } finally {
            setLoadingShows(false);
        }
    };

    const fetchFavoriteMovies = async () => {
        try {
            const { data } = await axios.get("/api/user/favorites", {
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                },
            });

            if (data.success) {
                setFavoriteMovies(data.movies);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchShows();
    }, []);

    useEffect(() => {
        if (user) {
            fetchIsAdmin();
            fetchFavoriteMovies();
        }
    }, [user]);

    const value = {
        axios,
        fetchIsAdmin,
        user,
        getToken,
        navigate,
        isAdmin,
        shows,
        loadingShows,
        showsError,
        refetchShows: fetchShows,
        favoriteMovies,
        fetchFavoriteMovies,
        image_base_url,
        city,
        setCity,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
