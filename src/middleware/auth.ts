import { AuthService } from "@/modules/auth/service";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

const authService = new AuthService();

const publicEndpoints = [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/session/expired",
]

export const authMiddleware = async (ctx: Context, next: Next) => {
    try {
        const path = ctx.req.path;
        const cookie = getCookie(ctx, "session");

        // skip endpoint public

        if (publicEndpoints.includes(path)) {
            return next()
        }

        if (!cookie) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        const session = authService.checkSession(cookie);
        if (session.error) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        await next();

    } catch (error) {

    }
}