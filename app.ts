import { Hono } from "hono";
import { router } from "@/router";
import { authMiddleware, corsMiddleware, zodErrorMiddleware } from "@/middleware";
import { csrf } from "hono/csrf";
import { ZodError } from "zod";

const app = new Hono();

app.onError(zodErrorMiddleware);
app.use("/api/v1/*", corsMiddleware)
app.use("/api/v1/*", authMiddleware);

// app.use(csrf({ origin: 'http://localhost:5173' }));

app.route("/api/v1", router);


export default app;