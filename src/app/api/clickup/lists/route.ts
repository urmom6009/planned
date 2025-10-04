// src/app / api / clickup / lists / route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

type Space = { id: string; name: string };
type Folder = { id: string; name: string };
type FolderList = { id: string; name: string };
type FlatList = { id: string; name: string };

async function fetchJSON<T>(url: string, token: string): Promise<T> {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        // prevent caching while we iterate
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`ClickUp ${res.status} at ${url}: ${text}`);
    }
    return (await res.json()) as T;
}

export async function GET(_req: NextRequest) {
    try {
        const teamId = process.env.CLICKUP_TEAM_ID;
        const token = process.env.CLICKUP_API_TOKEN; // personal API token (temp)

        if (!teamId || !token) {
            return NextResponse.json(
                { error: "Server missing CLICKUP_TEAM_ID or CLICKUP_API_TOKEN" },
                { status: 500 }
            );
        }

        const all: FlatList[] = [];

        // 1) spaces
        const spaces = await fetchJSON<{ spaces: Space[] }>(
            `https://api.clickup.com/api/v2/team/${teamId}/space`,
            token
        );

        for (const s of spaces.spaces) {
            // 2a) folderless lists in space
            const folderless = await fetchJSON<{ lists: FolderList[] }>(
                `https://api.clickup.com/api/v2/space/${s.id}/list?archived=false`,
                token
            );
            all.push(...folderless.lists.map(l => ({ id: l.id, name: l.name })));

            // 2b) folders in space
            const folders = await fetchJSON<{ folders: (Folder & { lists?: FolderList[] })[] }>(
                `https://api.clickup.com/api/v2/space/${s.id}/folder`,
                token
            );

            // 2c) lists inside folders
            for (const f of folders.folders) {
                const lists = await fetchJSON<{ lists: FolderList[] }>(
                    `https://api.clickup.com/api/v2/folder/${f.id}/list`,
                    token
                );
                all.push(...lists.lists.map(l => ({ id: l.id, name: `${f.name} / ${l.name}` })));
            }
        }

        return NextResponse.json(all, { status: 200 });
    } catch (err) {
        return NextResponse.json(
            { error: String(err instanceof Error ? err.message : err) },
            { status: 500 }
        );
    }
}