import { describe, test, expect, mock, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

// ── Types ──

type JsonBody = Record<string, any>;

// ── Setup in-memory database before any module imports ──

const testDb = new Database(":memory:");

testDb.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )
`);

testDb.run(`
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
    )
`);

// Seed test user with dummy credentials
const passwordHash = Bun.password.hashSync("admin123");
testDb.run("INSERT INTO users (username, password) VALUES (?, ?)", ["admin", passwordHash]);

// Set API_KEY for session/expired endpoint
process.env.API_KEY = "test-api-key-secret";

// ── Mock @/db BEFORE any module imports ──

mock.module("@/db", () => ({ db: testDb }));

// ── Dynamically import router after mock ──

const { authRouter } = await import("@/modules/auth/router");

// ── Build test app ──

const app = new Hono();

app.onError((error, ctx) => {
    if (error instanceof ZodError) {
        return ctx.json({ success: false, error: "Invalid request" }, 400);
    }
    if (error instanceof HTTPException) {
        return ctx.json({ success: false, error: error.message }, error.status);
    }
    console.error("Unhandled error:", error);
    return ctx.json({ success: false, error: "Internal server error" }, 500);
});

app.route("/auth", authRouter);

// ── Helper: extract session cookie from response ──

function extractCookie(res: Response): string | null {
    const header = res.headers.get("set-cookie");
    if (!header) return null;
    const match = header.match(/session=([^;]+)/);
    return match ? match[1]! : null;
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe("POST /auth/login", () => {
    test("successful login returns 200 and sets session cookie", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin123" }),
        });

        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data).toBeNull();

        // Cookie should be set
        const cookie = extractCookie(res);
        expect(cookie).toBeDefined();
        expect(cookie).toHaveLength(64); // 32 bytes hex
    });

    test("session cookie has correct attributes", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin123" }),
        });

        const setCookie = res.headers.get("set-cookie") || "";
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("Path=/");
        expect(setCookie).toContain("SameSite=Lax");
        expect(setCookie).toContain("Max-Age=86400");
    });

    test("session is persisted in database after login", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin123" }),
        });

        const cookie = extractCookie(res)!;

        const row = testDb.prepare("SELECT * FROM sessions WHERE token = ?").get(cookie) as any;
        expect(row).toBeDefined();
        expect(row.username).toBe("admin");
        expect(row.user_id).toBe(1);
    });

    test("returns 401 for invalid password", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "wrongpassword" }),
        });

        expect(res.status).toBe(401);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(false);
        expect(body.error).toBe("Invalid username or password");

        // No cookie should be set
        expect(res.headers.get("set-cookie")).toBeNull();
    });

    test("returns 401 for non-existent username", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "nonexistent", password: "admin123" }),
        });

        expect(res.status).toBe(401);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Invalid username or password");
    });

    test("returns 400 when username is too short", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "ab", password: "admin123" }),
        });

        expect(res.status).toBe(400);
    });

    test("returns 400 when password is too short", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "1234" }),
        });

        expect(res.status).toBe(400);
    });

    test("returns 400 when username is missing", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: "admin123" }),
        });

        expect(res.status).toBe(400);
    });

    test("returns 400 when body is empty object", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(400);
    });

    test("returns 400 for invalid JSON body", async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not-valid-json",
        });

        expect(res.status).toBe(400);
    });

    test("each login creates a new unique session", async () => {
        const r1 = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin123" }),
        });
        const r2 = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin123" }),
        });

        const c1 = extractCookie(r1);
        const c2 = extractCookie(r2);

        expect(c1).not.toBeNull();
        expect(c2).not.toBeNull();
        expect(c1).not.toBe(c2);
    });
});

describe("POST /auth/logout", () => {
    test("successful logout deletes session and clears cookie", async () => {
        // First login
        const loginRes = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin123" }),
        });
        const cookie = extractCookie(loginRes)!;

        // Verify session exists
        let row = testDb.prepare("SELECT * FROM sessions WHERE token = ?").get(cookie);
        expect(row).toBeDefined();

        // Logout with cookie
        const res = await app.request("/auth/logout", {
            method: "POST",
            headers: { Cookie: `session=${cookie}` },
        });

        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);

        // Session should be deleted from DB
        row = testDb.prepare("SELECT * FROM sessions WHERE token = ?").get(cookie);
        expect(row).toBeNull();

        // Cookie should be cleared (Max-Age=0 or empty)
        const setCookie = res.headers.get("set-cookie") || "";
        expect(setCookie).toContain("session=;");
    });

    test("returns 401 when no session cookie provided", async () => {
        const res = await app.request("/auth/logout", {
            method: "POST",
        });

        expect(res.status).toBe(401);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Unauthorized");
    });

    test("returns 401 with invalid session cookie", async () => {
        const res = await app.request("/auth/logout", {
            method: "POST",
            headers: { Cookie: "session=invalid-token-here" },
        });

        expect(res.status).toBe(401);
    });
});

describe("DELETE /auth/session/expired", () => {
    test("deletes expired sessions with valid x-api-key", async () => {
        const past = "2020-01-01T00:00:00.000Z";
        const future = new Date(Date.now() + 86400000).toISOString();

        // Insert expired and active sessions
        testDb.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
            "exp1", 1, "admin", past,
        ]);
        testDb.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
            "exp2", 2, "user2", past,
        ]);
        testDb.run("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)", [
            "active1", 1, "admin", future,
        ]);

        const res = await app.request("/auth/session/expired", {
            method: "DELETE",
            headers: { "x-api-key": "test-api-key-secret" },
        });

        expect(res.status).toBe(204);

        // Expired sessions should be gone
        const exp1 = testDb.prepare("SELECT * FROM sessions WHERE token = ?").get("exp1");
        expect(exp1).toBeNull();
        const exp2 = testDb.prepare("SELECT * FROM sessions WHERE token = ?").get("exp2");
        expect(exp2).toBeNull();

        // Active session should remain
        const active = testDb.prepare("SELECT * FROM sessions WHERE token = ?").get("active1");
        expect(active).toBeDefined();
    });

    test("returns 401 without x-api-key header", async () => {
        const res = await app.request("/auth/session/expired", {
            method: "DELETE",
        });

        expect(res.status).toBe(401);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Unauthorized");
    });

    test("returns 401 with wrong x-api-key", async () => {
        const res = await app.request("/auth/session/expired", {
            method: "DELETE",
            headers: { "x-api-key": "wrong-api-key" },
        });

        expect(res.status).toBe(401);
    });
});
