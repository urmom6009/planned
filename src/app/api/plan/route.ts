import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ENC = new TextEncoder();

type Task = {
    id: string; title: string; estimateMin?: number; priority?: "low" | "medium" | "high";
    due?: string | null; deps?: string[];
};
type Body = {
    tasks: Task[];
    busy: { start: string; end: string }[]; // calendar busy
    startAt: string;
    until: string;
};

export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    // verify JWT
    const secret = process.env.MAGIC_EXCHANGE_SECRET!;
    try {
        await jwtVerify(token, ENC.encode(secret)); // throws if invalid/expired
    } catch {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // parse body
    let body: Body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    // === OPTION A: quick local greedy (always succeeds) ===
    // return NextResponse.json({ blocks: greedy(body) });

    // === OPTION B: call OpenAI server-side (replace with your preferred model) ===
    const apiKey = process.env.OPENAI_API_KEY!;
    const prompt = buildPrompt(body);
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "You output strict JSON only." },
            { role: "user", content: prompt }],
            temperature: 0.2,
            response_format: { type: "json_object" }
        })
    });

    if (!r.ok) return NextResponse.json({ error: "llm_failed" }, { status: 500 });
    const j = await r.json();
    // expect { blocks: [{taskId, start, end}] }
    try {
        const content = j.choices[0].message.content;
        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);
    } catch {
        return NextResponse.json({ error: "bad_llm_output" }, { status: 502 });
    }
}

function buildPrompt(b: Body) {
    const s = new Date(b.startAt).toISOString();
    const u = new Date(b.until).toISOString();
    return JSON.stringify({
        instructions:
            "Plan focused work blocks. Respect busy intervals. Favor high priority. Keep JSON: {blocks:[{taskId,start,end}]}",
        window: { start: s, end: u },
        busy: b.busy,
        tasks: b.tasks
    });
}