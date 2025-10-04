// src/app/api/tasks/[id]/route.ts
// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Store } from "../../../../lib/store";

type PatchBody = Partial<{
    title: string;
    notes: string;
    status: string;
    priority: string;
    progress: number;
    due: string;          // ISO
    estimateMin: number;
    milestone: string;
    listId: string;
}>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
    _req: NextRequest,
    ctx: { params: { id: string } }
) {
    const t = Store.get(ctx.params.id);
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(t, { status: 200 });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
    let body: PatchBody;
    try {
        body = (await req.json()) as PatchBody;
    } catch {
        return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
    }

    // Whitelist props
    const patch: PatchBody = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.notes === "string") patch.notes = body.notes;
    if (typeof body.status === "string") patch.status = body.status;
    if (typeof body.priority === "string") patch.priority = body.priority;
    if (typeof body.progress === "number") patch.progress = Math.max(0, Math.min(1, body.progress));
    if (typeof body.due === "string") patch.due = body.due;
    if (typeof body.estimateMin === "number") patch.estimateMin = body.estimateMin;
    if (typeof body.milestone === "string") patch.milestone = body.milestone;
    if (typeof body.listId === "string") patch.listId = body.listId;

    const updated = Store.update(ctx.params.id, patch);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated, { status: 200 });
}

// // PATCH + DELETE
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

// function mapTask(t: any) {
//     return {
//         id: t.id,
//         listId: t.listId,
//         title: t.title,
//         description: t.description ?? null,
//         notes: t.notes ?? null,
//         status: t.status,
//         priority: t.priority,
//         progress: t.progress,
//         estimateMin: t.estimateMin ?? null,
//         due: t.due ? t.due.toISOString() : null,
//         milestone: t.milestone ?? null,
//         tags: t.tags ?? [],
//         createdAt: t.createdAt.toISOString(),
//         updatedAt: t.updatedAt.toISOString(),
//     };
// }

// export async function PATCH(
//     req: NextRequest,
//     { params }: { params: { id: string } }
// ) {
//     const id = params.id;
//     const patch = await req.json();

//     // Build a typed update object
//     const data: any = {};
//     if (patch.title !== undefined) data.title = patch.title;
//     if (patch.description !== undefined) data.description = patch.description;
//     if (patch.notes !== undefined) data.notes = patch.notes;
//     if (patch.status !== undefined) data.status = patch.status;
//     if (patch.priority !== undefined) data.priority = patch.priority;
//     if (patch.progress !== undefined) data.progress = Number(patch.progress);
//     if (patch.estimateMin !== undefined) data.estimateMin = patch.estimateMin;
//     if (patch.due !== undefined) data.due = patch.due ? new Date(patch.due) : null;
//     if (patch.milestone !== undefined) data.milestone = patch.milestone;
//     if (patch.tags !== undefined) data.tags = Array.isArray(patch.tags) ? patch.tags : [];

//     const updated = await prisma.task.update({ where: { id }, data });
//     return NextResponse.json(mapTask(updated), { status: 200 });
// }

// export async function DELETE(
//     _req: NextRequest,
//     { params }: { params: { id: string } }
// ) {
//     await prisma.task.delete({ where: { id: params.id } });
//     return NextResponse.json({ ok: true }, { status: 200 });
// }