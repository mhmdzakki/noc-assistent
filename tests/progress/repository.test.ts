import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { ProgressRepository } from "@/modules/progress/repository";

describe("ProgressRepository", () => {
    let db: Database;
    let repo: ProgressRepository;

    beforeEach(() => {
        // Fresh in-memory DB for each test
        db = new Database(":memory:");

        db.run(`
            CREATE TABLE IF NOT EXISTS ticket_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_no TEXT NOT NULL,
                log_time TEXT DEFAULT CURRENT_TIMESTAMP,
                description TEXT NOT NULL,
                created_by TEXT
            )
        `);

        repo = new ProgressRepository(db);
    });

    describe("getAllByTicketNo", () => {
        test("returns empty array when no progress exists", () => {
            const result = repo.getAllByTicketNo("TT-001");
            expect(result.error).toBeUndefined();
            expect(result.data).toEqual([]);
        });

        test("returns all progress entries for a ticket", () => {
            // Insert test data directly
            db.run(
                `INSERT INTO ticket_progress (ticket_no, description, created_by, log_time)
                 VALUES ('TT-001', 'First update', 'user1', '2024-01-01 10:00:00')`
            );
            db.run(
                `INSERT INTO ticket_progress (ticket_no, description, created_by, log_time)
                 VALUES ('TT-001', 'Second update', 'user2', '2024-01-01 11:00:00')`
            );
            db.run(
                `INSERT INTO ticket_progress (ticket_no, description, created_by, log_time)
                 VALUES ('TT-002', 'Other ticket', 'user1', '2024-01-01 12:00:00')`
            );

            const result = repo.getAllByTicketNo("TT-001");

            expect(result.error).toBeUndefined();
            expect(result.data).toHaveLength(2);
            expect(result.data![0]!.description).toBe("Second update"); // newest first
            expect(result.data![1]!.description).toBe("First update");
        });

        test("returns items ordered by log_time DESC", () => {
            db.run(
                `INSERT INTO ticket_progress (ticket_no, description, log_time)
                 VALUES ('TT-001', 'Oldest', '2024-01-01 08:00:00')`
            );
            db.run(
                `INSERT INTO ticket_progress (ticket_no, description, log_time)
                 VALUES ('TT-001', 'Newest', '2024-01-01 12:00:00')`
            );
            db.run(
                `INSERT INTO ticket_progress (ticket_no, description, log_time)
                 VALUES ('TT-001', 'Middle', '2024-01-01 10:00:00')`
            );

            const result = repo.getAllByTicketNo("TT-001");

            expect(result.error).toBeUndefined();
            expect(result.data![0]!.description).toBe("Newest");
            expect(result.data![1]!.description).toBe("Middle");
            expect(result.data![2]!.description).toBe("Oldest");
        });
    });

    describe("getById", () => {
        test("returns progress by id", () => {
            const insertResult = db.run(
                `INSERT INTO ticket_progress (ticket_no, description, created_by, log_time)
                 VALUES ('TT-001', 'Test description', 'user1', '2024-01-01 10:00:00')`
            );
            const id = Number(insertResult.lastInsertRowid);

            const result = repo.getById(id);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data!.id).toBe(id);
            expect(result.data!.ticket_no).toBe("TT-001");
            expect(result.data!.description).toBe("Test description");
            expect(result.data!.created_by).toBe("user1");
            expect(result.data!.log_time).toBe("2024-01-01 10:00:00");
        });

        test("returns error for non-existent id", () => {
            const result = repo.getById(9999);
            expect(result.error).toBe(true);
            expect(result.data).toBeUndefined();
        });

        test("returns error for negative id", () => {
            const result = repo.getById(-1);
            expect(result.error).toBe(true);
        });
    });

    describe("create", () => {
        test("creates progress with all fields", () => {
            const result = repo.create("TT-001", "New progress", "user1", "2024-01-01 10:00:00");

            expect(result.error).toBeUndefined();
            expect(typeof result.data).toBe("number");
            expect(result.data).toBeGreaterThan(0);

            // Verify it was inserted
            const inserted = db.prepare("SELECT * FROM ticket_progress WHERE id = ?").get(result.data!) as any;
            expect(inserted).toBeDefined();
            expect(inserted.ticket_no).toBe("TT-001");
            expect(inserted.description).toBe("New progress");
            expect(inserted.created_by).toBe("user1");
            expect(inserted.log_time).toBe("2024-01-01 10:00:00");
        });

        test("creates progress with null created_by", () => {
            const result = repo.create("TT-001", "Progress tanpa user", null, "2024-01-01 10:00:00");

            expect(result.error).toBeUndefined();
            expect(result.data).toBeGreaterThan(0);

            const inserted = db.prepare("SELECT * FROM ticket_progress WHERE id = ?").get(result.data!) as any;
            expect(inserted.created_by).toBeNull();
        });

        test("creates progress with null log_time (uses CURRENT_TIMESTAMP)", () => {
            const result = repo.create("TT-001", "Progress auto timestamp", "user1", null);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeGreaterThan(0);

            const inserted = db.prepare("SELECT * FROM ticket_progress WHERE id = ?").get(result.data!) as any;
            // COALESCE with CURRENT_TIMESTAMP should produce a non-null timestamp
            expect(inserted.log_time).toBeDefined();
            expect(inserted.log_time).not.toBeNull();
        });
    });

    describe("update", () => {
        test("updates progress description", () => {
            const insertResult = db.run(
                `INSERT INTO ticket_progress (ticket_no, description, log_time)
                 VALUES ('TT-001', 'Original description', '2024-01-01 10:00:00')`
            );
            const id = Number(insertResult.lastInsertRowid);

            const result = repo.update(id, "Updated description");

            expect(result.error).toBeUndefined();
            expect(result.data).toBeNull();

            // Verify update
            const updated = db.prepare("SELECT * FROM ticket_progress WHERE id = ?").get(id) as any;
            expect(updated.description).toBe("Updated description");
            // Other fields should remain unchanged
            expect(updated.ticket_no).toBe("TT-001");
        });

        test("returns error for non-existent id", () => {
            const result = repo.update(9999, "Non-existent");
            expect(result.error).toBe(true);
            expect(result.data).toBeUndefined();
        });
    });

    describe("delete", () => {
        test("deletes progress by id", () => {
            const insertResult = db.run(
                `INSERT INTO ticket_progress (ticket_no, description, log_time)
                 VALUES ('TT-001', 'To be deleted', '2024-01-01 10:00:00')`
            );
            const id = Number(insertResult.lastInsertRowid);

            const result = repo.delete(id);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeNull();

            // Verify deletion
            const deleted = db.prepare("SELECT * FROM ticket_progress WHERE id = ?").get(id) as any;
            expect(deleted).toBeNull();
        });

        test("returns error for non-existent id", () => {
            const result = repo.delete(9999);
            expect(result.error).toBe(true);
            expect(result.data).toBeUndefined();
        });
    });
});
