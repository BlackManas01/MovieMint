// src/components/MovieCardSkeleton.jsx
const MovieCardSkeleton = () => {
    return (
        <div className="flex flex-col justify-between p-3 bg-gray-800 rounded-2xl w-66 animate-pulse">
            {/* Image skeleton */}
            <div className="h-52 w-full rounded-lg bg-gray-700" />

            {/* Title skeleton */}
            <div className="h-4 mt-3 w-3/4 bg-gray-700 rounded" />

            {/* Sub text skeleton */}
            <div className="h-3 mt-2 w-1/2 bg-gray-700 rounded" />

            {/* Button + rating skeleton */}
            <div className="flex items-center justify-between mt-4 pb-3">
                <div className="h-8 w-20 bg-gray-700 rounded-full" />
                <div className="h-4 w-10 bg-gray-700 rounded" />
            </div>
        </div>
    );
};

export default MovieCardSkeleton;
