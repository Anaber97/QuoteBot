import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "TowCalc <noreply@towcalc.com>";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailRequest = { to?: unknown; subject?: unknown; html?: unknown };
const json = (body: unknown, status = 200) => Response.json(body, { status });

export default {
  // Only TowCalc's trusted server may use this as an email relay.
  fetch: withSupabase({ auth: "secret" }, async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return json({ error: "Email service is not configured" }, 500);
    }

    let body: EmailRequest;
    try {
      body = await request.json();
    } catch {
      return json({ error: "A JSON request body is required" }, 400);
    }

    const to = String(body.to ?? "").trim().toLowerCase();
    const subject = String(body.subject ?? "").trim();
    const html = String(body.html ?? "").trim();

    if (!EMAIL_PATTERN.test(to)) return json({ error: "A valid recipient is required" }, 400);
    if (!subject || subject.length > 160 || /[\r\n]/.test(subject)) {
      return json({ error: "A valid subject is required" }, 400);
    }
    if (!html || html.length > 100_000) return json({ error: "Valid email content is required" }, 400);

    const resendResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM")?.trim() || DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    const result = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      console.error("Resend rejected email", { status: resendResponse.status, result });
      return json({ error: "Email provider rejected the message" }, 502);
    }

    return json({ success: true, id: result?.id });
  }),
};
