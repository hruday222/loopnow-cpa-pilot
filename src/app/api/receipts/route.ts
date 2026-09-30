import { listReceipts } from "@/db/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ receipts: listReceipts() });
}
