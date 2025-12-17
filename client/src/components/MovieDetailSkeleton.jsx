const MovieDetailSkeleton = () => {
    return (
        <div className="px-6 md:px-16 lg:px-40 pt-30 md:pt-50 animate-pulse">
            <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">

                {/* Poster Skeleton */}
                <div className="rounded-xl bg-gray-700 h-104 w-72"></div>

                {/* Text Skeleton */}
                <div className="flex flex-col gap-4 w-full">
                    <div className="h-8 bg-gray-700 w-64 rounded"></div>
                    <div className="h-5 bg-gray-700 w-48 rounded"></div>
                    <div className="h-12 bg-gray-700 w-full rounded"></div>
                    <div className="h-6 bg-gray-700 w-56 rounded"></div>

                    {/* Buttons */}
                    <div className="flex gap-4 mt-4">
                        <div className="h-10 bg-gray-700 w-32 rounded-lg"></div>
                        <div className="h-10 bg-gray-700 w-28 rounded-lg"></div>
                    </div>
                </div>
            </div>

            {/* Cast Skeleton */}
            <p className="h-6 bg-gray-700 w-40 rounded mt-20"></p>
            <div className="flex gap-4 mt-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-full bg-gray-700 h-20 w-20"></div>
                ))}
            </div>

            {/* Gallery Skeleton */}
            <p className="h-6 bg-gray-700 w-32 rounded mt-14"></p>
            <div className="flex gap-4 mt-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-lg bg-gray-700 h-40 w-64 mb-10"></div>
                ))}
            </div>
        </div>
    );
};

export default MovieDetailSkeleton;
