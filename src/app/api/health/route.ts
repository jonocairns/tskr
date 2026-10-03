// Liveness only: keep this independent of auth, tRPC, and the database.
export const GET = () => Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
