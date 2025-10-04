export type Task = {
    id: string;
    listId?: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    progress?: number;
    due?: string;          // ISO date
    estimateMin?: number;
    tags?: string[];
    milestone?: string;
    createdAt: string;     // ISO
    updatedAt: string;     // ISO
};

export type List = { id: string; name: string };

type StoreShape = {
    tasks: Task[];
    lists: List[];
};

/** keep memory across hot-reloads in dev */
const g = globalThis as unknown as { __MEM?: StoreShape };

if (!g.__MEM) {
    const now = new Date().toISOString();
    g.__MEM = {
        lists: [{ id: "dev-default", name: "Dev List" }],
        tasks: [
            {
                id: crypto.randomUUID(),
                title: "Welcome to Dream",
                listId: "dev-default",
                progress: 0.2,
                priority: "normal",
                createdAt: now,
                updatedAt: now
            }
        ]
    };
}

export const store = {
    get lists(): List[] {
        return g.__MEM!.lists;
    },
    get tasks(): Task[] {
        return g.__MEM!.tasks;
    },
    set tasks(v: Task[]) {
        g.__MEM!.tasks = v;
    }
};