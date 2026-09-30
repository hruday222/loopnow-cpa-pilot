import { db } from "@/db/index";

export const runtime = "nodejs";

export async function GET() {
  try {
    db.prepare("SELECT 1 AS ok").get();
    return Response.json({
      status: "ok",
      service: "loopnow-cpa-copilot",
      database: "ok",
    });
  } catch {
    return Response.json(
      { status: "error", service: "loopnow-cpa-copilot", database: "error" },
      { status: 503 },
    );
  }
}
