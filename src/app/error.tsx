"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <html>
            <body className="p-6">
                <div className="max-w-xl mx-auto border rounded-lg p-4">
                    <h1 className="text-lg font-bold">Something broke</h1>
                    <pre className="mt-2 text-sm whitespace-pre-wrap text-red-600">{error.message}</pre>
                    <button
                        onClick={() => reset()}
                        className="mt-4 rounded bg-pink-500 px-3 py-2 text-white"
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}