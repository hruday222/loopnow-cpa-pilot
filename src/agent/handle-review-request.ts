type ReviewToolResult = {
    toolName: string;
    output: unknown;
  };
  
  export function hasHumanReviewRequest(
    toolResults: ReviewToolResult[],
  ): boolean {
    return toolResults.some(
      (result) =>
        result.toolName === "request_human_review" &&
        typeof result.output === "object" &&
        result.output !== null &&
        "status" in result.output &&
        result.output.status === "review_requested",
    );
  }