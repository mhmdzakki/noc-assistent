import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { AuthService } from "@/modules/auth/service";
import { AuthRepository } from "@/modules/auth/repository";

describe("AuthService", () => {
    let db: Database;
    let service: AuthService;

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

        // Seed test user with known password
        const hash = Bun.password.hashSync("admin123");
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", ["admin", hash]);

        // We need to inject our DB into the service.
        // AuthService internally creates new AuthRepository(db).
        // We override by constructing service, then replacing its internal repo.
        service = new AuthService();
        // Replace the internal repo with one using our test DB
        (service as any).authRepo = new AuthRepository(db);
    });

    // ═══════════════════════════════════════════════════
    // login
    // ═══════════════════════════════════════════════════

    describe("login", () => {
        test("successful login returns session with token", async () => {
            const result = await service.login("admin", "admin123");

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data!.token).toBeDefined();
            expect(result.data!.token).toHaveLength(64); // 32 bytes hex = 64 chars
            expect(result.data!.userId).toBe(1);
            expect(result.data!.username).toBe("admin");
            expect(result.data!.expiredAt).toBeDefined();

            // Expiry should be ~1 day from now
            const expiry = new Date(result.data!.expiredAt).getTime();
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            expect(expiry).toBeGreaterThan(now);
            expect(expiry).toBeLessThan(now + oneDay + 5000); // +5s tolerance
        });

        test("session is persisted in database", async () => {
            const result = await service.login("admin", "admin123");
            const token = result.data!.token;

            // Verify session exists in DB
            const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as any;
            expect(row).toBeDefined();
            expect(row.token).toBe(token);
            expect(row.user_id).toBe(1);
            expect(row.username).toBe("admin");
        });

        test("returns error for wrong password", async () => {
            const result = await service.login("admin", "wrongpassword");
            expect(result.error).toBe(true);
            expect(result.data).toBeUndefined();
        });

        test("returns error for non-existent username", async () => {
            const result = await service.login("nonexistent", "admin123");
            expect(result.error).toBe(true);
        });

        test("returns error for empty username", async () => {
            const result = await service.login("", "admin123");
            expect(result.error).toBe(true);
        });

        test("returns error for empty password", async () => {
            const result = await service.login("admin", "");
            expect(result.error).toBe(true);
        });

        test("each login generates a unique token", async () => {
            const r1 = await service.login("admin", "admin123");
            const r2 = await service.login("admin", "admin123");

            expect(r1.data!.token).not.toBe(r2.data!.token);
        });

        test("deletes old sessions when user already has active sessions", async () => {
            // Login 4 times
            await service.login("admin", "admin123");
            await service.login("admin", "admin123");
            await service.login("admin", "admin123");
            await service.login("admin", "admin123");

            // Count active sessions — should be capped at 2 (kept newest)
            const repo = new AuthRepository(db);
            const count = repo.countSession(1);
            expect(count.data!.count).toBeLessThanOrEqual(2);
        });
    });

    // ═══════════════════════════════════════════════════
    // checkSession
    // ═══════════════════════════════════════════════════

    describe("checkSession", () => {
        test("valid session returns success", async () => {
            const loginResult = await service.login("admin", "admin123");
            const token = loginResult.data!.token;

            const result = service.checkSession(token);

            expect(result.error).toBeUndefined();
        });

        test("invalid token returns error", () => {
            const result = service.checkSession("invalid-token-here");
            expect(result.error).toBe(true);
        });

        test("expired session returns error", () => {
            // Directly insert an expired session
            const pastExpiry = "2020-01-01T00:00:00.000Z";
            db.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
                "expired-token", 1, "admin", pastExpiry,
            ]);

            const result = service.checkSession("expired-token");
            expect(result.error).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════
    // logout
    // ═══════════════════════════════════════════════════

    describe("logout", () => {
        test("deletes the session", async () => {
            const loginResult = await service.login("admin", "admin123");
            const token = loginResult.data!.token;

            // Verify session exists
            expect(service.checkSession(token).error).toBeUndefined();

            // Logout
            const result = service.logout(token);
            expect(result.error).toBeUndefined();

            // Session should be gone
            expect(service.checkSession(token).error).toBe(true);
        });

        test("returns error for non-existent token", () => {
            const result = service.logout("nonexistent-token");
            expect(result.error).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════
    // deleteExpiredSessions
    // ═══════════════════════════════════════════════════

    describe("deleteExpiredSessions", () => {
        test("deletes all expired sessions", () => {
            const past = "2020-01-01T00:00:00.000Z";
            const future = new Date(Date.now() + 86400000).toISOString();

            db.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
                "exp1", 1, "admin", past,
            ]);
            db.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
                "exp2", 2, "user2", past,
            ]);
            db.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
                "active", 1, "admin", future,
            ]);

            const result = service.deleteExpiredSessions();

            expect(result.error).toBeUndefined();

            // Active session should remain
            const active = db.prepare("SELECT * FROM sessions WHERE token = ?").get("active");
            expect(active).toBeDefined();

            // Expired should be gone
            const exp1 = db.prepare("SELECT * FROM sessions WHERE token = ?").get("exp1");
            expect(exp1).toBeNull();
            const exp2 = db.prepare("SELECT * FROM sessions WHERE token = ?").get("exp2");
            expect(exp2).toBeNull();
        });

        test("succeeds even when no expired sessions exist", () => {
            const result = service.deleteExpiredSessions();
            expect(result.error).toBeUndefined();
        });
    });
});
