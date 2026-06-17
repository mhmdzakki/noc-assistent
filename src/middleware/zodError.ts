import type { Context, Next } from "hono";
import { ZodError } from "zod";

export const zodErrorMiddleware = (error: Error, ctx: Context) => {
    try {
        if (error instanceof ZodError) {
            return ctx.json({ success: false, error: "Invalid request" }, 400);
        }
    } catch (err) {
        console.error("Error in zodErrorMiddleware:", err);
        return ctx.json({ success: false, error: "Internal server error" }, 500)
    }
    console.error("Unhandled error in zodErrorMiddleware:", error);
    return ctx.json({ success: false, error: "Internal server error" }, 500)
}