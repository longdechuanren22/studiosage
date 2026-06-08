// Google Calendar API adapter
export class GoogleCalendarAdapter {
    accessToken;
    constructor(accessToken) {
        this.accessToken = accessToken;
    }
    async request(path, options) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        if (!res.ok)
            throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
        return res.json();
    }
    async checkAvailability(date, hourStart, hourEnd) {
        const start = hourStart ? `${date}T${String(hourStart).padStart(2, '0')}:00:00` : `${date}T00:00:00`;
        const end = hourEnd ? `${date}T${String(hourEnd).padStart(2, '0')}:00:00` : `${date}T23:59:59`;
        const data = await this.request(`/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true`);
        const conflicts = (data.items || []).filter(e => e.start?.dateTime);
        return { available: conflicts.length === 0, conflictingEvents: conflicts };
    }
    async getUpcomingEvents(days = 14) {
        const now = new Date().toISOString();
        const later = new Date(Date.now() + days * 86400000).toISOString();
        const data = await this.request(`/calendars/primary/events?timeMin=${now}&timeMax=${later}&singleEvents=true&orderBy=startTime`);
        return data.items || [];
    }
    async createAppointment(event) {
        return this.request('/calendars/primary/events', {
            method: 'POST',
            body: JSON.stringify(event),
        });
    }
}
