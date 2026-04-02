// lib/isoTimeFormat.js - Converts an ISO datetime to a 12-hour time string (e.g., "02:30 PM")
const isoTimeFormat = (dateTime) => {
    const date = new Date(dateTime);
    const localTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
    return localTime;
}

export default isoTimeFormat