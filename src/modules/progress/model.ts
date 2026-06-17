export interface TicketProgress {
    id?: number;
    ticket_no: string;
    log_time: string;
    description: string;
    created_by: string | null;
}

export interface CreateProgressRequest {
    description: string;
    created_by?: string | null;
    log_time?: string | null;
}

export interface UpdateProgressRequest {
    description: string;
}
