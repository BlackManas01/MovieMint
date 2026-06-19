// components/ErrorBoundary.jsx - Catches render-time errors so the whole app never white-screens.
import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        // Log for debugging; in production this could be sent to a monitoring service.
        console.error("Error boundary caught:", error, info);
    }

    componentDidMount() {
        // Recover automatically when the user navigates (e.g. browser Back),
        // so a crashed view doesn't stay stuck on the error screen.
        this._reset = () => { if (this.state.hasError) this.setState({ hasError: false }); };
        window.addEventListener("popstate", this._reset);
    }

    componentWillUnmount() {
        if (this._reset) window.removeEventListener("popstate", this._reset);
    }

    handleReload = () => {
        this.setState({ hasError: false });
        window.location.assign("/");
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        // A custom, lighter fallback (used for isolated widgets like the 3D preview).
        if (this.props.fallback !== undefined) return this.props.fallback;

        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 text-white">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.03] mb-6">
                    <span className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-[spin_9s_linear_infinite]" />
                    <span className="text-2xl">🎬</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">Something went off-script</h1>
                <p className="mt-2 max-w-md text-sm text-gray-400">
                    An unexpected error occurred. Let's get you back to the movies.
                </p>
                <div className="mt-6 flex items-center gap-3">
                    <button
                        onClick={() => { this.setState({ hasError: false }); window.history.back(); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-white/5 border border-white/15 text-gray-200 hover:border-primary/40 transition cursor-pointer"
                    >
                        ← Go back
                    </button>
                    <button
                        onClick={this.handleReload}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium bg-primary hover:bg-primary-dull text-black transition cursor-pointer"
                    >
                        Back to home
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
