
type Categories =
    | "Truk sawit"
    | "Pohon tumbang"
    | "Pemanen sawit"
    | "Bad core"
    | "Power issue"
    | "Cancel"
    | "Hit by Vehicle"
    | "Alat berat"
    | "No issue"
    | "Force major"
    | "Bull head pigtail"
    | "Vandalism"
    | "Hit by animal"
    | "Rabasan pohon"
    | "Pembersihan lahan";

export interface Tickets {
    id?: number;
    ticket_no: string;
    flp: string;
    status: string | "Open" | "Closed";
    segment: string;
    pic?: string;
    problem_desc: string;
    down_time?: null | string;
    up_time?: null | string;
    root_cause?: null | string;
    restoration_action?: null | string;
    category?: Categories;
    created_at?: Date | null;
}