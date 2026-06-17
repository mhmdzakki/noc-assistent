import type { Context } from "hono";
import { AuthService } from "./service";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ApiResponse } from "@/types/apiResponse";


export class AuthController {

    private authService: AuthService
    constructor() {
        this.authService = new AuthService();
    }

    private setSessionCookie(ctx: Context, token: string) {
        setCookie(ctx, "session", token, {
            path: "/",
            secure: true,
            // domain: "*",
            httpOnly: true,
            sameSite: "lax",
            maxAge: 24 * 60 * 60, // 1 day
        })
    }

    async login(ctx: Context, credentials: {
        username: string;
        password: string;
    }): Promise<Response> {
        try {
            const { username, password } = credentials;

            const result = await this.authService.login(username, password)
            if (result.error || !result.data) {
                const body: ApiResponse<null> = { success: false, error: "Invalid username or password" };
                return ctx.json(body, 401);
            }
            this.setSessionCookie(ctx, result.data.token);

            const body: ApiResponse<null> = { success: true, data: null };

            return ctx.json(body, 200);
        } catch (error) {
            console.error("Error during login:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    logout(ctx: Context): Response {
        try {
            const cookie = getCookie(ctx, "session");
            if (!cookie) {
                const body: ApiResponse<null> = { success: false, error: "Unauthorized" };
                return ctx.json(body, 401);
            }
            this.authService.logout(cookie);
            deleteCookie(ctx, "session");
            const data: ApiResponse<null> = { success: true, data: null };
            return ctx.json(data, 200);
        } catch (error) {
            console.error("Error during logout:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }

    deleteExpiredSession(ctx: Context): Response {
        try {
            const apiKey = ctx.req.header("x-api-key");
            if (apiKey !== process.env.API_KEY) {
                const body: ApiResponse<null> = { success: false, error: "Unauthorized" };
                return ctx.json(body, 401);
            }

            this.authService.deleteExpiredSessions();
            return new Response(null, { status: 204 });
        } catch (error) {
            console.error("Error deleting expired sessions:", error);
            const body: ApiResponse<null> = { success: false, error: "Internal server error" };
            return ctx.json(body, 500);
        }
    }
}