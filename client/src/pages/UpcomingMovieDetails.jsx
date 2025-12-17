import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StarIcon, PlayCircleIcon, XCircle } from "lucide-react";
import Loading from "../components/Loading";
import { useAppContext } from "../context/AppContext";
import timeFormat from "../lib/timeFormat";
import MovieCardSkeleton from "../components/MovieCardSkeleton";
import MovieDetailSkeleton from "../components/MovieDetailSkeleton";

const UpcomingMovieDetails = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const { axios, image_base_url } = useAppContext();

    const [movie, setMovie] = useState(null);
    const [error, setError] = useState(null);
    const [showError, setShowError] = useState(false);
    const [showTrailer, setShowTrailer] = useState(false);

    const fetchMovieDetails = async () => {
        try {
            // Global upcoming movie details (no token)
            const { data } = await axios.get(`/api/show/upcoming/${id}`);

            if (data.success && data.movie) {
                setMovie(data.movie);
                setError(null);
                setShowError(false);
            } else {
                setError("Movie details not found");
            }
        } catch (err) {
            console.log("Details Error ➜", err.message);
            setError("Movie details failed to load");
        }
    };

    useEffect(() => {
        setMovie(null);
        setError(null);
        setShowError(false);

        fetchMovieDetails();
        window.scrollTo({ top: 0, behavior: "smooth" });

        const timer = setTimeout(() => setShowError(true), 5000);
        return () => clearTimeout(timer);
    }, [id]);

    if (!movie && !showError) return <MovieDetailSkeleton />;

    if (showError && !movie) {
        return (
            <div className="h-screen flex flex-col justify-center items-center text-gray-400">
                <XCircle size={50} className="text-red-500 mb-3" />
                <p className="text-lg mb-4">{error || "Failed to load details"}</p>

                <button
                    onClick={() => navigate("/upcoming")}
                    className="px-6 py-2 bg-primary rounded-lg hover:bg-primary-dull transition cursor-pointer active:scale-95"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const rating = movie.vote_average?.toFixed
        ? movie.vote_average.toFixed(1)
        : movie.vote_average ?? "N/A";

    const genresText = movie.genres
        ? movie.genres.map((g) => g.name).join(", ")
        : "";

    const runtimeText = movie.runtime ? timeFormat(movie.runtime) : "";

    return (
        <div className="px-6 md:px-16 lg:px-40 pt-28 text-white">
            {/* Trailer popup */}
            {showTrailer && movie.trailer && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-black rounded-xl p-2 relative max-w-4xl w-full shadow-xl">
                        <button
                            onClick={() => setShowTrailer(false)}
                            className="absolute -top-5 -right-5 bg-red-600 p-2 rounded-full hover:bg-red-700 transition cursor-pointer"
                        >
                            <XCircle className="text-white w-5 h-5" />
                        </button>
                        <iframe
                            width="100%"
                            height="430"
                            src={movie.trailer.replace("watch?v=", "embed/")}
                            allowFullScreen
                            title="Trailer"
                            className="rounded-xl"
                        />
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">
                {/* Poster */}
                <img
                    src={image_base_url + movie.poster_path}
                    alt={movie.title}
                    className="rounded-xl max-w-72 h-104 object-cover shadow-lg"
                />

                {/* Movie info */}
                <div className="flex flex-col gap-3">
                    <p className="text-primary uppercase">Upcoming</p>

                    <h1 className="text-4xl font-bold">{movie.title}</h1>

                    <div className="flex items-center gap-2 text-gray-300">
                        <StarIcon className="w-5 h-5 text-primary fill-primary" />
                        {rating} Rating
                    </div>

                    <p className="text-gray-400 text-sm leading-tight max-w-xl">
                        {movie.overview}
                    </p>

                    <p className="text-gray-300 text-sm">
                        {runtimeText && runtimeText + " • "}
                        {genresText}
                        {movie.release_date ? ` • ${movie.release_date}` : ""}
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-wrap gap-4 mt-4">
                        {movie.trailer && (
                            <button
                                onClick={() => setShowTrailer(true)}
                                className="flex items-center gap-2 px-7 py-3 text-sm bg-gray-800 hover:bg-gray-900 rounded-lg transition cursor-pointer"
                            >
                                <PlayCircleIcon className="w-5 h-5" /> Watch Trailer
                            </button>
                        )}

                        <button
                            onClick={() => navigate("/upcoming")}
                            className="px-10 py-3 text-sm bg-primary hover:bg-primary-dull rounded-lg transition cursor-pointer active:scale-95"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>

            {/* Cast section */}
            {movie.casts?.length > 0 && (
                <>
                    <p className="text-lg font-medium mt-20 mb-3">Cast</p>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                        {movie.casts.slice(0, 10).map((c, i) => (
                            <div key={i} className="text-center shrink-0">
                                <img
                                    src={image_base_url + c.profile_path}
                                    className="rounded-full h-20 w-20 object-cover border border-gray-700"
                                    alt={c.name}
                                />
                                <p className="text-xs text-gray-300 mt-2">{c.name}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Gallery section */}
            {movie.images?.backdrops?.length > 0 && (
                <>
                    <p className="text-lg font-medium mt-14 mb-2">Gallery</p>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 mb-10">
                        {movie.images.backdrops.slice(0, 4).map((img, i) => (
                            <img
                                key={i}
                                src={image_base_url + img.file_path}
                                className="rounded-lg h-40 object-cover hover:opacity-80 transition shrink-0"
                                alt="gallery"
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default UpcomingMovieDetails;
