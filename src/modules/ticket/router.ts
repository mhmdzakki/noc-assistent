import { Hono } from "hono";
import { TicketController } from "./controller";
import { zValidator } from "@hono/zod-validator";
import { actionValidation, categoryValidation, getAllTicketsValidation, rootCauseValidation, ticketNumberValidation } from "@/validators";

export const ticketRouter = new Hono();
const ticketController = new TicketController();

// GET ALL TICKETS
ticketRouter.get("/",
    zValidator('query', getAllTicketsValidation, (result) => {
        if (!result.success) {
            console.error(result.error.issues.map(i => i.message));
            throw result.error
        }
    }),
    async (ctx) => {
        const query = ctx.req.valid('query');
        return ticketController.getAll(ctx, query);
    })

// GET TICKET BY ID
ticketRouter.get("/:ticket_no",
    zValidator('param', ticketNumberValidation, (result) => {
        if (!result.success) {
            throw result.error
        }
    }),
    async (ctx) => {
        // const ticket_no = ctx.req.param("ticket_no");
        const ticket_no = ctx.req.valid('param').ticket_no;
        return ticketController.getById(ctx, ticket_no);
    })

// ADD ROOT CAUSE
ticketRouter.patch("/:ticket_no/root-cause",
    zValidator('param', ticketNumberValidation, (result) => {
        if (!result.success) {
            throw result.error

        }
    }),
    zValidator('json', rootCauseValidation, (result) => {
        if (!result.success) {
            throw result.error
        }
    }),
    async (ctx) => {
        const ticket_no = ctx.req.valid("param").ticket_no;
        const root_cause = ctx.req.valid("json").root_cause;
        return await ticketController.addRootCause(ctx, ticket_no, root_cause);
    })

// ADD RESTORATION ACTION
ticketRouter.patch("/:ticket_no/action",
    zValidator('param', ticketNumberValidation, (result) => {
        if (!result.success) {
            throw result.error

        }
    }),
    zValidator('json', actionValidation, (result) => {
        if (!result.success) {
            throw result.error
        }
    }),
    async (ctx) => {
        const ticket_no = ctx.req.valid("param").ticket_no;
        const action = ctx.req.valid("json").action;
        return await ticketController.addAction(ctx, ticket_no, action);
    })

// ADD CATEGORY
ticketRouter.patch("/:ticket_no/category",
    zValidator('param', ticketNumberValidation, (result) => {
        if (!result.success) {
            throw result.error

        }
    }),
    zValidator('json', categoryValidation, (result) => {
        if (!result.success) {
            throw result.error
        }
    }),
    async (ctx) => {
        const ticket_no = ctx.req.valid("param").ticket_no;
        const category = ctx.req.valid("json").category;
        return await ticketController.addCategory(ctx, ticket_no, category);
    })

// CLOSE TICKET
ticketRouter.post("/:ticket_no/close",
    zValidator('param', ticketNumberValidation, (result) => {
        if (!result.success) {
            throw result.error
        }
    }),
    (ctx) => {
        const ticket_no = ctx.req.valid("param").ticket_no;
        return ticketController.closeTicket(ctx, ticket_no);
    })
