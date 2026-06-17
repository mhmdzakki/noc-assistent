import { authRouter } from "@/modules/auth/router";
import { ticketRouter } from "@/modules/ticket/router";
import { progressRouter } from "@/modules/progress/router";
import { Hono } from "hono";

export const router = new Hono();


router.route("/auth", authRouter);
router.route("/ticket", ticketRouter);
router.route("/ticket/:ticket_no/progress", progressRouter);

router.get("/health", (ctx) => {
    return ctx.json({ status: "ok" });
});