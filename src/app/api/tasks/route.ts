// src/app/api/tasks/route.ts
// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Store, type DPTask } from "../../../lib/store";

type CreateBody = {
    listId?: string;
    title: string;
    notes?: string;
    status?: string;
    priority?: string;
    progress?: number;
    due?: string;          // ISO
    estimateMin?: number;
    milestone?: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const listId = url.searchParams.get("listId") ?? undefined;
    const result = Store.list({ listId });
    return NextResponse.json(result, { status: 200 });
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as CreateBody;
        if (!body.title || body.title.trim() === "") {
            return NextResponse.json({ error: "title is required" }, { status: 400 });
        }

        const taskInput: Omit<DPTask, "id" | "createdAt" | "updatedAt"> = {
            title: body.title.trim(),
            listId: body.listId,
            notes: body.notes,
            status: body.status,
            priority: body.priority,
            progress: Math.max(0, Math.min(1, body.progress ?? 0)),
            due: body.due,
            estimateMin: body.estimateMin,
            milestone: body.milestone,
        };

        const created = Store.create(taskInput);
        return NextResponse.json(created, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
    }
}
// // GET + POST
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

// // Map DB → wire type your iOS DPTask expects
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

// // GET /api/tasks?listId=abc
// export async function GET(req: NextRequest) {
//     const { searchParams } = new URL(req.url);
//     const listId = searchParams.get('listId');
//     if (!listId) {
//         return NextResponse.json({ error: 'Missing listId' }, { status: 400 });
//     }

//     const tasks = await prisma.task.findMany({
//         where: { listId },
//         orderBy: { createdAt: 'desc' },
//     });

//     return NextResponse.json(tasks.map(mapTask), { status: 200 });
// }

// // POST /api/tasks
// export async function POST(req: NextRequest) {
//     const body = await req.json();

//     // Minimal validation; expand as you like
//     if (!body?.listId || !body?.title) {
//         return NextResponse.json({ error: 'listId and title required' }, { status: 400 });
//     }

//     const created = await prisma.task.create({
//         data: {
//             listId: body.listId,
//             title: body.title,
//             description: body.description ?? null,
//             notes: body.notes ?? null,
//             status: body.status ?? 'todo',
//             priority: body.priority ?? 'normal',
//             progress: typeof body.progress === 'number' ? body.progress : 0,
//             estimateMin: body.estimateMin ?? null,
//             due: body.due ? new Date(body.due) : null,
//             milestone: body.milestone ?? null,
//             tags: Array.isArray(body.tags) ? body.tags : [],
//         },
//     });

//     return NextResponse.json(mapTask(created), { status: 201 });
// }