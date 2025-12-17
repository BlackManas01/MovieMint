import { useEffect, useState } from "react";
import Title from "../components/admin/Title";
import { useAppContext } from "../context/AppContext";
import MovieCard from "../components/MovieCard";
import Loading from "../components/Loading";

const UpcomingMovies = () => {
    const { axios, getToken } = useAppContext();
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUpcomingMovies = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get("/api/show/upcoming", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (data.success && Array.isArray(data.movies)) {
                setMovies(data.movies);
            }
        } catch (error) {
            console.error("Error fetching movies:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpcomingMovies();
    }, []);

    if (loading) return <Loading />;

    // Only show movies releasing after today
    const today = new Date().toISOString().split("T")[0];
    const filteredMovies = movies.filter(
        (movie) => movie.release_date && movie.release_date > today
    );

    return (
        <>
            <Title text1="Upcoming" text2="Movies" />

            {filteredMovies.length === 0 ? (
                <p className="mt-10 text-lg text-gray-400">
                    No upcoming movies
                </p>
            ) : (
                <div className="mt-10 flex flex-wrap gap-8 max-sm:justify-center">
                    {filteredMovies.map((movie) => (
                        <MovieCard key={movie.id} movie={movie} />
                    ))}
                </div>
            )}
        </>
    );
};

export default UpcomingMovies;
