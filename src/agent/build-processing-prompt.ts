export type BuildProcessingPromptInput = {
    message: string;
  };
  
  export function buildProcessingPrompt(
    input: BuildProcessingPromptInput,
  ): string {
    return `
      User request:
  
      ${input.message}
    `;
  }