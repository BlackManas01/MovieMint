const MyBookingSkeleton = () => {
    return (
        <div className="flex flex-col md:flex-row justify-between border border-white/6 rounded-lg p-4 max-w-4xl bg-white/5 animate-pulse">
            <div className="flex gap-4">
                <div className="w-40 h-56 bg-white/10 rounded-md" />

                <div className="flex flex-col justify-between py-1 w-64">
                    <div>
                        <div className="h-6 bg-white/10 rounded w-3/4 mb-4" />
                        <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                        <div className="h-4 bg-white/10 rounded w-2/3" />
                    </div>

                    <div className="h-4 bg-white/10 rounded w-24 mt-4" />
                </div>
            </div>

            <div className="flex flex-col justify-between items-end">
                <div className="h-8 bg-white/10 rounded w-24 mb-4" />
                <div className="h-6 bg-white/10 rounded w-32" />
            </div>
        </div>
    );
};

export default MyBookingSkeleton;
