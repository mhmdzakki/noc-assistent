import { Context, Hono } from "hono";
import { AuthController } from "./controller";
import z from "zod";
import { zValidator } from "@hono/zod-validator";

export const authRouter = new Hono();
const authHandler = new AuthController();

const loginValidation = z.object({
    username: z.string().min(3).max(20),
    password: z.string().min(5).max(30),
})

authRouter.post("/login", zValidator('json', loginValidation, (result, ctx) => {
    if (!result.success) {
        throw result.error
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