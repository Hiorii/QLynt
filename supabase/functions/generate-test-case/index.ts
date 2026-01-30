import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ReqBody = {
  issueKey: string;
  title: string;
  description: string;
  hasAcceptanceCriteria?: boolean;
  checklistItem: string; // np. "[must] Review acceptance criteria"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

    const body = (await req.json()) as ReqBody;

    const prompt = `
You are a QA engineer.
Generate ONE high-quality manual test case (not a checklist) based on:
- Jira issue key: ${body.issueKey}
- Title: ${body.title || ""}
- Description: ${body.description || ""}
- Has acceptance criteria: ${body.hasAcceptanceCriteria ? "yes" : "no"}
- Selected checklist item: ${body.checklistItem}

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "preconditions": string,
  "steps": string[],
  "expected": string
}

Rules:
- Steps must be actionable and ordered.
- Keep it realistic and specific to the ticket content. If ticket is vague, make reasonable assumptions but keep them minimal.
- No markdown. No extra keys. JSON only.
`.trim();

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "You output strictly valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = data?.choices?.[0]?.message?.content ?? "{}";

    // Próba parsowania JSON (model czasem doda spacje/nowe linie - ok)
    let testCase: any;
    try {
      testCase = JSON.parse(text);
    } catch {
      // awaryjnie: spróbuj wyciągnąć JSON z tekstu
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Model did not return JSON");
      testCase = JSON.parse(m[0]);
    }

    // Minimalna walidacja
    if (
      !testCase?.title ||
      !Array.isArray(testCase?.steps) ||
      !testCase?.expected
    ) {
      throw new Error("Invalid testCase schema from model");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        issueKey: body.issueKey,
        testCase,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
