// src/app/api/clickup/lists/route.ts
import { NextRequest, NextResponse } from 'next/server';

type ClickUpList = { id: string; name: string };
type ClickUpSpace = { id: string; name: string };
type ClickUpFolder = { id: string; name: string };
type ClickUpFolderList = { id: string; name: string };
type ClickUpFolderlessList = { id: string; name: string };

// Utility: typed fetch JSON
async function fetchJSON<T>(url: string, token: string): Promise<T> {
    const res = await fetch(url, {
        headers: { Authorization: token.startsWith('Bearer') ? token : `Bearer ${token}` },
        // ClickUp wants JSON; GETs do not need content-type.
        next: { revalidate: 0 }, // Avoid caching in build
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`ClickUp ${res.status} ${res.statusText} at ${url}: ${text}`);
    }
    return (await res.json()) as T;
}

export async function GET(req: NextRequest) {
    try {
        // 1) Resolve ClickUp token
        // Prefer bearer auth from request; fall back to env CLICKUP_API_TOKEN for testing.
        const authHeader = req.headers.get('authorization') ?? '';
        const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : process.env.CLICKUP_API_TOKEN;
        if (!bearer) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2) Team (workspace) to enumerate from
        const teamId = process.env.CLICKUP_TEAM_ID;
        if (!teamId) {
            return NextResponse.json({ error: 'Server not configured: missing CLICKUP_TEAM_ID' }, { status: 500 });
        }

        // 3) Pull spaces in the team
        // GET /api/v2/team/{team_id}/space
        const spacesResp = await fetchJSON<{ spaces: ClickUpSpace[] }>(
            `https://api.clickup.com/api/v2/team/${teamId}/space`,
            bearer
        );

        const allLists: ClickUpList[] = [];

        for (const space of spacesResp.spaces) {
            // Folderless lists in the space
            // GET /api/v2/space/{space_id}/list?archived=false
            const folderless = await fetchJSON<{ lists: ClickUpFolderlessList[] }>(
                `https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`,
                bearer
            );
            allLists.push(...folderless.lists.map(l => ({ id: l.id, name: l.name })));

            // Folders in the space
            // GET /api/v2/space/{space_id}/folder
            const folders = await fetchJSON<{ folders: (ClickUpFolder & { lists?: ClickUpFolderList[] })[] }>(
                `https://api.clickup.com/api/v2/space/${space.id}/folder`,
                bearer
            );

            // Lists within each folder
            for (const f of folders.folders) {
                if (!f.id) continue;
                // GET /api/v2/folder/{folder_id}/list
                const inFolder = await fetchJSON<{ lists: ClickUpFolderList[] }>(
                    `https://api.clickup.com/api/v2/folder/${f.id}/list`,
                    bearer
                );
                allLists.push(...inFolder.lists.map(l => ({ id: l.id, name: `${f.name} / ${l.name}` })));
            }
        }

        // 4) Return normalized {id,name}[]
        return NextResponse.json(allLists, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}