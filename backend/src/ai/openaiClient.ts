// Phase 6: a thin AI client — plain fetch against an OpenAI-compatible
// Chat Completions API, no extra SDK dependency. The provider is Groq
// (https://api.groq.com/openai/v1): the key is read from the environment
// at call time (never from the frontend, never logged), and the model is
// configurable via OPENAI_MODEL (default openai/gpt-oss-120b). The env var
// names still say OPENAI_ because the code was written for OpenAI first;
// they now simply hold the Groq key and model.
//
// The client only does transport: it sends the prompt, enforces a timeout,
// and turns HTTP failures into plain-English errors. What the prompt says
// and whether the answer is valid JSON in the right shape is the
// analyzer's job (see ai/analyzer.ts), so this file stays testable with a
// stubbed fetch and needs no API key to import.

const REQUEST_TIMEOUT_MS = 60_000;

// The base URL is overridable for tests only (GROQ_API_BASE_URL): the
// Phase 11 suite points it at a local mock server so analysis can be
// tested end-to-end without a real Groq key or network. Production never
// sets it — the default below is the real Groq endpoint.
function getGroqUrl(): string {
  const base = (process.env.GROQ_API_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

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
  return process.env.OPENAI_MODEL?.trim() || "openai/gpt-oss-120b";
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
      "Groq API key is not configured — add OPENAI_API_KEY to backend/.env and restart the backend",
      503
    );
  }
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchFn(getGroqUrl(), {
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
      throw new OpenAIError("Groq took too long to respond — try again", 502);
    }
    throw new OpenAIError("Could not reach Groq — check your network and try again", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new OpenAIError("Groq rejected the API key — check OPENAI_API_KEY in backend/.env", 502);
    }
    if (res.status === 429) {
      throw new OpenAIError("Groq rate limit reached — wait a bit and try again", 502);
    }
    if (res.status === 402 || res.status === 403) {
      throw new OpenAIError(
        "Groq refused the request — check the key and the free-tier limits in your Groq console",
        502
      );
    }
    throw new OpenAIError(`Groq returned HTTP ${res.status} — try again`, 502);
  }

  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new OpenAIError("Groq returned an empty response — try again", 502);
  }
  return {
    content,
    model: data.model || model,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  };
}
