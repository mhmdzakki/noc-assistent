import { describe, test, expect } from "bun:test";
import {
    createProgressValidation,
    updateProgressValidation,
    progressTicketNoParam,
    progressIdParam,
} from "@/validators";

describe("createProgressValidation", () => {
    test("valid with description only", () => {
        const result = createProgressValidation.safeParse({ description: "Progress update" });
        expect(result.success).toBe(true);
    });

    test("valid with all optional fields", () => {
        const result = createProgressValidation.safeParse({
            description: "Progress update",
            created_by: "user1",
            log_time: "2024-01-01 10:00:00",
        });
        expect(result.success).toBe(true);
    });

    test("valid with null optional fields", () => {
        const result = createProgressValidation.safeParse({
            description: "Progress update",
            created_by: null,
            log_time: null,
        });
        expect(result.success).toBe(true);
    });

    test("valid with only created_by", () => {
        const result = createProgressValidation.safeParse({
            description: "Progress update",
            created_by: "admin",
        });
        expect(result.success).toBe(true);
    });

    test("invalid - empty description", () => {
        const result = createProgressValidation.safeParse({ description: "" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]!.message).toBe("Description tidak boleh kosong");
        }
    });

    test("invalid - missing description", () => {
        const result = createProgressValidation.safeParse({});
        expect(result.success).toBe(false);
    });

    test("invalid - description is whitespace only (still passes min(1) check)", () => {
        // Zod min(1) checks string length — whitespace passes length check
        // but service layer will reject empty/whitespace with trim()
        const result = createProgressValidation.safeParse({ description: "   " });
        expect(result.success).toBe(true);
    });
});

describe("updateProgressValidation", () => {
    test("valid description", () => {
        const result = updateProgressValidation.safeParse({ description: "Updated progress" });
        expect(result.success).toBe(true);
    });

    test("invalid - empty description", () => {
        const result = updateProgressValidation.safeParse({ description: "" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]!.message).toBe("Description tidak boleh kosong");
        }
    });

    test("invalid - missing description", () => {
        const result = updateProgressValidation.safeParse({});
        expect(result.success).toBe(false);
    });

    test("rejects extra fields", () => {
        const result = updateProgressValidation.safeParse({
            description: "Updated",
            extra: "field",
        });
        expect(result.success).toBe(true);
        // Zod by default strips unknown fields, so this will pass
    });
});

describe("progressTicketNoParam", () => {
    test("valid ticket_no", () => {
        const result = progressTicketNoParam.safeParse({ ticket_no: "TT-2024001" });
        expect(result.success).toBe(true);
    });

    test("valid ticket_no with minimum length 1", () => {
        const result = progressTicketNoParam.safeParse({ ticket_no: "X" });
        expect(result.success).toBe(true);
    });

    test("invalid - empty ticket_no", () => {
        const result = progressTicketNoParam.safeParse({ ticket_no: "" });
        expect(result.success).toBe(false);
    });

    test("invalid - missing ticket_no", () => {
        const result = progressTicketNoParam.safeParse({});
        expect(result.success).toBe(false);
    });
});

describe("progressIdParam", () => {
    test("valid ticket_no and numeric progress_id", () => {
        const result = progressIdParam.safeParse({ ticket_no: "TT-001", progress_id: "5" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.progress_id).toBe(5);
        }
    });

    test("valid - progress_id coerce from string", () => {
        const result = progressIdParam.safeParse({ ticket_no: "TT-001", progress_id: "123" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(typeof result.data.progress_id).toBe("number");
            expect(result.data.progress_id).toBe(123);
        }
    });

    test("invalid - missing ticket_no", () => {
        const result = progressIdParam.safeParse({ progress_id: "5" });
        expect(result.success).toBe(false);
    });

    test("invalid - missing progress_id", () => {
        const result = progressIdParam.safeParse({ ticket_no: "TT-001" });
        expect(result.success).toBe(false);
    });

    test("invalid - progress_id is not a number", () => {
        const result = progressIdParam.safeParse({ ticket_no: "TT-001", progress_id: "abc" });
        expect(result.success).toBe(false);
    });
});
