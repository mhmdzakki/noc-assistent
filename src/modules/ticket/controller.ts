import type { Context } from "hono";
import { TicketService } from "./service";
import type { Tickets } from "./model";
import type { ApiResponse } from "@/types/apiResponse";
import { success } from "zod";

interface Query {
    status?: "Open" | "Closed";
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
    page?: number;
    limit?: number;
}

export class TicketController {
    private ticketService: TicketService
    constructor() {
        this.ticketService = new TicketService()
    }

    getAll(ctx: Context, query: Query) {
        try {
            const result = this.ticketService.getAllTickets(query);
            if (result.error || !result.data) {
                const body: ApiResponse<null> = { success: false, error: "Failed to fetch tickets" };
                return ctx.json(body, 500);
            }

            if (result.data.data.length === 0) {
                const body: ApiResponse<null> = { success: true, data: null };
                return ctx.json(body, 200);
            }

            return ctx.json({ success: true, ...result.data }, 200);
        } catch (error) {
            console.error("Error fetching tickets:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    getById(ctx: Context, ticket_no: string): Response {
        try {
            const result = this.ticketService.getTicket(ticket_no);
            if (result.error || !result.data) {
                const body: ApiResponse<Tickets> = { success: false, error: "Ticket not found" };
                return ctx.json(body, 404);
            }
            const body: ApiResponse<Tickets> = { success: true, data: result.data };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error fetching ticket:", error);
            const body: ApiResponse<Tickets> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    async addRootCause(ctx: Context, ticket_no: string, root_cause: string): Promise<Response> {
        try {
            if (!root_cause) {
                const body: ApiResponse<null> = { success: false, error: "Root cause is required" };
                return ctx.json(body, 400);
            }
            const result = this.ticketService.addRootCause(ticket_no, root_cause);
            if (result.error) {
                const body: ApiResponse<null> = { success: false, error: "Failed to add root cause" };
                return ctx.json(body, 500);
            }
            const body: ApiResponse<null> = { success: true, data: null };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error adding root cause:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    async addAction(ctx: Context, ticket_no: string, action: string): Promise<Response> {
        try {
            if (!action) {
                const body: ApiResponse<null> = { success: false, error: "Restoration action is required" };
                return ctx.json(body, 400);
            }
            const result = this.ticketService.addAction(ticket_no, action);
            if (result.error) {
                const body: ApiResponse<null> = { success: false, error: "Failed to add restoration action" };
                return ctx.json(body, 500);
            }
            const body: ApiResponse<null> = { success: true, data: null };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error adding restoration action:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    async addCategory(ctx: Context, ticket_no: string, category: string): Promise<Response> {
        try {
            if (!category) {
                const body: ApiResponse<null> = { success: false, error: "Category is required" };
                return ctx.json(body, 400);
            }
            const result = this.ticketService.addCategory(ticket_no, category);
            if (result.error) {
                const body: ApiResponse<null> = { success: false, error: "Failed to add category" };
                return ctx.json(body, 500);
            }
            const body: ApiResponse<null> = { success: true, data: null };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error adding category:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    closeTicket(ctx: Context, ticket_no: string): Response {
        try {
            const result = this.ticketService.closeTicket(ticket_no);
            if (result.error) {
                const body: ApiResponse<null> = { success: false, error: "Failed to close ticket" };
                return ctx.json(body, 500);
            }
            const body: ApiResponse<null> = { success: true, data: null };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error closing ticket:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

}