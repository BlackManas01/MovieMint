// src/assets/seedTheaters.js
// Theater catalog. Cities in the app are derived from this list, so adding a
// city here (with a few theaters) makes it selectable across the site.
// `experience` is shown as an amenity; `defaultFormat` is display metadata —
// each show's real format/experience is assigned when shows are generated.

export const seedTheaters = [
    /* ----------------------------- Mumbai ----------------------------- */
    { name: "PVR Icon Phoenix Palladium", city: "Mumbai", area: "Lower Parel", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },
    { name: "INOX R-City", city: "Mumbai", area: "Ghatkopar", experience: "Insignia Recliners", defaultFormat: "2D" },
    { name: "Cinepolis Viviana Mall", city: "Mumbai", area: "Thane", experience: "4DX Experience", defaultFormat: "4DX" },
    { name: "PVR Juhu", city: "Mumbai", area: "Juhu", experience: "Dolby Atmos", defaultFormat: "3D" },
    { name: "Carnival Cinemas Wadala", city: "Mumbai", area: "Wadala", experience: "Laser Projection", defaultFormat: "2D" },
    { name: "INOX Nariman Point", city: "Mumbai", area: "Nariman Point", experience: "Premium Recliners", defaultFormat: "2D" },

    /* ------------------------------ Delhi ----------------------------- */
    { name: "PVR Select Citywalk", city: "Delhi", area: "Saket", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },
    { name: "INOX Nehru Place", city: "Delhi", area: "Nehru Place", experience: "Laser Projection", defaultFormat: "2D" },
    { name: "Cinepolis DLF Place", city: "Delhi", area: "Saket", experience: "4DX Experience", defaultFormat: "4DX" },
    { name: "PVR Pacific Mall", city: "Delhi", area: "Tagore Garden", experience: "Dolby Atmos", defaultFormat: "3D" },
    { name: "INOX Connaught Place", city: "Delhi", area: "Rajiv Chowk", experience: "Insignia Recliners", defaultFormat: "2D" },

    /* ---------------------------- Bengaluru --------------------------- */
    { name: "PVR Orion Mall", city: "Bengaluru", area: "Rajajinagar", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },
    { name: "INOX Garuda Mall", city: "Bengaluru", area: "Magrath Road", experience: "Dolby Atmos", defaultFormat: "3D" },
    { name: "Cinepolis Binnypete", city: "Bengaluru", area: "Binnypete", experience: "4DX Experience", defaultFormat: "4DX" },
    { name: "PVR Forum Mall", city: "Bengaluru", area: "Koramangala", experience: "Laser Projection", defaultFormat: "2D" },
    { name: "INOX Mantri Square", city: "Bengaluru", area: "Malleshwaram", experience: "Insignia Recliners", defaultFormat: "2D" },

    /* ---------------------------- Hyderabad --------------------------- */
    { name: "PVR Nexus Mall", city: "Hyderabad", area: "Kukatpally", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },
    { name: "INOX GVK One", city: "Hyderabad", area: "Banjara Hills", experience: "Dolby Atmos", defaultFormat: "3D" },
    { name: "AMB Cinemas", city: "Hyderabad", area: "Gachibowli", experience: "Laser Projection", defaultFormat: "2D" },
    { name: "Cinepolis Sujana Forum", city: "Hyderabad", area: "Kukatpally", experience: "4DX Experience", defaultFormat: "4DX" },
    { name: "Prasads Multiplex", city: "Hyderabad", area: "Necklace Road", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },

    /* ----------------------------- Chennai ---------------------------- */
    { name: "PVR VR Mall", city: "Chennai", area: "Anna Nagar", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },
    { name: "INOX Chennai Citi Centre", city: "Chennai", area: "Mylapore", experience: "Dolby Atmos", defaultFormat: "3D" },
    { name: "Sathyam Cinemas", city: "Chennai", area: "Royapettah", experience: "Laser Projection", defaultFormat: "2D" },
    { name: "Cinepolis BSR Mall", city: "Chennai", area: "Selaiyur", experience: "4DX Experience", defaultFormat: "4DX" },
    { name: "PVR Grand Galada", city: "Chennai", area: "Pallavaram", experience: "Insignia Recliners", defaultFormat: "2D" },

    /* ----------------------------- Kolkata ---------------------------- */
    { name: "INOX South City", city: "Kolkata", area: "Prince Anwar Shah Road", experience: "Insignia Recliners", defaultFormat: "2D" },
    { name: "PVR Avani Mall", city: "Kolkata", area: "Howrah", experience: "Dolby Atmos", defaultFormat: "3D" },
    { name: "Cinepolis Acropolis Mall", city: "Kolkata", area: "Kasba", experience: "4DX Experience", defaultFormat: "4DX" },
    { name: "INOX Quest Mall", city: "Kolkata", area: "Park Circus", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },
    { name: "Carnival Cinemas Salt Lake", city: "Kolkata", area: "Salt Lake", experience: "Laser Projection", defaultFormat: "2D" },

    /* ------------------------------ Pune ------------------------------ */
    { name: "PVR Phoenix Marketcity", city: "Pune", area: "Viman Nagar", experience: "IMAX + Atmos", defaultFormat: "IMAX 2D" },
    { name: "INOX Bund Garden", city: "Pune", area: "Bund Garden", experience: "Dolby Atmos", defaultFormat: "3D" },
    { name: "Cinepolis Seasons Mall", city: "Pune", area: "Magarpatta", experience: "4DX Experience", defaultFormat: "4DX" },
    { name: "City Pride Kothrud", city: "Pune", area: "Kothrud", experience: "Laser Projection", defaultFormat: "2D" },
    { name: "PVR Pavillion", city: "Pune", area: "Shivajinagar", experience: "Premium Recliners", defaultFormat: "2D" },

    /* ----------------------------- Lucknow ---------------------------- */
    { name: "PVR Phoenix Palassio", city: "Lucknow", area: "Shaheed Path", experience: "Dolby Atmos", defaultFormat: "2D" },
    { name: "INOX Riverside Mall", city: "Lucknow", area: "Gomti Nagar", experience: "Premium Recliners", defaultFormat: "2D" },
    { name: "Cinepolis One Awadh Center", city: "Lucknow", area: "Gomti Nagar Extension", experience: "Dolby 7.1", defaultFormat: "2D" },
    { name: "PVR Sahara Ganj", city: "Lucknow", area: "Hazratganj", experience: "Classic Screens", defaultFormat: "2D" },
    { name: "Wave Cinemas", city: "Lucknow", area: "Gomti Nagar", experience: "Laser Projection", defaultFormat: "2D" },
    { name: "INOX Wave Mall", city: "Lucknow", area: "Vibhuti Khand", experience: "4DX Experience", defaultFormat: "4DX" },
];
