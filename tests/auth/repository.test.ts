import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { AuthRepository } from "@/modules/auth/repository";
import type { Session } from "@/modules/auth/model";

describe("AuthRepository", () => {
    let db: Database;
    let repo: AuthRepository;

    beforeEach(() => {
        db = new Database(":memory:");

        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NOT NULL
            )
        `);

        repo = new AuthRepository(db);
    });

    // ── Helper ──

    function seedUser(username: string, password: string): number {
        const r = db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password]);
        return Number(r.lastInsertRowid);
    }

    function seedSession(token: string, userId: number, username: string, expiresAt: string): void {
        db.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
            token, userId, username, expiresAt,
        ]);
    }

    // ═══════════════════════════════════════════════════
    // getUserByUsername
    // ═══════════════════════════════════════════════════

    describe("getUserByUsername", () => {
        test("returns user when found", () => {
            const id = seedUser("admin", "hashed_password");

            const result = repo.getUserByUsername("admin");

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data!.id).toBe(id);
            expect(result.data!.username).toBe("admin");
            expect(result.data!.password).toBe("hashed_password");
        });

        test("returns error when user not found", () => {
            const result = repo.getUserByUsername("nonexistent");
            expect(result.error).toBe(true);
            expect(result.data).toBeUndefined();
        });

        test("case sensitive — different case returns error", () => {
            seedUser("Admin", "hash");

            const result = repo.getUserByUsername("admin");
            expect(result.error).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════
    // createSession
    // ═══════════════════════════════════════════════════

    describe("createSession", () => {
        test("creates session and returns it", () => {
            const session: Session = {
                token: "abc123token",
                userId: 1,
                username: "admin",
                expiredAt: "2099-12-31T23:59:59.000Z",
            };

            const result = repo.createSession(session);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data!.token).toBe("abc123token");
            expect(result.data!.userId).toBe(1);
            expect(result.data!.username).toBe("admin");

            // Verify in DB
            const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get("abc123token") as any;
            expect(row).toBeDefined();
            expect(row.token).toBe("abc123token");
            expect(row.user_id).toBe(1);
        });

        test("duplicate token returns error (UNIQUE constraint)", () => {
            const session: Session = {
                token: "same-token",
                userId: 1,
                username: "admin",
                expiredAt: "2099-12-31T23:59:59.000Z",
            };

            repo.createSession(session);
            const result = repo.createSession(session); // same token

            expect(result.error).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════
    // getSession
    // ═══════════════════════════════════════════════════

    describe("getSession", () => {
        test("returns session when token is valid and not expired", () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
            seedSession("valid-token", 1, "admin", futureDate);

            const result = repo.getSession("valid-token");

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data!.token).toBe("valid-token");
            expect(result.data!.userId).toBe(1);
            expect(result.data!.username).toBe("admin");
        });

        test("returns error when token not found", () => {
            const result = repo.getSession("nonexistent-token");
            expect(result.error).toBe(true);
        });

        test("returns error when session is expired", () => {
            const pastDate = "2020-01-01T00:00:00.000Z";
            seedSession("expired-token", 1, "admin", pastDate);

            const result = repo.getSession("expired-token");
            expect(result.error).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════
    // countSession
    // ═══════════════════════════════════════════════════

    describe("countSession", () => {
        test("returns 0 when user has no active sessions", () => {
            const result = repo.countSession(1);
            expect(result.error).toBeUndefined();
            expect(result.data!.count).toBe(0);
        });

        test("returns correct count of active sessions", () => {
            const future = new Date(Date.now() + 86400000).toISOString();
            const past = "2020-01-01T00:00:00.000Z";

            seedSession("tok1", 1, "admin", future);
            seedSession("tok2", 1, "admin", future);
            seedSession("tok3", 1, "admin", past); // expired — should NOT count

            const result = repo.countSession(1);
            expect(result.error).toBeUndefined();
            expect(result.data!.count).toBe(2);
        });

        test("only counts sessions for the given user", () => {
            const future = new Date(Date.now() + 86400000).toISOString();

            seedSession("tok1", 1, "admin", future);
            seedSession("tok2", 2, "other", future);

            const result = repo.countSession(1);
            expect(result.data!.count).toBe(1);
        });
    });

    // ═══════════════════════════════════════════════════
    // deleteSession
    // ═══════════════════════════════════════════════════

    describe("deleteSession", () => {
        test("deletes session by token", () => {
            const future = new Date(Date.now() + 86400000).toISOString();
            seedSession("tok-del", 1, "admin", future);

            const result = repo.deleteSession("tok-del");

            expect(result.error).toBeUndefined();
            expect(result.data!.changes).toBe(1);

            // Verify gone
            const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get("tok-del");
            expect(row).toBeNull();
        });

        test("returns error when token not found", () => {
            const result = repo.deleteSession("nonexistent");
            expect(result.error).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════
    // deleteOldSession
    // ═══════════════════════════════════════════════════

    describe("deleteOldSession", () => {
        test("keeps the 2 newest sessions, deletes older ones", () => {
            const future = new Date(Date.now() + 86400000).toISOString();

            // Insert 4 sessions at slightly different times
            seedSession("tok1", 1, "admin", future);
            seedSession("tok2", 1, "admin", future);
            seedSession("tok3", 1, "admin", future);
            seedSession("tok4", 1, "admin", future);

            // Count before
            const before = repo.countSession(1);
            expect(before.data!.count).toBe(4);

            const result = repo.deleteOldSession(1);

            expect(result.error).toBeUndefined();

            // Should have 2 remaining (the 2 newest by created_at)
            const after = repo.countSession(1);
            expect(after.data!.count).toBe(2);
        });

        test("does nothing when user has 2 or fewer sessions", () => {
            const future = new Date(Date.now() + 86400000).toISOString();
            seedSession("tok1", 1, "admin", future);

            const result = repo.deleteOldSession(1);

            expect(result.error).toBeUndefined();
            expect(result.data!.changes).toBe(0);

            const after = repo.countSession(1);
            expect(after.data!.count).toBe(1);
        });
    });

    // ═══════════════════════════════════════════════════
    // deleteExpiredSession
    // ═══════════════════════════════════════════════════

    describe("deleteExpiredSession", () => {
        test("deletes only expired sessions", () => {
            const future = new Date(Date.now() + 86400000).toISOString();
            const past = "2020-01-01T00:00:00.000Z";

            seedSession("active", 1, "admin", future);
            seedSession("expired1", 2, "user2", past);
            seedSession("expired2", 3, "user3", past);

            const result = repo.deleteExpiredSession();

            expect(result.error).toBeUndefined();
            expect(result.data!.changes).toBe(2);

            // Active session should still exist
            const active = db.prepare("SELECT * FROM sessions WHERE token = ?").get("active");
            expect(active).toBeDefined();

            // Expired should be gone
            const expired = db.prepare("SELECT * FROM sessions WHERE token = ?").get("expired1");
            expect(expired).toBeNull();
        });

        test("returns 0 changes when no expired sessions", () => {
            const future = new Date(Date.now() + 86400000).toISOString();
            seedSession("active", 1, "admin", future);

            const result = repo.deleteExpiredSession();
            expect(result.data!.changes).toBe(0);
        });
    });
});
