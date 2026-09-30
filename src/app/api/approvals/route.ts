import { listPendingApprovals } from "@/db/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ approvals: listPendingApprovals() });
}
