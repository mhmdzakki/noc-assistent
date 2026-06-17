export interface Tickets {
    id?: number;
    ticket_no: string;
    flp: string;
    status: string | "Open" | "Closed";
    segment: string;
    pic?: string;
    problem_desc: string;
    down_time?: null | string;
    up_time?: null | string;
    root_cause?: null | string;
    restoration_action?: null | string;
    created_at?: Date | null;
}