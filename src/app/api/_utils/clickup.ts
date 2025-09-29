type ClickUpTask = {
    id: string;
    name: string;
    status?: { status?: string };
    priority?: { priority?: string } | null;
    time_estimate?: number | null;     // ms
    due_date?: string | null;          // epoch ms as string
    tags?: { name: string }[];
    milestone?: boolean;
};

const CU_BASE = "https://api.clickup.com/api/v2";

function cuHeaders() {
    return {
        "Authorization": process.env.CLICKUP_API_TOKEN!,
        "Content-Type": "application/json"
    };
}

// Pull tasks from ONE list (include closed so you can filter client-side if you want)
export async function fetchListTasks(listId: string): Promise<ClickUpTask[]> {
    // Note: add pagination if your lists are huge
    const url = `${CU_BASE}/list/${listId}/task?include_closed=true&subtasks=true&order_by=created`;
    const r = await fetch(url, { headers: cuHeaders(), cache: "no-store" });
    if (!r.ok) throw new Error(`ClickUp ${r.status}`);
    const j = await r.json();
    return j.tasks ?? [];
}

// Map to your iOS model (DPTask)
export function mapToDPTask(t: ClickUpTask) {
    const estimateMin = t.time_estimate ? Math.max(1, Math.round(t.time_estimate / 60000)) : undefined;
    const dueISO = t.due_date ? new Date(Number(t.due_date)).toISOString() : null;
    const priority = (t.priority?.priority ?? "medium").toLowerCase(); // normalize

    return {
        id: t.id,
        title: t.name,
        status: t.status?.status ?? "open",
        priority,                       // "low" | "medium" | "high" (ClickUp sometimes has "urgent"; treat as "high" if you want)
        progress: 0,                    // TODO: compute if you track subtasks/completions
        due: dueISO,
        estimateMin,
        tags: (t.tags ?? []).map(x => x.name),
        milestone: t.milestone ? "Milestone" : undefined
    };
}