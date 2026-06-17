import { describe, test, expect } from "bun:test";
import z from "zod";

// Replicate the login validation schema from the router
const loginValidation = z.object({
    username: z.string().min(3).max(20),
    password: z.string().min(5).max(30),
});

describe("loginValidation", () => {
    test("valid credentials", () => {
        const result = loginValidation.safeParse({
            username: "admin",
            password: "admin123",
        });
        expect(result.success).toBe(true);
    });

    test("valid — username at minimum length (3)", () => {
        const result = loginValidation.safeParse({
            username: "abc",
            password: "12345",
        });
        expect(result.success).toBe(true);
    });

    test("valid — username at maximum length (20)", () => {
        const result = loginValidation.safeParse({
            username: "a".repeat(20),
            password: "12345",
        });
        expect(result.success).toBe(true);
    });

    test("valid — password at minimum length (5)", () => {
        const result = loginValidation.safeParse({
            username: "admin",
            password: "12345",
        });
        expect(result.success).toBe(true);
    });

    test("valid — password at maximum length (30)", () => {
        const result = loginValidation.safeParse({
            username: "admin",
            password: "a".repeat(30),
        });
        expect(result.success).toBe(true);
    });

    test("invalid — username too short (< 3)", () => {
        const result = loginValidation.safeParse({
            username: "ab",
            password: "admin123",
        });
        expect(result.success).toBe(false);
    });

    test("invalid — username too long (> 20)", () => {
        const result = loginValidation.safeParse({
            username: "a".repeat(21),
            password: "admin123",
        });
        expect(result.success).toBe(false);
    });

    test("invalid — password too short (< 5)", () => {
        const result = loginValidation.safeParse({
            username: "admin",
            password: "1234",
        });
        expect(result.success).toBe(false);
    });

    test("invalid — password too long (> 30)", () => {
        const result = loginValidation.safeParse({
            username: "admin",
            password: "a".repeat(31),
        });
        expect(result.success).toBe(false);
    });

    test("invalid — missing username", () => {
        const result = loginValidation.safeParse({
            password: "admin123",
        });
        expect(result.success).toBe(false);
    });

    test("invalid — missing password", () => {
        const result = loginValidation.safeParse({
            username: "admin",
        });
        expect(result.success).toBe(false);
    });

    test("invalid — empty object", () => {
        const result = loginValidation.safeParse({});
        expect(result.success).toBe(false);
    });
});
