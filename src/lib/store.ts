// src/lib/store.ts
export type DPTask = {
    id: string;
    listId?: string;
    title: string;
    notes?: string;
    status?: string;
    priority?: string;
    progress: number;   // 0..1
    due?: string;       // ISO8601
    estimateMin?: number;
    milestone?: string;
    createdAt: string;  // ISO
    updatedAt: string;  // ISO
};

const tasks: Map<string, DPTask> = new Map();

// Seed a single example so UI isn’t empty.
(function seed() {
    const id = "seed-1";
    if (!tasks.has(id)) {
        const now = new Date().toISOString();
        tasks.set(id, {
            id,
            title: "Welcome to DreamPlanner",
            progress: 0,
            createdAt: now,
            updatedAt: now,
        });
    }
})();

export const Store = {
    list(params?: { listId?: string }) {
        const all = Array.from(tasks.values());
        if (!params?.listId) return all;
        return all.filter(t => t.listId === params.listId);
    },
    get(id: string) {
        return tasks.get(id) ?? null;
    },
    create(input: Omit<DPTask, "id" | "createdAt" | "updatedAt">) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const t: DPTask = { id, createdAt: now, updatedAt: now, ...input };
        tasks.set(id, t);
        return t;
    },
    update(id: string, patch: Partial<Omit<DPTask, "id" | "createdAt">>) {
        const current = tasks.get(id);
        if (!current) return null;
        const updated: DPTask = {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
        };
        tasks.set(id, updated);
        return updated;
    },
    remove(id: string) {
        return tasks.delete(id);
    },
}; import { PrismaClient } from "@prisma/client";

declare global {
    // avoid re-instantiating in dev hot-reloads
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

export const prisma =
    global.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
    });

if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}