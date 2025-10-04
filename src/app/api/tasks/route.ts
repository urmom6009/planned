import { NextRequest, NextResponse } from "next/server";
import { requireBearer, HttpError } from "@/lib/auth";
import { store, Task } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateTaskBody = {
    title: string;
    listId?: string;
    description?: string;
    status?: string;
    priority?: string;
    estimateMin?: number;
    due?: string;        // ISO
    tags?: string[];
    milestone?: string;
};

function jsonBad(msg: string) {
    return NextResponse.json({ error: msg }, { status: 400 });
}

/** GET /api/tasks?listId=…  -> Task[] */
export async function GET(req: NextRequest) {
    try {
        requireBearer(req);
        const url = new URL(req.url);
        const listId = url.searchParams.get("listId") ?? undefined;

        const all = store.tasks;
        const filtered = listId ? all.filter(t => t.listId === listId) : all;
        // newest first
        const out = filtered.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        return NextResponse.json(out, { status: 200 });
    } catch (err) {
        const e = err as Error;
        const status = e instanceof HttpError ? e.status : 500;
        return NextResponse.json({ error: e.message }, { status });
    }
}

/** POST /api/tasks  -> Task */
export async function POST(req: NextRequest) {
    try {
        requireBearer(req);
        const body = (await req.json()) as CreateTaskBody | null;
        if (!body || typeof body.title !== "string" || body.title.trim().length === 0) {
            return jsonBad("Missing 'title'");
        }

        const now = new Date().toISOString();
        const doc: Task = {
            id: crypto.randomUUID(),
            title: body.title.trim(),
            listId: body.listId,
            description: body.description,
            status: body.status,
            priority: body.priority,
            progress: 0,
            estimateMin: body.estimateMin,
            due: body.due,
            tags: body.tags ?? [],
            milestone: body.milestone,
            createdAt: now,
            updatedAt: now
        };

        store.tasks = [doc, ...store.tasks];
        return NextResponse.json(doc, { status: 201 });
    } catch (err) {
        const e = err as Error;
        const status = e instanceof HttpError ? e.status : 500;
        return NextResponse.json({ error: e.message }, { status });
    }
}