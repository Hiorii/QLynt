import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Seed = {
  id?: string;
  text: string;
  severity?: "must" | "should" | "nice" | string;
};

type ReqBody = {
  issueKey: string;
  title: string;
  description: string;
  hasAcceptanceCriteria?: boolean;
  signals?: string[];
  seeds: Seed[]; // lista checklist items
  options?: {
    maxItems?: number; // limit safety
    concurrency?: number; // na start sekwencyjnie, ale zostawiamy opcję
  };
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization, apikey",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });

const mustEnv = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

const safeStr = (x: unknown) => (typeof x === "string" ? x : "");

const mapSeverity = (sev?: string): "must" | "should" | "nice" => {
  const s = (sev || "").toLowerCase();
  if (s === "must") return "must";
  if (s === "should") return "should";
  return "nice";
};

// ---------- OpenAI helper (Responses API) ----------
async function callOpenAIResponsesJSON({
  apiKey,
  model,
  instructions,
  inputObj,
  maxTokens = 1000,
}: {
  apiKey: string;
  model: string;
  instructions: string;
  inputObj: unknown;
  maxTokens?: number;
}) {
  const aiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input: JSON.stringify(inputObj),
      max_output_tokens: maxTokens,
    }),
  });

  if (!aiRes.ok) {
    const errTxt = await aiRes.text();
    return { ok: false as const, status: aiRes.status, errorText: errTxt };
  }

  const aiJson = await aiRes.json();

  const outputText =
    aiJson?.output_text ||
    aiJson?.output
      ?.map((x: any) =>
        (x?.content || [])
          ?.map((c: any) => c?.text)
          .filter(Boolean)
          .join("")
      )
      .filter(Boolean)
      .join("") ||
    "";

  if (!outputText) {
    return { ok: false as const, status: 500, errorText: "Empty model output_text" };
  }

  try {
    const parsed = JSON.parse(outputText);
    return { ok: true as const, parsed };
  } catch {
    return {
      ok: false as const,
      status: 500,
      errorText: "Model did not return valid JSON",
      raw: outputText,
    };
  }
}

// ---------- Schema normalize ----------
function normalizeTestcase(raw: any, fallbackTitle: string) {
  const title = safeStr(raw?.title) || fallbackTitle;
  const preconditions = safeStr(raw?.preconditions) || "None";

  const stepsRaw = Array.isArray(raw?.steps) ? raw.steps : [];
  const steps = stepsRaw
    .slice(0, 12)
    .map((s: any) => ({
      content: safeStr(s?.content),
      expected: safeStr(s?.expected),
    }))
    .filter((x) => x.content);

  if (!steps.length) throw new Error("Invalid testcase schema from model (missing steps)");

  return { title, preconditions, steps };
}

// ---------- One testcase generator ----------
async function generateOneTestcase({
  apiKey,
  model,
  issueKey,
  title,
  description,
  hasAC,
  signals,
  seed,
}: {
  apiKey: string;
  model: string;
  issueKey: string;
  title: string;
  description: string;
  hasAC: boolean;
  signals: string[];
  seed: Seed;
}) {
  const seedText = safeStr(seed?.text);
  const seedId = safeStr(seed?.id);
  const seedSeverity = mapSeverity(safeStr(seed?.severity));

  const system = `
You are QA Copilot for QLynt.
Generate ONE manual test case in a TestRail-ready format.

Return ONLY valid JSON with EXACT shape:
{
  "title": string,
  "preconditions": string,
  "steps": [
    { "content": string, "expected": string }
  ]
}

Rules:
- 4 to 8 steps.
- Steps must be actionable and ordered.
- Keep assumptions minimal if the ticket is vague.
- Make it specific to the ticket context.
- No markdown. No extra keys. JSON only.
`.trim();

  const user = {
    mode: "testcase",
    issueKey,
    title,
    description,
    hasAcceptanceCriteria: hasAC,
    signals,
    seed: {
      id: seedId,
      severity: seedSeverity,
      text: seedText,
    },
  };

  const ai = await callOpenAIResponsesJSON({
    apiKey,
    model,
    instructions: system,
    inputObj: user,
    maxTokens: 1000,
  });

  if (!ai.ok) {
    return {
      ok: false as const,
      seed: { id: seedId || null, severity: seedSeverity, text: seedText },
      error: "OpenAI error",
      details: (ai as any).errorText,
      raw: (ai as any).raw,
    };
  }

  const fallbackTitle =
    seedText.length > 60 ? seedText.slice(0, 60) + "…" : seedText || "Generated test";

  try {
    const testcase = normalizeTestcase(ai.parsed, `Test: ${fallbackTitle}`);
    return {
      ok: true as const,
      seed: { id: seedId || null, severity: seedSeverity, text: seedText },
      testcase,
    };
  } catch (e) {
    return {
      ok: false as const,
      seed: { id: seedId || null, severity: seedSeverity, text: seedText },
      error: "Invalid testcase schema from model",
      details: String(e),
      raw: ai.parsed,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  // MVP gate (opcjonalny): jeśli masz SUPABASE_PUBLISHABLE_KEY, wymagaj go w nagłówku apikey
  const supabasePublishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (supabasePublishableKey) {
    const apikey = req.headers.get("apikey");
    if (!apikey || apikey !== supabasePublishableKey) {
      return json({ ok: false, error: "Unauthorized (missing/invalid apikey)" }, 401);
    }
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const issueKey = safeStr(body?.issueKey);
  if (!issueKey) return json({ ok: false, error: "Missing issueKey" }, 400);

  const title = safeStr(body?.title);
  const description = safeStr(body?.description);
  const hasAC = !!body?.hasAcceptanceCriteria;
  const signals = Array.isArray(body?.signals) ? body.signals : [];

  const seedsRaw = Array.isArray(body?.seeds) ? body.seeds : [];
  if (!seedsRaw.length) return json({ ok: false, error: "Missing seeds[]" }, 400);

  const maxItems = Math.min(Math.max(body?.options?.maxItems ?? 10, 1), 25);
  const seeds = seedsRaw
    .filter((s) => safeStr(s?.text))
    .slice(0, maxItems);

  const OPENAI_API_KEY = mustEnv("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

  // Na start robimy SEKWENCYJNIE (bezpieczniej: limity, koszty, debug)
  const results = [];
  for (const seed of seeds) {
    const r = await generateOneTestcase({
      apiKey: OPENAI_API_KEY,
      model,
      issueKey,
      title,
      description,
      hasAC,
      signals,
      seed,
    });
    results.push(r);
  }

  const okCount = results.filter((r: any) => r.ok).length;
  const errCount = results.length - okCount;

  return json({
    ok: true,
    issueKey,
    stats: {
      requested: seedsRaw.length,
      processed: results.length,
      ok: okCount,
      errors: errCount,
      model,
    },
    results,
  });
});
