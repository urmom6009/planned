import { NextRequest, NextResponse } from "next/server";
import { requireBearer, HttpError } from "@/lib/auth";
import { store, Task } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = Partial<Pick<
    Task,
    "title" | "description" | "status" | "priority" | "progress" | "estimateMin" | "due" | "tags" | "milestone"
>>;

/** helper: find task index by id */
function idx(id: string): number {
    return store.tasks.findIndex(t => t.id === id);
}

/** GET /api/tasks/:id */
export async function GET(_req: NextRequest, context: { params: { id: string } }) {
    try {
        const { id } = context.params;
        const i = idx(id);
        if (i < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(store.tasks[i], { status: 200 });
    } catch (err) {
        const e = err as Error;
        const status = e instanceof HttpError ? e.status : 500;
        return NextResponse.json({ error: e.message }, { status });
    }
}

/** PATCH /api/tasks/:id */
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
    try {
        requireBearer(req);
        const { id } = context.params;
        const i = idx(id);
        if (i < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = (await req.json()) as PatchBody | null;
        if (!body) return NextResponse.json({ error: "Empty body" }, { status: 400 });

        const updated: Task = {
            ...store.tasks[i],
            ...body,
            updatedAt: new Date().toISOString()
        };
        const copy = store.tasks.slice();
        copy[i] = updated;
        store.tasks = copy;

        return NextResponse.json(updated, { status: 200 });
    } catch (err) {
        const e = err as Error;
        const status = e instanceof HttpError ? e.status : 500;
        return NextResponse.json({ error: e.message }, { status });
    }
}