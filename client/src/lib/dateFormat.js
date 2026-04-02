// lib/dateFormat.js - Formats a date into a human-readable string (e.g., "Mon, January 1, 12:00 PM")
export const dateFormat = (date) => {
    return new Date(date).toLocaleString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    })
}