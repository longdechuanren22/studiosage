interface CalendarEvent {
    id?: string;
    summary: string;
    start: {
        dateTime: string;
        timeZone?: string;
    };
    end: {
        dateTime: string;
        timeZone?: string;
    };
}
interface AvailabilityResult {
    available: boolean;
    conflictingEvents: CalendarEvent[];
}
export declare class GoogleCalendarAdapter {
    private accessToken;
    constructor(accessToken: string);
    private request;
    checkAvailability(date: string, hourStart?: number, hourEnd?: number): Promise<AvailabilityResult>;
    getUpcomingEvents(days?: number): Promise<CalendarEvent[]>;
    createAppointment(event: CalendarEvent): Promise<CalendarEvent>;
}
export {};
