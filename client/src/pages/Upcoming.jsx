import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import MovieCard from "../components/MovieCard";
import BlurCircle from "../components/BlurCircle";
import MovieCardSkeleton from "../components/MovieCardSkeleton";

const UpcomingMovies = () => {
    const { axios } = useAppContext();
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showMore, setShowMore] = useState(false);

    const fetchUpcomingMovies = async () => {
        try {
            // Global upcoming movies
            const { data } = await axios.get("/api/show/upcoming");

            if (data.success && Array.isArray(data.movies)) {
                setMovies(data.movies);
            } else {
                setMovies([]);
            }
        } catch (error) {
            console.error("Upcoming fetch error:", error);
            setMovies([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpcomingMovies();
    }, []);

    const Wrapper = ({ children }) => (
        <div className="relative mt-36 pb-28 px-6 md:px-16 lg:px-40 xl:px-44">
            <BlurCircle top="150px" left="0px" />
            <BlurCircle bottom="50px" right="50px" />

            <h1 className="text-2xl font-semibold my-8 ml-25">
                Coming Soon in Theaters
            </h1>

            {children}
        </div>
    );

    if (loading) {
        return (
            <Wrapper>
                <div className="flex flex-wrap justify-center gap-8 mt-8">
                    {[...Array(12)].map((_, i) => (
                        <MovieCardSkeleton key={i} />
                    ))}
                </div>
            </Wrapper>
        );
    }

    const today = new Date().toISOString().split("T")[0];

    const futureMovies = movies
        .filter((m) => m.release_date >= today)
        .sort(
            (a, b) =>
                new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
        );

    const visibleMovies = showMore ? futureMovies : futureMovies.slice(0, 8);

    return (
        <Wrapper>
            {futureMovies.length > 0 ? (
                <>
                    <div className="flex flex-wrap justify-center gap-8 mt-8">
                        {visibleMovies.map((movie) => (
                            <MovieCard key={movie.id} movie={movie} isUpcoming />
                        ))}
                    </div>

                    {!showMore && futureMovies.length > 12 && (
                        <div className="flex justify-center mt-10">
                            <button
                                onClick={() => setShowMore(true)}
                                className="px-10 py-3 text-sm bg-teal-700 hover:bg-teal-600 transition rounded-full cursor-pointer"
                            >
                                Show More
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-center mt-20 text-gray-400 text-2xl font-semibold">
                    No upcoming movies
                </p>
            )}
        </Wrapper>
    );
};

export default UpcomingMovies;