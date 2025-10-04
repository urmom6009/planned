// src/lib/db.ts

export type Task = {
    id: string;
    listId?: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    progress?: number;      // 0..1
    due?: string;           // ISO8601
    estimateMin?: number;
    tags?: string[];
    milestone?: string;
    createdAt: string;      // ISO8601
    updatedAt: string;      // ISO8601
};

// ---- query/input shapes (no `any`) ----
export type TaskWhere = {
    listId?: string;
};

export type TaskOrderBy = {
    createdAt?: "asc" | "desc";
};

export type TaskCreate = {
    title: string;
    listId?: string;
    description?: string;
    status?: string;
    priority?: string;
    progress?: number;
    due?: string;
    estimateMin?: number;
    tags?: string[];
    milestone?: string;
};

export type TaskUpdate = Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>;

const tasks: Task[] = [];

// small helper to sort safely without mutating original array
function sortByCreatedAt(
    arr: readonly Task[],
    dir: "asc" | "desc"
): Task[] {
    const copy = [...arr];
    copy.sort((a, b) => {
        if (a.createdAt === b.createdAt) return 0;
        return dir === "desc"
            ? a.createdAt < b.createdAt ? 1 : -1
            : a.createdAt < b.createdAt ? -1 : 1;
    });
    return copy;
}

export const db = {
    task: {
        async findMany(args: { where?: TaskWhere; orderBy?: TaskOrderBy }): Promise<Task[]> {
            const { where, orderBy } = args;
            let out = tasks as Task[];

            if (where?.listId) {
                out = out.filter((t) => t.listId === where.listId);
            }
            if (orderBy?.createdAt) {
                out = sortByCreatedAt(out, orderBy.createdAt);
            }
            return out;
        },

        async create(args: { data: TaskCreate }): Promise<Task> {
            const { data } = args;
            const now = new Date().toISOString();

            const doc: Task = {
                id: crypto.randomUUID(),
                title: data.title || "Untitled",
                listId: data.listId,
                description: data.description,
                status: data.status,
                priority: data.priority,
                progress: data.progress ?? 0,
                due: data.due,
                estimateMin: data.estimateMin,
                tags: data.tags ?? [],
                milestone: data.milestone,
                createdAt: now,
                updatedAt: now,
            };

            tasks.unshift(doc);
            return doc;
        },

        async update(args: { where: { id: string }; data: TaskUpdate }): Promise<Task> {
            const { where, data } = args;
            const i = tasks.findIndex((t) => t.id === where.id);
            if (i < 0) throw new Error("Not found");

            const updated: Task = {
                ...tasks[i],
                ...data,
                updatedAt: new Date().toISOString(),
            };
            tasks[i] = updated;
            return updated;
        },
    },
};