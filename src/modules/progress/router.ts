import { Hono } from "hono";
import { ProgressController } from "./controller";
import { zValidator } from "@hono/zod-validator";
import { createProgressValidation, updateProgressValidation, progressTicketNoParam, progressIdParam } from "@/validators";

export const progressRouter = new Hono();
const progressController = new ProgressController();

// GET ALL PROGRESS FOR A TICKET
progressRouter.get("/",
    zValidator("param", progressTicketNoParam, (result) => {
        if (!result.success) {
            throw result.error;
        }
    }),
    async (ctx) => {
        const { ticket_no } = ctx.req.valid("param");
        return progressController.list(ctx, ticket_no);
    }
);

// CREATE PROGRESS
progressRouter.post("/",
    zValidator("param", progressTicketNoParam, (result) => {
        if (!result.success) {
            throw result.error;
        }
    }),
    zValidator("json", createProgressValidation, (result) => {
        if (!result.success) {
            throw result.error;
        }
    }),
    async (ctx) => {
        const { ticket_no } = ctx.req.valid("param");
        const { description, created_by, log_time } = ctx.req.valid("json");
        return await progressController.create(ctx, ticket_no, description, created_by ?? null, log_time ?? null);
    }
);

// UPDATE PROGRESS
progressRouter.put("/:progress_id",
    zValidator("param", progressIdParam, (result) => {
        if (!result.success) {
            throw result.error;
        }
    }),
    zValidator("json", updateProgressValidation, (result) => {
        if (!result.success) {
            throw result.error;
        }
    }),
    async (ctx) => {
        const { ticket_no, progress_id } = ctx.req.valid("param");
        const { description } = ctx.req.valid("json");
        return await progressController.update(ctx, ticket_no, progress_id, description);
    }
);

// DELETE PROGRESS
progressRouter.delete("/:progress_id",
    zValidator("param", progressIdParam, (result) => {
        if (!result.success) {
            throw result.error;
        }
    }),
    async (ctx) => {
        const { ticket_no, progress_id } = ctx.req.valid("param");
        return progressController.delete(ctx, ticket_no, progress_id);
    }
);
