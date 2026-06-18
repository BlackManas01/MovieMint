// components/MovieCardSkeleton.jsx - Animated placeholder for movie card while loading
const MovieCardSkeleton = () => {
    return (
        <div className="w-66 overflow-hidden rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse">
            {/* Image skeleton */}
            <div className="h-72 w-full bg-gray-700" />

            {/* Body */}
            <div className="p-3 pt-2.5">
                {/* Title skeleton */}
                <div className="h-4 w-3/4 bg-gray-700 rounded" />

                {/* Sub text skeleton */}
                <div className="h-3 mt-2 w-1/2 bg-gray-700 rounded" />

                {/* Button + rating skeleton */}
                <div className="flex items-center justify-between mt-4">
                    <div className="h-8 w-20 bg-gray-700 rounded-full" />
                    <div className="h-4 w-10 bg-gray-700 rounded" />
                </div>
            </div>
        </div>
    );
};

export default MovieCardSkeleton;
