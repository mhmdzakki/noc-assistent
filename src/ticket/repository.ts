import type { Result } from "@/types";
// import type { Print } from "@/types/print";
import type { Changes, Database, Statement } from "bun:sqlite"
import type { Tickets } from "./model";

export type TicketPage = {
    data: Tickets[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const SORTABLE_COLUMNS = new Set([
    "ticket_no", "flp", "status", "segment", "problem_desc",
    "down_time", "up_time", "root_cause", "created_at"
]);

export class TicketRepository {

    private stmtGetTicket: Statement<Tickets, [string]>;
    private stmtAddTicket: Statement<Tickets, [string, string, string, string, string, string | null, string | null, string | null]>;
    private stmtAddRootCause: Statement<Tickets, [string, string]>;
    private stmtAddAction: Statement<Tickets, [string, string]>;
    private stmtCloseTicket: Statement<Tickets, [string]>;


    constructor(private db: Database) {
        this.stmtGetTicket = db.prepare<Tickets, [string]>(
            `SELECT * FROM tickets WHERE ticket_no = ?`
        );
        this.stmtAddTicket = db.prepare<Tickets, [string, string, string, string, string, string | null, string | null, string | null]>(
            `INSERT INTO tickets (ticket_no, flp, status, segment, problem_desc, down_time, up_time, root_cause) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(ticket_no) DO NOTHING`
        );
        this.stmtAddRootCause = db.prepare<Tickets, [string, string]>(
            `UPDATE tickets SET root_cause = ? WHERE ticket_no = ?`
        );
        this.stmtAddAction = db.prepare<Tickets, [string, string]>(
            `UPDATE tickets SET restoration_action = ? WHERE ticket_no = ?`
        );
        this.stmtCloseTicket = db.prepare<Tickets, [string]>(
            `UPDATE tickets SET status = 'Closed' WHERE ticket_no = ?`
        );
    }

    getAll(params: {
        status?: string;
        search?: string;
        sort?: string;
        order?: "asc" | "desc";
        page?: number;
        limit?: number;
    }): Result<TicketPage> {
        try {
            let page = Math.max(1, params.page ?? 1);
            let limit = Math.max(1, params.limit ?? 20);
            const offset = (page - 1) * limit;

            // Build WHERE clause
            let where = "WHERE 1=1";
            const args: (string | number)[] = [];

            if (params.status) {
                where += " AND status = ?";
                args.push(params.status);
            }

            if (params.search) {
                where += " AND (ticket_no LIKE ? OR problem_desc LIKE ? OR segment LIKE ? OR flp LIKE ?)";
                const like = `%${params.search}%`;
                args.push(like, like, like, like);
            }

            // Count total
            const countResult = this.db.prepare<{ count: number }, typeof args>(
                `SELECT COUNT(*) as count FROM tickets ${where}`
            ).get(...args);
            const total = countResult?.count ?? 0;

            // Build ORDER BY dengan whitelist untuk mencegah SQL injection
            let orderBy = "created_at DESC";
            if (params.sort && SORTABLE_COLUMNS.has(params.sort)) {
                const dir = params.order === "desc" ? "DESC" : "ASC";
                orderBy = `${params.sort} ${dir}`;
            }

            // Fetch page
            const dataArgs = [...args, limit, offset];
            const tickets = this.db.prepare<Tickets, typeof dataArgs>(
                `SELECT * FROM tickets ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
            ).all(...dataArgs);

            const totalPages = Math.ceil(total / limit);

            return {
                data: {
                    data: tickets,
                    total,
                    page,
                    limit,
                    totalPages,
                }
            };
        } catch (error) {
            console.error("Error fetching all tickets:", error);
            return { error: true };
        }
    }

    getById(ticket_no: string): Result<Tickets> {
        try {
            const ticket = this.stmtGetTicket.get(ticket_no);
            if (!ticket) return { error: true };
            return { data: ticket };
        } catch (error) {
            console.error("Error fetching ticket:", error);
            return { error: true };
        }
    }

    addRootCause(ticket_no: string, root_cause: string): Result<null> {
        try {
            const data = this.stmtAddRootCause.run(root_cause, ticket_no);
            if (data.changes === 0) { return { error: true }; }
            return { data: null };
        } catch (error) {
            console.error("Error adding root cause:", error);
            return { error: true };
        }
    }

    addAction(ticket_no: string, action: string): Result<null> {
        try {
            const data = this.stmtAddAction.run(action, ticket_no);
            if (data.changes === 0) { return { error: true }; }
            return { data: null };
        } catch (error) {
            console.error("Error adding restoration action:", error);
            return { error: true };
        }
    }

    closeTicket(ticket_no: string): Result<null> {
        try {
            const data = this.stmtCloseTicket.run(ticket_no);
            if (data.changes === 0) { return { error: true }; }
            return { data: null };
        } catch (error) {
            console.error("Error closing ticket:", error);
            return { error: true };
        }
    }

    addTicket(ticket: Tickets): Result<null> {
        try {
            const { ticket_no, flp, status, segment, problem_desc, down_time, up_time, root_cause } = ticket;

            const data = this.stmtAddTicket.run(ticket_no, flp, status, segment, problem_desc, down_time!, up_time!, root_cause!);
            if (data.changes === 0) { return { error: true }; }
            return { data: null };
        } catch (error) {
            console.error("Error adding ticket:", error);
            return { error: true };
        }
    }
}