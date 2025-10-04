// src/app/api/lists/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBearer } from "@/lib/auth";
import { Store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    if (!getBearer(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(Store.listAll(), { status: 200 });
}

export async function POST(req: NextRequest) {
    if (!getBearer(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const list = Store.createList(name);
    return NextResponse.json(list, { status: 201 });
}