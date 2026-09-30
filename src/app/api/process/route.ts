import { createReceiptProcessingStream } from "@/agent/process-receipt-stream";
import { checkProcessRateLimit } from "./rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProcessBody = { receiptId: string; message: string };

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  const clientId =
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

  const rateLimit = checkProcessRateLimit(clientId);

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }

  if (
    typeof body !== "object" || body === null ||
    typeof (body as ProcessBody).receiptId !== "string" ||
    typeof (body as ProcessBody).message !== "string"
  ) {
    return Response.json({ error: "receiptId and message are required." }, { status: 400 });
  }

  const payload = body as ProcessBody;
  if (payload.receiptId.length > 100 || payload.message.length > 4000) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  return new Response(createReceiptProcessingStream(payload), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
