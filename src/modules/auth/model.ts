export type User = {
    id: number;
    username: string;
    password: string;
}

export type Session = {
    token: string;
    userId: number;
    username: string;
    createdAt?: Date;
    expiredAt: string;
}