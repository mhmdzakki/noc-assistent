import type { Context } from "hono";
import { ProgressService } from "./service";
import { TicketRepository } from "@/modules/ticket/repository";
import { db } from "@/db";
import type { TicketProgress } from "./model";
import type { ApiResponse } from "@/types/apiResponse";

export class ProgressController {
    private progressService: ProgressService;
    private ticketRepo: TicketRepository;

    constructor() {
        this.progressService = new ProgressService();
        this.ticketRepo = new TicketRepository(db);
    }

    list(ctx: Context, ticketNo: string): Response {
        try {
            // Verify ticket exists
            const ticket = this.ticketRepo.getById(ticketNo);
            if (ticket.error || !ticket.data) {
                const body: ApiResponse<null> = { success: false, error: "Ticket tidak ditemukan" };
                return ctx.json(body, 404);
            }

            const result = this.progressService.getAllByTicketNo(ticketNo);
            if (result.error) {
                const body: ApiResponse<null> = { success: false, error: "Gagal mengambil data progress" };
                return ctx.json(body, 500);
            }

            const body: ApiResponse<TicketProgress[]> = { success: true, data: result.data! };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error listing progress:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    async create(ctx: Context, ticketNo: string, description: string, createdBy: string | null, logTime: string | null): Promise<Response> {
        try {
            // Verify ticket exists
            const ticket = this.ticketRepo.getById(ticketNo);
            if (ticket.error || !ticket.data) {
                const body: ApiResponse<null> = { success: false, error: "Ticket tidak ditemukan" };
                return ctx.json(body, 404);
            }

            const result = this.progressService.create(ticketNo, description, createdBy, logTime);
            if (result.error || !result.data) {
                const body: ApiResponse<null> = { success: false, error: "Description tidak boleh kosong" };
                return ctx.json(body, 400);
            }

            // Fetch the created progress to return full object
            const created = this.progressService.getById(result.data);
            if (created.error || !created.data) {
                const body: ApiResponse<null> = { success: false, error: "Gagal mengambil data progress yang baru dibuat" };
                return ctx.json(body, 500);
            }

            const body: ApiResponse<TicketProgress> = { success: true, data: created.data };
            return ctx.json(body, 201);
        } catch (error) {
            console.error("Error creating progress:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    async update(ctx: Context, ticketNo: string, progressId: number, description: string): Promise<Response> {
        try {
            // Verify ticket exists
            const ticket = this.ticketRepo.getById(ticketNo);
            if (ticket.error || !ticket.data) {
                const body: ApiResponse<null> = { success: false, error: "Ticket tidak ditemukan" };
                return ctx.json(body, 404);
            }

            const result = this.progressService.update(progressId, description);
            if (result.error) {
                const body: ApiResponse<null> = { success: false, error: "Description tidak boleh kosong atau progress tidak ditemukan" };
                return ctx.json(body, 400);
            }

            // Fetch the updated progress to return full object
            const updated = this.progressService.getById(progressId);
            if (updated.error || !updated.data) {
                const body: ApiResponse<null> = { success: false, error: "Gagal mengambil data progress yang diupdate" };
                return ctx.json(body, 500);
            }

            const body: ApiResponse<TicketProgress> = { success: true, data: updated.data };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error updating progress:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    delete(ctx: Context, ticketNo: string, progressId: number): Response {
        try {
            // Verify ticket exists
            const ticket = this.ticketRepo.getById(ticketNo);
            if (ticket.error || !ticket.data) {
                const body: ApiResponse<null> = { success: false, error: "Ticket tidak ditemukan" };
                return ctx.json(body, 404);
            }

            const result = this.progressService.delete(progressId);
            if (result.error) {
                const body: ApiResponse<null> = { success: false, error: "Progress tidak ditemukan" };
                return ctx.json(body, 404);
            }

            const body: ApiResponse<null> = { success: true, data: null };
            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error deleting progress:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }
}
