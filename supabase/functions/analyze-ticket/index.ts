import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/**
 * Single endpoint:
 * - mode: "checklist" (default)
 * - mode: "testcase"  (generate one TestRail-ready testcase for given checklist seed)
 *
 * Uses OpenAI Responses API (consistent with your current analyze-ticket implementation).
 */

type ChecklistMode = "checklist";
type TestcaseMode = "testcase";
type Mode = ChecklistMode | TestcaseMode;

type TicketPayloadBase = {
  mode?: Mode;
  issueKey: string;
  title: string;
  description: string;
  hasAcceptanceCriteria?: boolean;
  signals?: string[];
};

type ChecklistItemSeed = {
  id?: string;
  text: string;
  severity?: "must" | "should" | "nice" | string;
};

type TicketPayloadChecklist = TicketPayloadBase & {
  mode?: "checklist";
};

type TicketPayloadTestcase = TicketPayloadBase & {
  mode: "testcase";
  seed: ChecklistItemSeed;
};

type TicketPayload = TicketPayloadChecklist | TicketPayloadTestcase;

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

// ---- OpenAI helper (Responses API) ----
async function callOpenAIResponsesJSON({
  apiKey,
  model,
  instructions,
  inputObj,
  maxTokens = 900,
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
    return { ok: false as const, errorText: errTxt, status: aiRes.status };
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
    return {
      ok: false as const,
      errorText: "Empty model output_text",
      status: 500,
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return {
      ok: false as const,
      errorText: "Model did not return valid JSON",
      status: 500,
      raw: outputText,
    };
  }

  return { ok: true as const, parsed };
}

// ---- Schema normalization ----
function normalizeChecklist(raw: any) {
  const title = safeStr(raw?.checklistTitle) || "QA Checklist";
  const itemsRaw = Array.isArray(raw?.items) ? raw.items : [];

  const items = itemsRaw
    .slice(0, 15)
    .map((it: any, idx: number) => ({
      id: safeStr(it?.id) || String(idx + 1),
      text: safeStr(it?.text),
      severity: mapSeverity(safeStr(it?.severity)),
    }))
    .filter((x) => x.text);

  return { checklistTitle: title, items };
}

function normalizeTestcase(raw: any, fallbackTitle: string) {
  // We expect:
  // {
  //   "title": "...",
  //   "preconditions": "...",
  //   "steps": [{ "content": "...", "expected": "..." }]
  // }
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

  if (!steps.length) {
    throw new Error("Invalid testcase schema from model (missing steps)");
  }

  return { title, preconditions, steps };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  // MVP "gate" (optional): if SUPABASE_PUBLISHABLE_KEY is present, require it in header apikey
  const supabasePublishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (supabasePublishableKey) {
    const apikey = req.headers.get("apikey");
    if (!apikey || apikey !== supabasePublishableKey) {
      return json(
        { ok: false, error: "Unauthorized (missing/invalid apikey)" },
        401
      );
    }
  }

  let payload: TicketPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const modeRaw = safeStr((payload as any)?.mode).toLowerCase();

  const mode: Mode =
  modeRaw === "testcase" || modeRaw === "test"
    ? "testcase"
    : "checklist";


  // Minimal validation
  if (!payload?.issueKey) {
    return json({ ok: false, error: "Missing issueKey" }, 400);
  }
  // Title can be empty for early MVP, but better to allow it (you had strict)
  // We'll keep it soft:
  const issueKey = safeStr(payload.issueKey);
  const title = safeStr(payload.title);
  const description = safeStr(payload.description);
  const hasAC = !!payload.hasAcceptanceCriteria;
  const signals = Array.isArray(payload.signals) ? payload.signals : [];

  const OPENAI_API_KEY = mustEnv("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

  // ----- MODE: TESTCASE -----
  if (mode === "testcase") {
    const seed = (payload as TicketPayloadTestcase).seed;
    const seedText = safeStr(seed?.text);
    const seedId = safeStr(seed?.id);
    const seedSeverity = mapSeverity(safeStr(seed?.severity));

    if (!seedText) {
      return json({ ok: false, error: "Missing seed.text" }, 400);
    }

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
- No markdown. No extra keys. JSON only.
`.trim();

    const user = {
      mode,
      issueKey,
      title,
      description,
      hasAcceptanceCriteria: hasAC,
      seed: {
        id: seedId,
        severity: seedSeverity,
        text: seedText,
      },
      signals,
    };

    const ai = await callOpenAIResponsesJSON({
      apiKey: OPENAI_API_KEY,
      model,
      instructions: system,
      inputObj: user,
      maxTokens: 900,
    });

    if (!ai.ok) {
      return json(
        { ok: false, error: "OpenAI error", details: ai.errorText, raw: (ai as any).raw },
        500
      );
    }

    try {
      const fallbackTitle = seedText.length > 60 ? seedText.slice(0, 60) + "…" : seedText;
      const testcase = normalizeTestcase(ai.parsed, `Test: ${fallbackTitle}`);

      return json({
        ok: true,
        issueKey,
        testcase,
      });
    } catch (e) {
      return json(
        {
          ok: false,
          error: "Invalid testcase schema from model",
          details: String(e),
          raw: ai.parsed,
        },
        500
      );
    }
  }

  // ----- MODE: CHECKLIST (default) -----
  const system = `
You are a QA lead. Generate a concise, risk-based QA checklist for a Jira ticket.
Return ONLY valid JSON with shape:
{
  "checklistTitle": string,
  "items": [{ "id": string, "text": string, "severity": "must"|"should"|"nice" }]
}
Rules:
- 5 to 10 items
- Avoid generic fluff. Make items actionable.
- No markdown. No extra keys. JSON only.
`.trim();

  const user = {
    mode: "checklist",
    issueKey,
    title,
    description,
    hasAcceptanceCriteria: hasAC,
    signals,
  };

  const ai = await callOpenAIResponsesJSON({
    apiKey: OPENAI_API_KEY,
    model,
    instructions: system,
    inputObj: user,
    maxTokens: 800,
  });

  if (!ai.ok) {
    return json(
      { ok: false, error: "OpenAI error", details: ai.errorText, raw: (ai as any).raw },
      500
    );
  }

  const checklist = normalizeChecklist(ai.parsed);

  return json({
    ok: true,
    issueKey,
    checklist,
  });
});
