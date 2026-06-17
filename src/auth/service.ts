import { db } from "@/db";
import { AuthRepository } from "./repository";
import type { Session } from "./model";
import type { Result } from "@/types";


export class AuthService {

    private authRepo: AuthRepository;

    constructor() {
        this.authRepo = new AuthRepository(db);
    }

    async login(username: string, password: string): Promise<Result<Session>> {
        try {
            const user = this.authRepo.getUserByUsername(username);
            if (user.error || !user.data) {
                return { error: true };
            }
            const validatePassword = await Bun.password.verify(password, user.data.password);
            if (!validatePassword) {
                return { error: true };
            }
            const maxSessions = this.authRepo.countSession(user.data.id);

            if (maxSessions.error || maxSessions.data === undefined) {
                return { error: true };
            }

            // if (maxSessions.data.count >= 3) {
            const deleted = this.authRepo.deleteOldSession(user.data.id);
            if (deleted.error) {
                return { error: true };
            }
            // }
            const bytes = crypto.getRandomValues(new Uint8Array(32));
            const token = Buffer.from(bytes).toString("hex");

            const session = this.authRepo.createSession({
                token: token,
                userId: user.data.id,
                username: user.data.username,
                expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 day
            });

            if (session.error || !session.data) {
                return { error: true };
            }

            return { data: session.data };
        } catch (error) {
            console.error("Error during login:", error);
            return { error: true };
        }
    }

    checkSession(token: string): Result<void> {
        try {
            const session = this.authRepo.getSession(token);
            if (session.error || !session.data) {
                return { error: true };
            }
            return {};
        } catch (error) {
            console.error("Error checking session:", error);
            return { error: true };
        }
    }

    logout(token: string): Result<void> {
        try {
            const deleted = this.authRepo.deleteSession(token);
            if (deleted.error) {
                return { error: true };
            }
            return {};
        } catch (error) {
            console.error("Error during logout:", error);
            return { error: true };
        }
    }

    deleteExpiredSessions(): Result<void> {
        try {
            const deleted = this.authRepo.deleteExpiredSession();
            if (deleted.error) {
                return { error: true };
            }
            return {};
        } catch (error) {
            console.error("Error deleting expired sessions:", error);
            return { error: true };
        }
    }

}