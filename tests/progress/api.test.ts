import { describe, test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

// ── Types for response bodies ──

type JsonBody = Record<string, any>;

// ── Setup in-memory database before any module imports ──

const testDb = new Database(":memory:");

// Users table (used by AuthRepository)
testDb.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )
`);

// Sessions table (used by AuthRepository)
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

// Tickets table (used by TicketRepository in progress controller)
testDb.run(`
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_no TEXT NOT NULL UNIQUE,
        flp TEXT,
        status TEXT DEFAULT 'Open',
        segment TEXT,
        problem_desc TEXT,
        down_time TEXT,
        up_time TEXT,
        root_cause TEXT,
        restoration_action TEXT,
        category TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Ticket_progress table (used by ProgressRepository)
testDb.run(`
    CREATE TABLE IF NOT EXISTS ticket_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_no TEXT NOT NULL,
        log_time TEXT DEFAULT CURRENT_TIMESTAMP,
        description TEXT NOT NULL,
        created_by TEXT
    )
`);

// ── Seed test data ──

// Hash password for dummy user: { username: "admin", password: "admin123" }
const passwordHash = Bun.password.hashSync("admin123");

testDb.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    ["admin", passwordHash]
);

// Seed test tickets so ticket existence checks pass
testDb.run(
    `INSERT INTO tickets (ticket_no, flp, status, segment, problem_desc)
     VALUES ('TT-001', 'FLP-01', 'Open', 'Seg-A', 'Test problem')`
);
testDb.run(
    `INSERT INTO tickets (ticket_no, flp, status, segment, problem_desc)
     VALUES ('TT-002', 'FLP-02', 'Open', 'Seg-B', 'Another problem')`
);
testDb.run(
    `INSERT INTO tickets (ticket_no, flp, status, segment, problem_desc)
     VALUES ('TT20260613001', 'FLP-03', 'Open', 'Seg-C', 'User provided test ticket')`
);

// ── Mock @/db BEFORE any module that imports it ──

mock.module("@/db", () => ({ db: testDb }));

// ── Dynamically import everything after mock is set up ──

const { progressRouter } = await import("@/modules/progress/router");
const { authRouter } = await import("@/auth/router");
const { authMiddleware } = await import("@/middleware");

// ── Build test app (matching production app.ts structure) ──

const app = new Hono();

// Error middleware (matches production behavior)
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

// Apply auth middleware to protected routes, same as production
app.use("/api/v1/*", authMiddleware);

// Mount routes under /api/v1, same as production
const v1 = new Hono();
v1.route("/auth", authRouter);
v1.route("/ticket", new Hono()); // dummy ticket router so auth middleware works
v1.route("/ticket/:ticket_no/progress", progressRouter);
app.route("/api/v1", v1);

// ── Helper: seed progress data directly ──

function seedProgress(ticketNo: string, description: string, createdBy: string | null, logTime: string): number {
    const result = testDb.run(
        `INSERT INTO ticket_progress (ticket_no, description, created_by, log_time)
         VALUES (?, ?, ?, ?)`,
        [ticketNo, description, createdBy, logTime]
    );
    return Number(result.lastInsertRowid);
}

// ── Helper: login and return the session cookie ──

async function loginAsAdmin(): Promise<string> {
    const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" }),
    });

    const setCookieHeader = res.headers.get("set-cookie");
    if (!setCookieHeader) {
        throw new Error("No set-cookie header in login response");
    }

    // Extract the session cookie value (format: "session=<token>; ...")
    const match = setCookieHeader.match(/session=([^;]+)/);
    if (!match) {
        throw new Error("Could not extract session cookie from set-cookie header");
    }

    return match[1]!;
}

// ── Helper: make authenticated request ──

async function authRequest(
    cookie: string,
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    return app.request(path, {
        ...options,
        headers: {
            ...(options.headers as Record<string, string> || {}),
            "Cookie": `session=${cookie}`,
        },
    });
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Authentication", () => {
    test("login with valid credentials returns 200 and sets session cookie", async () => {
        const res = await app.request("/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin123" }),
        });

        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);

        const setCookie = res.headers.get("set-cookie");
        expect(setCookie).toBeDefined();
        expect(setCookie).toContain("session=");
    });

    test("login with invalid credentials returns 401", async () => {
        const res = await app.request("/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "wrongpassword" }),
        });

        expect(res.status).toBe(401);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(false);
        expect(body.error).toBe("Invalid username or password");
    });
});

describe("Protected endpoints — unauthenticated requests", () => {
    test("GET /progress without cookie returns 401", async () => {
        const res = await app.request("/api/v1/ticket/TT-001/progress");
        expect(res.status).toBe(401);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Unauthorized");
    });

    test("POST /progress without cookie returns 401", async () => {
        const res = await app.request("/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Test" }),
        });
        expect(res.status).toBe(401);
    });

    test("PUT /progress without cookie returns 401", async () => {
        const res = await app.request("/api/v1/ticket/TT-001/progress/1", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Test" }),
        });
        expect(res.status).toBe(401);
    });

    test("DELETE /progress without cookie returns 401", async () => {
        const res = await app.request("/api/v1/ticket/TT-001/progress/1", {
            method: "DELETE",
        });
        expect(res.status).toBe(401);
    });
});

describe("GET /api/v1/ticket/:ticket_no/progress (authenticated)", () => {
    let cookie: string;

    beforeAll(async () => {
        cookie = await loginAsAdmin();
    });

    test("returns empty array when no progress exists", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-002/progress");
        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data).toEqual([]);
    });

    test("returns all progress entries ordered by log_time DESC", async () => {
        seedProgress("TT-001", "First update", "user1", "2024-01-01 10:00:00");
        seedProgress("TT-001", "Second update", "user2", "2024-01-01 11:00:00");

        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress");
        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(2);
        expect(body.data[0].description).toBe("Second update"); // newest first (DESC)
        expect(body.data[1].description).toBe("First update");
    });

    test("returns 404 when ticket does not exist", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/NONEXIST/progress");
        expect(res.status).toBe(404);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Ticket tidak ditemukan");
    });

    test("returns empty array for user ticket_no TT20260613001", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT20260613001/progress");
        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data).toEqual([]);
    });

    test("returns 400 for empty ticket_no in path", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket//progress");
        // Hono won't match the route // so it might 404; either way it's not 200
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

describe("POST /api/v1/ticket/:ticket_no/progress (authenticated)", () => {
    let cookie: string;

    beforeAll(async () => {
        cookie = await loginAsAdmin();
    });

    test("creates progress with description only", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "New progress entry" }),
        });

        expect(res.status).toBe(201);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data.description).toBe("New progress entry");
        expect(body.data.ticket_no).toBe("TT-001");
        expect(body.data.id).toBeGreaterThan(0);
        expect(body.data.log_time).toBeDefined(); // COALESCE → CURRENT_TIMESTAMP
    });

    test("creates progress with all optional fields", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                description: "Full progress entry",
                created_by: "admin",
                log_time: "2024-06-01 14:00:00",
            }),
        });

        expect(res.status).toBe(201);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data.description).toBe("Full progress entry");
        expect(body.data.created_by).toBe("admin");
        expect(body.data.log_time).toBe("2024-06-01 14:00:00");
    });

    test("creates progress with null created_by", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                description: "Progress without user",
                created_by: null,
            }),
        });

        expect(res.status).toBe(201);

        const body = await res.json() as JsonBody;
        expect(body.data.created_by).toBeNull();
    });

    test("returns 400 for empty description", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "" }),
        });

        expect(res.status).toBe(400);
    });

    test("returns 400 for missing description", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(400);
    });

    test("returns 400 for whitespace-only description (rejected by service trim)", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "   " }),
        });

        expect(res.status).toBe(400);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(false);
        expect(body.error).toBe("Description tidak boleh kosong");
    });

    test("creates progress on real ticket_no TT20260613001", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT20260613001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Progress on user ticket" }),
        });

        expect(res.status).toBe(201);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data.ticket_no).toBe("TT20260613001");
        expect(body.data.description).toBe("Progress on user ticket");
    });

    test("returns 404 when ticket does not exist", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/NONEXIST/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Valid description" }),
        });

        expect(res.status).toBe(404);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Ticket tidak ditemukan");
    });

    test("returns 400 for invalid JSON body", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not-valid-json",
        });

        expect(res.status).toBe(400);
    });
});

describe("PUT /api/v1/ticket/:ticket_no/progress/:progress_id (authenticated)", () => {
    let cookie: string;
    let progressId: number;

    beforeAll(async () => {
        cookie = await loginAsAdmin();
        progressId = seedProgress("TT-001", "Original description", "user1", "2024-01-01 10:00:00");
    });

    test("updates progress description", async () => {
        const res = await authRequest(cookie, `/api/v1/ticket/TT-001/progress/${progressId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Updated description" }),
        });

        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data.description).toBe("Updated description");
        expect(body.data.id).toBe(progressId);
        expect(body.data.ticket_no).toBe("TT-001");
    });

    test("returns 400 for empty description", async () => {
        const res = await authRequest(cookie, `/api/v1/ticket/TT-001/progress/${progressId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "" }),
        });

        expect(res.status).toBe(400);
    });

    test("returns 400 for whitespace-only description (rejected by service trim)", async () => {
        const res = await authRequest(cookie, `/api/v1/ticket/TT-001/progress/${progressId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "   " }),
        });

        expect(res.status).toBe(400);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Description tidak boleh kosong atau progress tidak ditemukan");
    });

    test("returns 400 for non-existent progress_id", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress/99999", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Valid description" }),
        });

        expect(res.status).toBe(400);
    });

    test("returns 404 when ticket does not exist", async () => {
        const res = await authRequest(cookie, `/api/v1/ticket/NONEXIST/progress/${progressId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Valid description" }),
        });

        expect(res.status).toBe(404);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Ticket tidak ditemukan");
    });

    test("returns 400 for invalid progress_id (non-number)", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress/abc", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Valid" }),
        });

        expect(res.status).toBe(400);
    });
});

describe("DELETE /api/v1/ticket/:ticket_no/progress/:progress_id (authenticated)", () => {
    let cookie: string;

    beforeAll(async () => {
        cookie = await loginAsAdmin();
    });

    test("deletes progress successfully", async () => {
        const id = seedProgress("TT-001", "To be deleted", "user1", "2024-01-01 10:00:00");

        const res = await authRequest(cookie, `/api/v1/ticket/TT-001/progress/${id}`, {
            method: "DELETE",
        });

        expect(res.status).toBe(200);

        const body = await res.json() as JsonBody;
        expect(body.success).toBe(true);
        expect(body.data).toBeNull();

        // Verify it's gone from DB
        const row = testDb.prepare("SELECT * FROM ticket_progress WHERE id = ?").get(id);
        expect(row).toBeNull();
    });

    test("returns 404 for non-existent progress_id", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress/99999", {
            method: "DELETE",
        });

        expect(res.status).toBe(404);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Progress tidak ditemukan");
    });

    test("returns 404 when ticket does not exist", async () => {
        const id = seedProgress("TT-001", "Some progress", "user1", "2024-01-01 10:00:00");

        const res = await authRequest(cookie, `/api/v1/ticket/NONEXIST/progress/${id}`, {
            method: "DELETE",
        });

        expect(res.status).toBe(404);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Ticket tidak ditemukan");
    });

    test("returns 400 for invalid progress_id (non-number)", async () => {
        const res = await authRequest(cookie, "/api/v1/ticket/TT-001/progress/abc", {
            method: "DELETE",
        });

        expect(res.status).toBe(400);
    });
});

describe("Expired / invalid session", () => {
    test("request with invalid cookie returns 401", async () => {
        const res = await authRequest("some-invalid-token", "/api/v1/ticket/TT-001/progress");
        expect(res.status).toBe(401);

        const body = await res.json() as JsonBody;
        expect(body.error).toBe("Unauthorized");
    });
});
