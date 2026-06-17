import { authRouter } from "@/auth/router";
import { ticketRouter } from "@/modules/ticket/router";
import { Hono } from "hono";

export const router = new Hono();


router.route("/auth", authRouter);
router.route("/ticket", ticketRouter);

router.get("/health", (ctx) => {
    return ctx.json({ status: "ok" });
});