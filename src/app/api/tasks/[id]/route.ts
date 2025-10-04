// src/app/api/tasks/[id]/route.ts
// PATCH + DELETE
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function mapTask(t: any) {
    return {
        id: t.id,
        listId: t.listId,
        title: t.title,
        description: t.description ?? null,
        notes: t.notes ?? null,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
        estimateMin: t.estimateMin ?? null,
        due: t.due ? t.due.toISOString() : null,
        milestone: t.milestone ?? null,
        tags: t.tags ?? [],
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    };
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const id = params.id;
    const patch = await req.json();

    // Build a typed update object
    const data: any = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.progress !== undefined) data.progress = Number(patch.progress);
    if (patch.estimateMin !== undefined) data.estimateMin = patch.estimateMin;
    if (patch.due !== undefined) data.due = patch.due ? new Date(patch.due) : null;
    if (patch.milestone !== undefined) data.milestone = patch.milestone;
    if (patch.tags !== undefined) data.tags = Array.isArray(patch.tags) ? patch.tags : [];

    const updated = await prisma.task.update({ where: { id }, data });
    return NextResponse.json(mapTask(updated), { status: 200 });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true }, { status: 200 });
}