import { MODEL_CHAIN, generateText } from "@/lib/gemini";

export async function qwenSingle(_model: string, instruction: string, timeoutMs = 25000): Promise<string> {
  const { text } = await generateText({
    instruction,
    modelChain: MODEL_CHAIN,
    timeoutMs,
    totalTimeoutMs: 90000,
  });
  return text;
}

export async function qwenGenerate(instruction: string): Promise<string> {
  return qwenSingle("legacy", instruction);
}
