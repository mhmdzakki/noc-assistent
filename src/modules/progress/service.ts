import { db } from "@/db";
import { ProgressRepository } from "./repository";
import type { Result } from "@/types";
import type { TicketProgress } from "./model";

export class ProgressService {

    private progressRepo: ProgressRepository;

    constructor() {
        this.progressRepo = new ProgressRepository(db);
    }

    getAllByTicketNo(ticketNo: string): Result<TicketProgress[]> {
        try {
            const result = this.progressRepo.getAllByTicketNo(ticketNo);
            if (result.error) {
                return { error: true };
            }
            return { data: result.data ?? [] };
        } catch (error) {
            console.error("Error fetching progress list:", error);
            return { error: true };
        }
    }

    create(ticketNo: string, description: string, createdBy: string | null, logTime: string | null): Result<number> {
        try {
            if (!description || description.trim() === "") {
                return { error: true };
            }
            const result = this.progressRepo.create(ticketNo, description, createdBy, logTime);
            if (result.error || !result.data) {
                return { error: true };
            }
            return { data: result.data };
        } catch (error) {
            console.error("Error creating progress:", error);
            return { error: true };
        }
    }

    update(id: number, description: string): Result<null> {
        try {
            if (!description || description.trim() === "") {
                return { error: true };
            }
            const result = this.progressRepo.update(id, description);
            if (result.error) {
                return { error: true };
            }
            return { data: null };
        } catch (error) {
            console.error("Error updating progress:", error);
            return { error: true };
        }
    }

    delete(id: number): Result<null> {
        try {
            const result = this.progressRepo.delete(id);
            if (result.error) {
                return { error: true };
            }
            return { data: null };
        } catch (error) {
            console.error("Error deleting progress:", error);
            return { error: true };
        }
    }

    getById(id: number): Result<TicketProgress> {
        try {
            const result = this.progressRepo.getById(id);
            if (result.error || !result.data) {
                return { error: true };
            }
            return { data: result.data };
        } catch (error) {
            console.error("Error fetching progress by id:", error);
            return { error: true };
        }
    }
}
