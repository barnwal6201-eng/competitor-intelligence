import { z } from "zod";
import { completeJson, type ChatCompletionResult, OpenAIError } from "./openaiClient";
import type { AnalysisConfidence } from "../models/Analysis";
import type { ChangeCategory } from "../models/Change";

// Phase 6: the analyzer (PRD section 11). It turns a list of detected
// changes into one structured analysis — summary, implications, strengths,
// weaknesses, suggested sales responses, talking points — plus a
// confidence indicator.
//
// Three rules from the PRD are enforced here, not just hoped for:
//  1. Structured JSON only — the model must return exactly this shape,
//     and the response is validated with Zod before anything is saved.
//     An invalid response is an error, never a half-saved analysis.
//  2. No invented facts — the prompt lists the changes and nothing else,
//     and instructs the model to use only those facts. Anything it cannot
//     support from the list, it must say so (or mark confidence low).
//  3. Verified vs AI-generated stays separate — the analysis stores the
//     source changes alongside the AI text, so a reader can always check
//     what the model actually based its claims on.

export interface AnalyzedChange {
  sourceType: "pricing" | "changelog" | "careers" | "reviews";
  category: ChangeCategory;
  significance: "high" | "medium" | "low";
  title: string;
  previousValue?: unknown;
  newValue?: unknown;
  sourceUrl: string;
  detectedAt: Date | string;
}

const stringList = z.array(z.string().min(1).max(500)).max(10);

export const AnalysisJsonSchema = z.object({
  summary: z.string().min(10).max(2000),
  implications: stringList,
  strengths: stringList,
  weaknesses: stringList,
  suggestedResponses: stringList,
  talkingPoints: stringList,
  confidence: z.enum(["high", "medium", "low"]),
});

export type ParsedAnalysis = z.infer<typeof AnalysisJsonSchema>;

export function buildAnalysisPrompt(
  competitorName: string,
  changes: AnalyzedChange[]
): { system: string; user: string } {
  const system = [
    "You are a competitive intelligence analyst for a B2B SaaS sales team.",
    "You will be given a list of verified changes detected on one competitor's public pages.",
    "Rules:",
    "1. Use ONLY the facts in the list below. Never invent prices, features, dates, quotes, or numbers that are not listed.",
    "2. Every implication, strength, weakness, response, and talking point must trace back to at least one listed change. If the list does not support a conclusion, say so instead of guessing.",
    "3. Distinguish facts from interpretation: the summary states what changed; the other sections are your interpretation of what it could mean.",
    "4. If the changes are minor or unclear, say so and set confidence to low — do not inflate them.",
    "5. Return JSON ONLY, with exactly these keys: summary (string), implications (string[]), strengths (string[]), weaknesses (string[]), suggestedResponses (string[]), talkingPoints (string[]), confidence (one of high, medium, low). No extra keys, no markdown, no commentary.",
  ].join("\n");

  const lines = changes.map((c, i) => {
    const prev = formatValue(c.previousValue);
    const next = formatValue(c.newValue);
    const values = prev !== "" || next !== "" ? ` (${prev !== "" ? prev : "—"} → ${next !== "" ? next : "—"})` : "";
    const when = c.detectedAt instanceof Date ? c.detectedAt.toISOString() : String(c.detectedAt);
    return `${i + 1}. [${c.sourceType}] ${c.category} (${c.significance} significance) — ${c.title}${values} — detected ${when} — source: ${c.sourceUrl}`;
  });

  const user = [
    `Competitor: ${competitorName}`,
    `Detected changes (${changes.length}):`,
    ...lines,
    "",
    "Analyse these changes and return the JSON described in the system prompt.",
  ].join("\n");

  return { system, user };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Runs one analysis. The client is injectable so tests can pass a stub
// instead of calling OpenAI. Throws OpenAIError on transport problems and
// on responses that fail validation — the caller saves nothing in that case.
export async function analyzeChanges(
  competitorName: string,
  changes: AnalyzedChange[],
  client: (prompt: { system: string; user: string }) => Promise<ChatCompletionResult> = completeJson
): Promise<{ analysis: ParsedAnalysis; usage: { model: string; promptTokens?: number; completionTokens?: number } }> {
  if (changes.length === 0) {
    throw new OpenAIError("No changes to analyse", 400);
  }
  const prompt = buildAnalysisPrompt(competitorName, changes);
  const result = await client(prompt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new OpenAIError("OpenAI returned a response that is not valid JSON — try again", 502);
  }
  const validated = AnalysisJsonSchema.safeParse(parsed);
  if (!validated.success) {
    throw new OpenAIError(
      "OpenAI returned a response in the wrong shape — try again",
      502
    );
  }
  return {
    analysis: validated.data as ParsedAnalysis,
    usage: {
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    },
  };
}

// Re-exported for the controller's typing.
export type { AnalysisConfidence };
