"use client";

import { useState } from "react";

export default function MagicLinkPage() {
    const [task, setTask] = useState("");
    const [mile, setMile] = useState("");
    const [link, setLink] = useState("");

    async function handleGenerate() {
        const res = await fetch("/api/admin/magiclink", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, mile }),
        });
        const data = await res.json();
        setLink(data.link);
    }

    return (
        <main className="p-6 max-w-lg mx-auto space-y-4">
            <input placeholder="ClickUp task list ID" value={task} onChange={e => setTask(e.target.value)} />
            <input placeholder="ClickUp milestone list ID" value={mile} onChange={e => setMile(e.target.value)} />
            <button onClick={handleGenerate}>Generate Link</button>
            {link && (
                <div>
                    <p>Magic link:</p>
                    <textarea readOnly value={link} className="w-full h-24" />
                </div>
            )}
        </main>
    );
}