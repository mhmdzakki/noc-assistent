import z from "zod"

export const ticketNumberValidation = z.object({
    ticket_no: z.string().min(5).max(20),
})

export const getAllTicketsValidation = z.object({
    status: z.enum(["Open", "Closed"]),
    search: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
})

export const rootCauseValidation = z.object({
    root_cause: z.string().min(3).max(50),
})

export const actionValidation = z.object({
    action: z.string().min(3).max(100),
})

export const categoryValidation = z.object({
    category: z.string().min(3).max(50),
})