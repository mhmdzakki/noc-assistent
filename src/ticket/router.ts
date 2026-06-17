import { Hono } from "hono";
import { TicketController } from "./controller";
import z from "zod";
import { zValidator } from "@hono/zod-validator";

const getTicketValidation = z.object({
    ticket_no: z.string().min(5).max(20),
})

const getAllTicketsValidation = z.object({
    status: z.enum(["Open", "Closed"]),
    search: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
})

export const ticketRouter = new Hono();
const ticketController = new TicketController();

ticketRouter.get("/", async (ctx) => {
    return ticketController.getAll(ctx);
})

ticketRouter.get("/:ticket_no", zValidator('param', getTicketValidation, (result, ctx) => {
    if (!result.success) {
        const body = { success: false, error: "Invalid request" };
        return ctx.json(body, 400);
    }
}), async (ctx) => {
    // const ticket_no = ctx.req.param("ticket_no");
    const ticket_no = ctx.req.valid('param').ticket_no;
    return ticketController.getById(ctx, ticket_no);
})

ticketRouter.patch("/:ticket_no/root-cause", async (ctx) => {
    const ticket_no = ctx.req.param("ticket_no");
    return await ticketController.addRootCause(ctx, ticket_no);
})

ticketRouter.patch("/:ticket_no/action", async (ctx) => {
    const ticket_no = ctx.req.param("ticket_no");
    return await ticketController.addAction(ctx, ticket_no);
})

ticketRouter.post("/:ticket_no/close", async (ctx) => {
    const ticket_no = ctx.req.param("ticket_no");
    return await ticketController.closeTicket(ctx, ticket_no);
})
