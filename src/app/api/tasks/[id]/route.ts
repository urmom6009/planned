// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBearer } from "@/lib/auth";
import { Store, Task } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    if (!getBearer(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const t = Store.getTask(params.id);
    return t ? NextResponse.json(t, { status: 200 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    if (!getBearer(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const patch = (await req.json().catch(() => ({}))) as Partial<Task>;
    const upd = Store.updateTask(params.id, patch);
    return upd ? NextResponse.json(upd, { status: 200 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    if (!getBearer(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ok = Store.deleteTask(params.id);
    return ok ? NextResponse.json({ ok: true }, { status: 200 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}