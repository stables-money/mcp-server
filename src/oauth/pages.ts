/**
 * The two pages the OAuth flow shows in a browser: consent and error.
 * Everything that came from the client (its name, domain, scopes) is
 * escaped, since a dynamically registered client chooses those strings.
 */

import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const STYLE = `
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f3f8;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #17151f; }
  main { width: min(440px, calc(100vw - 32px)); background: #fff; border-radius: 16px;
    padding: 32px 28px; box-shadow: 0 8px 32px rgba(23, 21, 31, 0.08); }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { margin: 0 0 14px; color: #4a4759; }
  .brand { font-weight: 700; letter-spacing: 0.02em; color: #5b3df5; margin-bottom: 18px; font-size: 14px; text-transform: uppercase; }
  .warn { background: #fff7e6; border: 1px solid #f5d58b; border-radius: 10px; padding: 10px 12px; color: #6b4b00; }
  fieldset { border: 1px solid #e3e1ec; border-radius: 12px; padding: 12px 14px; margin: 18px 0; }
  legend { padding: 0 6px; font-weight: 600; font-size: 14px; }
  label.env { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; cursor: pointer; }
  label.env input { margin-top: 5px; }
  label.env small { display: block; color: #6c6880; }
  .actions { display: flex; gap: 10px; margin-top: 8px; }
  button { flex: 1; padding: 12px 16px; border-radius: 10px; border: 1px solid #d9d6e6; font: inherit; font-weight: 600; cursor: pointer; background: #fff; }
  button.primary { background: #5b3df5; border-color: #5b3df5; color: #fff; }
  code { background: #f1f0f7; padding: 1px 6px; border-radius: 6px; font-size: 14px; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="brand">Stables</div>
${body}
</main>
</body>
</html>`;
}

export function consentPage(details: ConsentDescription, handle: string): string {
  const name = escapeHtml(details.clientName);
  const origin = details.clientDomain
    ? `Published by <strong>${escapeHtml(details.clientDomain)}</strong>.`
    : "This app registered itself, so its name is not verified.";
  const loopback = details.redirectIsLoopback
    ? `<p class="warn"><strong>This sends access to an app on your computer.</strong> Continue only if you just started connecting from it.</p>`
    : "";
  return layout(
    `Connect ${details.clientName} to Stables`,
    `<h1>Connect ${name} to Stables?</h1>
<p>${origin} Access will be sent to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
${loopback}
<p>You'll sign in with your Stables dashboard account. Allowing creates an API key named after ${name} in the organisation you choose; revoke it any time under Developer → API keys.</p>
<form method="post" autocomplete="off" onsubmit="if(this.dataset.sent)return false;this.dataset.sent=1;for(const b of this.querySelectorAll('button'))b.disabled=true;">
  <input type="hidden" name="handle" value="${escapeHtml(handle)}">
  <fieldset>
    <legend>Environment</legend>
    <label class="env"><input type="radio" name="environment" value="sandbox" checked>
      <span>Sandbox<small>Test data, no real money. Keys start with <code>sti_test_</code>.</small></span></label>
    <label class="env"><input type="radio" name="environment" value="production">
      <span>Production<small>Live organisation. The agent can move real money.</small></span></label>
  </fieldset>
  <div class="actions">
    <button type="submit" name="decision" value="deny">Cancel</button>
    <button type="submit" name="decision" value="approve" class="primary">Allow and sign in</button>
  </div>
</form>`
  );
}

export function errorPage(title: string, message: string, hint?: string): string {
  return layout(
    title,
    `<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
${hint ? `<p>${escapeHtml(hint)}</p>` : ""}
<p>Go back to the app that sent you here and try connecting again.</p>`
  );
}
