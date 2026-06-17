import { db } from "@/db";
import { TicketRepository, type TicketPage } from "./repository";
import type { Result } from "@/types";
import type { Tickets } from "./model";

export class TicketService {

    private ticketRepo: TicketRepository

    constructor() {
        this.ticketRepo = new TicketRepository(db);
    }

    getAllTickets(params: {
        status?: "Open" | "Closed";
        search?: string;
        sort?: string;
        order?: "asc" | "desc";
        page?: number;
        limit?: number;
    }): Result<TicketPage> {
        // Logic to get all tickets with pagination, sorting, and filtering
        try {
            const data = this.ticketRepo.getAll(params);
            if (!data) {
                return { error: true };
            }
            return { data: data };
        } catch (error) {
            console.error("Error fetching tickets:", error);
            return { error: true };
        }
    }

    getTicket(ticket_no: string): Result<Tickets> {
        // Logic to get a ticket by ID
        try {
            const data = this.ticketRepo.getById(ticket_no);
            if (data.error || !data.data) {
                return { error: true };
            }
            return { data: data.data };
        } catch (error) {
            console.error("Error fetching ticket:", error);
            return { error: true };
        }
    }

    addRootCause(ticket_no: string, root_cause: string): Result<null> {
        try {
            const data = this.ticketRepo.addRootCause(ticket_no, root_cause);
            if (data.error) {
                return { error: true };
            }
            return { data: null };
        } catch (error) {
            console.error("Error adding root cause:", error);
            return { error: true };
        }
    }

    addAction(ticket_no: string, action: string): Result<null> {
        try {
            const data = this.ticketRepo.addAction(ticket_no, action);
            if (data.error) {
                return { error: true };
            }
            return { data: null };
        } catch (error) {
            console.error("Error adding restoration action:", error);
            return { error: true };
        }
    }

    addCategory(ticket_no: string, category: string): Result<null> {
        try {
            const data = this.ticketRepo.addCategory(ticket_no, category);
            if (data.error) {
                return { error: true };
            }
            return { data: null };
        } catch (error) {
            console.error("Error adding category:", error);
            return { error: true };
        }
    }

    closeTicket(ticket_no: string): Result<null> {
        try {
            const data = this.ticketRepo.closeTicket(ticket_no);
            if (data.error) {
                return { error: true };
            }
            return { data: null };
        } catch (error) {
            console.error("Error closing ticket:", error);
            return { error: true };
        }
    }
}