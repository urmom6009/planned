import { NextRequest, NextResponse } from "next/server";
import { requireBearer } from "@/lib/auth";
import { prisma } from "@/lib/store";

// make sure this route runs on the server runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        // require caller to send Authorization: Bearer <APP_TOKEN>
        requireBearer(req);

        // Example: return all lists from DB (adjust table name to your schema)
        // If you followed earlier Prisma schema, you may have `List` or similar:
        // const lists = await prisma.list.findMany({ select: { id: true, name: true } });

        // If you don't have a List model yet, return an empty array for now:
        const lists: Array<{ id: string; name: string }> = [];

        return NextResponse.json(lists, { status: 200 });
    } catch (err: any) {
        const status = Number(err?.status) || 500;
        return NextResponse.json({ error: err?.message ?? "Server error" }, { status });
    }
}