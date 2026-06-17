import type { Changes, Database, Statement } from "bun:sqlite"
import type { Session, User } from "./model"
import type { Result } from "@/types";


export class AuthRepository {
    private stmtGetUserByUsername: Statement<User, [string]>;
    private stmtCreateSession: Statement<Session, [string, number, string, string]>;
    private stmtGetSession: Statement<Session, [string]>;
    private stmtCountSession: Statement<{ count: number }, [number]>;
    private stmtDeleteSession: Statement<never, [string]>;
    private stmtDeleteOldSession: Statement<never, [number]>;
    private stmtdeleteExpiredSession: Statement<never, []>;

    constructor(private db: Database) {
        this.stmtGetUserByUsername = db.prepare<User, [string]>("SELECT id, username, password FROM users WHERE username = ?");
        this.stmtCreateSession = db.prepare<Session, [string, number, string, string]>("INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)");
        this.stmtGetSession = db.prepare<Session, [string]>("SELECT token, user_id, username, created_at, expires_at FROM sessions WHERE token = ? AND expires_at > datetime('now') ");
        this.stmtDeleteSession = db.prepare<never, [string]>("DELETE FROM sessions WHERE token = ?");
        this.stmtCountSession = db.prepare<{ count: number }, [number]>("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND expires_at > datetime('now')");
        this.stmtDeleteOldSession = db.prepare<never, [number]>("DELETE FROM sessions WHERE id IN ( SELECT id FROM sessions WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT - 1 OFFSET 2 );");
        this.stmtdeleteExpiredSession = db.prepare<never, []>("DELETE FROM sessions WHERE expires_at <= datetime('now')");
    }

    getUserByUsername(username: string): Result<User> {
        try {
            const user = this.stmtGetUserByUsername.get(username);
            if (!user) return { error: true };
            return { data: user };
        } catch (error) {
            console.error("Error fetching user by username:", error);
            return { error: true };
        }
    }

    createSession(session: Session): Result<Session> {
        try {
            const { token, userId, username, expiredAt } = session

            const data = this.stmtCreateSession.run(token, userId, username, expiredAt);
            if (!data) return { error: true };
            return { data: session };
        } catch (error) {
            console.error("Error creating session:", error);
            return { error: true };
        }
    }

    getSession(token: string): Result<Session> {
        try {
            const session = this.stmtGetSession.get(token);
            if (!session) return { error: true };
            return { data: session };
        } catch (error) {
            console.error("Error fetching session:", error);
            return { error: true };
        }
    }

    countSession(userId: number): Result<{ count: number }> {
        try {
            const count = this.stmtCountSession.get(userId);
            if (!count) return { error: true };
            return { data: count };
        } catch (error) {
            console.error("Error counting session:", error);
            return { error: true };
        }
    }

    deleteSession(token: string): Result<Changes> {
        try {
            const data = this.stmtDeleteSession.run(token);
            if (data.changes === 0) return { error: true };
            return { data };
        } catch (error) {
            console.error("Error deleting session:", error);
            return { error: true };
        }
    }

    deleteOldSession(userId: number): Result<Changes> {
        try {
            const data = this.stmtDeleteOldSession.run(userId);
            return { data };
        } catch (error) {
            console.error("Error deleting old session:", error);
            return { error: true };
        }
    }

    deleteExpiredSession(): Result<Changes> {
        try {
            const data = this.stmtdeleteExpiredSession.run();
            return { data: data };
        } catch (error) {
            console.error("Error deleting old session:", error);
            return { error: true };
        }
    }
}




