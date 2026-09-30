import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const provider =
  process.env.MODEL_PROVIDER?.trim().toLowerCase() || "gemini";

const modelName =
  process.env.MODEL_NAME?.trim() || "gemini-3.1-flash-lite";

export function getModelName(): string {
  return modelName;
}

export function createAgentModel(apiKey: string) {
  if (provider === "openrouter") {
    return createOpenRouter({ apiKey })(modelName);
  }

  if (provider === "groq") {
    return createGroq({ apiKey })(modelName);
  }

  if (provider === "gemini") {
    return createGoogleGenerativeAI({ apiKey })(modelName);
  }

  throw new Error(
    `Unsupported MODEL_PROVIDER "${provider}".`,
  );
}