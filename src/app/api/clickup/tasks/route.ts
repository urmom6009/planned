import { NextRequest, NextResponse } from "next/server";
import type { ClickUpTasksResponse } from "@/lib/clickup-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic" // no prerender

const CU_BASE = "https://api.clickup.com/api/v2";

export async function GET(_req: NextRequest) {
  const token = process.env.CLICKUP_TOKEN;
  const listIdsCSV = process.env.CLICKUP_LIST_IDS;

  if (!token || !listIdsCSV) {
    return NextResponse.json(
      { error: "Missing CLICKUP_TOKEN or CLICKUP_LIST_IDS" },
      { status: 400 }
    );
  }

  const listIds = listIdsCSV
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const results = await Promise.all(
    listIds.map(async (listId): Promise<ClickUpTasksResponse> => {
      const res = await fetch(`${CU_BASE}/list/${listId}/task?subtasks=true`, {
        headers: { Authorization: token },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`ClickUp ${res.status}`);
      return (await res.json()) as ClickUpTasksResponse;
    })
  );

  const tasks = results.flatMap((r) =>
    Array.isArray(r.tasks) ? r.tasks : []
  );
  return NextResponse.json({ tasks } satisfies ClickUpTasksResponse);
}
