import { Context, Hono } from "hono";
import { AuthController } from "./controller";
import z from "zod";
import { zValidator } from "@hono/zod-validator";

export const authRouter = new Hono();
const authHandler = new AuthController();

const loginValidation = z.object({
    username: z.string().min(3, "Username is required"),
    password: z.string().min(5, "Password is required"),
})

authRouter.post("/login", zValidator('json', loginValidation, (result, ctx) => {
    if (!result.success) {
        const body = { success: false, error: "Invalid input" };
        return ctx.json(body, 400);
    }
}), async (ctx) => {
    const credentials = ctx.req.valid('json');
    return await authHandler.login(ctx, credentials);
})

authRouter.post("/logout", async (ctx: Context) => {
    return authHandler.logout(ctx);
})

authRouter.delete("/session/expired", async (ctx: Context) => {
    console.log("Deleting expired sessions...");
    return authHandler.deleteExpiredSession(ctx);
})