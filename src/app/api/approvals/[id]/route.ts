import { decideApproval } from "@/db/repository";

export const runtime = "nodejs";

type DecisionBody = {
  decision: "approve" | "reject" | "edit";
  category?: string;
  transactionType?: "expense" | "cash_deposit";
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }

  if (
    typeof body !== "object" || body === null ||
    !["approve", "reject", "edit"].includes(String((body as DecisionBody).decision))
  ) {
    return Response.json({ error: "decision must be approve, reject, or edit." }, { status: 400 });
  }

  try {
    const result = decideApproval({
      approvalId: id,
      decision: (body as DecisionBody).decision,
      category: (body as DecisionBody).category,
      transactionType: (body as DecisionBody).transactionType,
    });
    return Response.json({ approval: result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Approval failed." },
      { status: 400 },
    );
  }
}
