// src/lib/store.ts
type Task = {
    id: string; listId?: string; title: string; description?: string;
    status?: string; priority?: string; progress?: number;
    due?: string; estimateMin?: number; tags?: string[]; milestone?: string;
    createdAt: string; updatedAt: string;
};

let tasks: Task[] = [];

export const db = {
    task: {
        findMany: async ({ where, orderBy }: any) => {
            let out = tasks;
            if (where?.listId) out = out.filter(t => t.listId === where.listId);
            if (orderBy?.createdAt === 'desc') out = out.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
            return out;
        },
        create: async ({ data }: { data: Partial<Task> }) => {
            const now = new Date().toISOString();
            const doc: Task = {
                id: crypto.randomUUID(),
                title: data.title || 'Untitled',
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
        update: async ({ where, data }: { where: { id: string }, data: Partial<Task> }) => {
            const i = tasks.findIndex(t => t.id === where.id);
            if (i < 0) throw new Error('Not found');
            tasks[i] = { ...tasks[i], ...data, updatedAt: new Date().toISOString() };
            return tasks[i];
        },
    }
};