// src/app/api/clickup/lists/route.ts
import { NextResponse } from "next/server";

const CU = "https://api.clickup.com/api/v2";
const TOKEN = process.env.CLICKUP_TOKEN!;

async function cu(path: string) {
    const r = await fetch(`${CU}${path}`, { headers: { Authorization: TOKEN } });
    if (!r.ok) throw new Error(`ClickUp ${path} ${r.status}`);
    return r.json();
}

export async function GET() {
    if (!TOKEN) return NextResponse.json({ error: "Missing CLICKUP_TOKEN" }, { status: 500 });

    // 1) teams
    const teams = await cu("/team");
    const out: any[] = [];

    // 2) spaces per team
    for (const team of teams.teams ?? []) {
        const spaces = await cu(`/team/${team.id}/space?archived=false`);
        for (const space of spaces.spaces ?? []) {
            // 3a) folderless lists in the space
            const folderless = await cu(`/space/${space.id}/list?archived=false`);
            for (const l of folderless.lists ?? []) {
                out.push({ id: l.id, name: l.name, space: space.name });
            }
            // 3b) lists inside folders
            const folders = await cu(`/space/${space.id}/folder?archived=false`);
            for (const f of folders.folders ?? []) {
                const lists = await cu(`/folder/${f.id}/list?archived=false`);
                for (const l of lists.lists ?? []) {
                    out.push({ id: l.id, name: l.name, space: space.name, folder: f.name });
                }
            }
        }
    }

    // sort a bit for UX
    out.sort((a, b) => (a.space + (a.folder ?? "") + a.name).localeCompare(b.space + (b.folder ?? "") + b.name));
    return NextResponse.json({ lists: out });
}