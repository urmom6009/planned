// ClickUp -> DreamPlanner Task mapping
export type DPTask = {
  id: string;
  title: string;
  milestone?: string;
  estimateMin?: number;
  due?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "urgent" | "high" | "medium" | "low";
  deps?: string[];
  tags?: string[];
  progress?: number;
  parentId?: string;
  url?: string;
};

export type ClickUpStatus = {
  status?: string | null;
  type?: string | null;
};

export type ClickUpPriority = {
  id?: string | null;
  priority?: string | null;
};

export type ClickUpDependency = {
  task_id?: string | null;
};

export type ClickUpTag = {
  name?: string | null;
} | string;

export type ClickUpTask = {
  id: string;
  name?: string | null;
  parent?: string | null;
  status?: ClickUpStatus | null;
  priority?: ClickUpPriority | null;
  due_date?: string | number | null;
  time_estimate?: string | number | null;
  url?: string | null;
  dependencies?: ClickUpDependency[] | null;
  tags?: ClickUpTag[] | null;
};

export type ClickUpTasksResponse = {
  tasks?: ClickUpTask[];
};

const statusMap: Record<string, DPTask["status"]> = {
  // customize to your ClickUp statuses
  todo: "todo",
  "to do": "todo",
  backlog: "todo",
  open: "todo",
  inprogress: "in_progress",
  "in progress": "in_progress",
  doing: "in_progress",
  review: "review",
  done: "done",
  closed: "done",
};

const prioMap: Record<string, DPTask["priority"]> = {
  urgent: "urgent",
  high: "high",
  normal: "medium",
  medium: "medium",
  low: "low",
};

export function mapClickUpTasks(cuTasks: ClickUpTask[]): DPTask[] {
  return cuTasks.map((t) => {
    const statusName =
      (t.status?.status ?? t.status?.type ?? "").toLowerCase();
    const priorityName =
      (t.priority?.priority ?? t.priority?.id ?? "normal").toLowerCase();

    const rawDueDate =
      typeof t.due_date === "string" || typeof t.due_date === "number"
        ? Number(t.due_date)
        : undefined;
    const dueISO =
      rawDueDate !== undefined && !Number.isNaN(rawDueDate)
        ? new Date(rawDueDate).toISOString()
        : undefined;

    const rawEstimate =
      typeof t.time_estimate === "string" || typeof t.time_estimate === "number"
        ? Number(t.time_estimate)
        : undefined;
    const estimateMin =
      rawEstimate !== undefined && !Number.isNaN(rawEstimate)
        ? Math.round(rawEstimate / 60000)
        : undefined;

    const deps = Array.isArray(t.dependencies)
      ? t.dependencies
          .map((d) => d?.task_id)
          .filter((id): id is string => Boolean(id))
      : [];

    const tags = Array.isArray(t.tags)
      ? t.tags
          .map((tag) =>
            typeof tag === "string" ? tag : tag?.name ?? undefined,
          )
          .filter((tag): tag is string => Boolean(tag))
      : [];

    const parentId = t.parent ?? undefined;
    const milestone = parentId
      ? cuTasks.find((x) => x.id === parentId)?.name ?? "Parent"
      : undefined;

    return {
      id: t.id,
      title: t.name ?? "(untitled)",
      milestone,
      estimateMin,
      due: dueISO,
      status: statusMap[statusName] ?? "todo",
      priority: prioMap[priorityName] ?? "medium",
      deps,
      tags,
      url: t.url ?? undefined,
      // ClickUp custom fields could hold progress; default to undefined
      progress: undefined,
      parentId,
    };
  });
}
