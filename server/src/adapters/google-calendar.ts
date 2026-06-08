// Google Calendar API adapter

interface CalendarEvent {
  id?: string;
  summary: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
}

interface AvailabilityResult {
  available: boolean;
  conflictingEvents: CalendarEvent[];
}

export class GoogleCalendarAdapter {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async checkAvailability(date: string, hourStart?: number, hourEnd?: number): Promise<AvailabilityResult> {
    const start = hourStart ? `${date}T${String(hourStart).padStart(2, '0')}:00:00` : `${date}T00:00:00`;
    const end = hourEnd ? `${date}T${String(hourEnd).padStart(2, '0')}:00:00` : `${date}T23:59:59`;

    const data = await this.request<{ items: CalendarEvent[] }>(
      `/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true`
    );

    const conflicts = (data.items || []).filter(e => e.start?.dateTime);
    return { available: conflicts.length === 0, conflictingEvents: conflicts };
  }

  async getUpcomingEvents(days: number = 14): Promise<CalendarEvent[]> {
    const now = new Date().toISOString();
    const later = new Date(Date.now() + days * 86400000).toISOString();
    const data = await this.request<{ items: CalendarEvent[] }>(
      `/calendars/primary/events?timeMin=${now}&timeMax=${later}&singleEvents=true&orderBy=startTime`
    );
    return data.items || [];
  }

  async createAppointment(event: CalendarEvent): Promise<CalendarEvent> {
    return this.request('/calendars/primary/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }
}
