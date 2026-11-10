// Phase 6: a thin OpenAI client — plain fetch against the Chat Completions
// API, no extra SDK dependency. The key is read from the environment at
// call time (never from the frontend, never logged), and the model is
// configurable via OPENAI_MODEL (default gpt-4o-mini: cheap and fast
// enough for short change summaries).
//
// The client only does transport: it sends the prompt, enforces a timeout,
// and turns HTTP failures into plain-English errors. What the prompt says
// and whether the answer is valid JSON in the right shape is the
// analyzer's job (see ai/analyzer.ts), so this file stays testable with a
// stubbed fetch and needs no API key to import.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 60_000;

export interface ChatCompletionResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

// Injectable fetch: the real global fetch in production, a stub in tests.
// The parameter exists only so tests can run without an API key or network.
export async function completeJson(
  prompt: { system: string; user: string },
  fetchFn: typeof fetch = fetch
): Promise<ChatCompletionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIError(
      "OpenAI API key is not configured — add OPENAI_API_KEY to backend/.env and restart the backend",
      503
    );
  }
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchFn(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        // Ask for JSON only, so the response parses without regex surgery.
        response_format: { type: "json_object" },
        // Low temperature: this is factual summarising, not creative writing.
        temperature: 0.3,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenAIError("OpenAI took too long to respond — try again", 502);
    }
    throw new OpenAIError("Could not reach OpenAI — check your network and try again", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new OpenAIError("OpenAI rejected the API key — check OPENAI_API_KEY in backend/.env", 502);
    }
    if (res.status === 429) {
      throw new OpenAIError("OpenAI rate limit reached — wait a bit and try again", 502);
    }
    if (res.status === 402 || res.status === 403) {
      throw new OpenAIError(
        "OpenAI refused the request — this usually means the API account has no billing/credits (a ChatGPT subscription does not include API credits)",
        502
      );
    }
    throw new OpenAIError(`OpenAI returned HTTP ${res.status} — try again`, 502);
  }

  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new OpenAIError("OpenAI returned an empty response — try again", 502);
  }
  return {
    content,
    model: data.model || model,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  };
}
