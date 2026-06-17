import { cors } from "hono/cors";


export const corsMiddleware = cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    maxAge: 60 * 60, // 1 hour
    credentials: true,
});