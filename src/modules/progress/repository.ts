import type { Result } from "@/types";
import type { Database, Statement } from "bun:sqlite";
import type { TicketProgress } from "./model";

export class ProgressRepository {

    private stmtGetAllByTicketNo: Statement<TicketProgress, [string]>;
    private stmtGetById: Statement<TicketProgress, [number]>;
    private stmtCreate: Statement;
    private stmtUpdate: Statement;
    private stmtDelete: Statement;

    constructor(private db: Database) {
        this.stmtGetAllByTicketNo = db.prepare<TicketProgress, [string]>(
            `SELECT id, ticket_no, log_time, description, created_by
             FROM ticket_progress
             WHERE ticket_no = ?
             ORDER BY log_time DESC`
        );

        this.stmtGetById = db.prepare<TicketProgress, [number]>(
            `SELECT id, ticket_no, log_time, description, created_by
             FROM ticket_progress
             WHERE id = ?`
        );

        this.stmtCreate = db.prepare(
            `INSERT INTO ticket_progress (ticket_no, description, created_by, log_time)
             VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`
        );

        this.stmtUpdate = db.prepare(
            `UPDATE ticket_progress SET description = ? WHERE id = ?`
        );

        this.stmtDelete = db.prepare(
            `DELETE FROM ticket_progress WHERE id = ?`
        );
    }

    getAllByTicketNo(ticketNo: string): Result<TicketProgress[]> {
        try {
            const items = this.stmtGetAllByTicketNo.all(ticketNo);
            return { data: items };
        } catch (error) {
            console.error("Error fetching progress by ticket_no:", error);
            return { error: true };
        }
    }

    getById(id: number): Result<TicketProgress> {
        try {
            const progress = this.stmtGetById.get(id);
            if (!progress) return { error: true };
            return { data: progress };
        } catch (error) {
            console.error("Error fetching progress by id:", error);
            return { error: true };
        }
    }

    create(ticketNo: string, description: string, createdBy: string | null, logTime: string | null): Result<number> {
        try {
            const result = this.stmtCreate.run(ticketNo, description, createdBy, logTime);
            const id = Number(result.lastInsertRowid);
            return { data: id };
        } catch (error) {
            console.error("Error creating progress:", error);
            return { error: true };
        }
    }

    update(id: number, description: string): Result<null> {
        try {
            const result = this.stmtUpdate.run(description, id);
            if (result.changes === 0) return { error: true };
            return { data: null };
        } catch (error) {
            console.error("Error updating progress:", error);
            return { error: true };
        }
    }

    delete(id: number): Result<null> {
        try {
            const result = this.stmtDelete.run(id);
            if (result.changes === 0) return { error: true };
            return { data: null };
        } catch (error) {
            console.error("Error deleting progress:", error);
            return { error: true };
        }
    }
}
