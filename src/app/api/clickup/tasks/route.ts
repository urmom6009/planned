// src/app/api/clickup/tasks/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ClickUpTasksResponse } from "@/lib/clickup-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // no prerender

const CU_BASE = "https://api.clickup.com/api/v2";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return NextResponse.json(
      { error: "Auth required" },
      { status: 401, headers: { "WWW-Authenticate": 'Basic realm="DreamPlanner"' } }
    );
  }

  // Parse basic auth
  const [u, p] = atob(auth.slice(6)).split(":");
  if (u !== process.env.BASIC_USER || p !== process.env.BASIC_PASS) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ✅ Accept dynamic ids from ?ids=comma,separated,list
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const dynamicIds = idsParam ? idsParam.split(",").map(s => s.trim()).filter(Boolean) : [];

  // ✅ Fallback to defaults if none passed
  const defaultIds = process.env.CLICKUP_LIST_IDS
    ? process.env.CLICKUP_LIST_IDS.split(",").map(s => s.trim())
    : [];

  const listIds = dynamicIds.length > 0 ? dynamicIds : defaultIds;

  if (!process.env.CLICKUP_TOKEN || listIds.length === 0) {
    return NextResponse.json(
      { error: "Missing CLICKUP_TOKEN or CLICKUP_LIST_IDS" },
      { status: 400 }
    );
  }

  try {
    // Fetch and merge tasks for all selected lists
    const results = await Promise.all(
      listIds.map(async id => {
        const r = await fetch(`${CU_BASE}/list/${id}/task`, {
          headers: { Authorization: process.env.CLICKUP_TOKEN! },
          cache: "no-store",
        });
        const json: ClickUpTasksResponse = await r.json();
        return json.tasks ?? [];
      })
    );

    return NextResponse.json({ tasks: results.flat() });
  } catch (err) {
    console.error("ClickUp fetch failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}