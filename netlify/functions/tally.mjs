// Anonymous usage counting for the tutor.
// The tutor page sends event names here; this function passes them to GoatCounter
// from the server, so browser ad blockers don't affect the counts.
// No student identity, IP address or message text is sent.
//
// Needs one Netlify environment variable: GOATCOUNTER_API_KEY
// Optional: GOATCOUNTER_SITE (defaults to "kbmooreut")

const SITE = process.env.GOATCOUNTER_SITE || "kbmooreut";
const ENDPOINT = `https://${SITE}.goatcounter.com/api/v0/count`;

const clean = (v) => String(v ?? "").slice(0, 200);

async function send(hits) {
  const key = process.env.GOATCOUNTER_API_KEY;
  if (!key) return { status: 0, text: "No API key set (GOATCOUNTER_API_KEY is missing in Netlify)." };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ no_sessions: true, filter: [], hits }),
  });
  const filtered = res.headers.get("X-Goatcounter-Filter");
  const body = await res.text();
  return { status: res.status, text: `GoatCounter replied: ${res.status} ${body}${filtered ? ` (filtered: ${filtered})` : ""}` };
}

export default async (req) => {
  const userAgent = req.headers.get("user-agent") || "";

  // Open this function's address in a browser to test the connection.
  if (req.method === "GET") {
    try {
      const r = await send([{ path: "/test3", title: "Connection test", user_agent: userAgent }]);
      return new Response(r.text, { status: 200, headers: { "Content-Type": "text/plain" } });
    } catch (e) {
      return new Response(`Could not reach GoatCounter: ${e.message}`, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
  }

  if (req.method !== "POST") return new Response("", { status: 405 });

  try {
    const data = await req.json();
    const title = clean(data.title);
    const hits = (Array.isArray(data.hits) ? data.hits : [])
      .slice(0, 10)
      .filter((h) => h && h.path)
      .map((h) => ({ path: clean(h.path), title, event: !!h.event, user_agent: userAgent }));
    if (hits.length) await send(hits);
  } catch (e) {
    // Counting must never break the tutor.
  }
  return new Response(null, { status: 204 });
};
