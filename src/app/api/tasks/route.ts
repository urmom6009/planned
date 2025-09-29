import { NextRequest, NextResponse } from "next/server";
import { verifyAppToken } from "../_utils/auth";
import { fetchListTasks, mapToDPTask } from "../_utils/clickup";

export async function GET(req: NextRequest) {
    // 🔒 require app token (your magic-link JWT)
    if (!(await verifyAppToken(req.headers.get("authorization")))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const listId = process.env.CLICKUP_TASK_LIST_ID;
    if (!listId) return NextResponse.json({ error: "server_misconfig" }, { status: 500 });

    try {
        const tasks = await fetchListTasks(listId);
        const mapped = tasks
            .filter(t => !t.milestone)      // only non-milestones here
            .map(mapToDPTask);
        return NextResponse.json(mapped, { status: 200 });
    } catch (e) {
        console.error("/api/tasks failed:", e);
        return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
    }
}