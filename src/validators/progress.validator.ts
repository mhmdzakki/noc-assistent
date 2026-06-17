import z from "zod";

export const createProgressValidation = z.object({
    description: z.string().min(1, "Description tidak boleh kosong"),
    created_by: z.string().nullable().optional(),
    log_time: z.string().nullable().optional(),
});

export const updateProgressValidation = z.object({
    description: z.string().min(1, "Description tidak boleh kosong"),
});

export const progressTicketNoParam = z.object({
    ticket_no: z.string().min(1),
});

export const progressIdParam = z.object({
    ticket_no: z.string().min(1),
    progress_id: z.coerce.number(),
});
