/**
 * The two pages the OAuth flow shows in a browser: consent and error. They
 * share the Stables login's design (stables-login, auth.css): coin video on
 * the left, dark card on the right, PP Agrandir headings, DM Sans body, so
 * the hop from here to the Auth0 login screen looks like one flow.
 *
 * Everything that came from the client (its name, domain, scopes) is
 * escaped, since a dynamically registered client chooses those strings.
 */

import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// Same assets the login screens use (Webflow CDN).
const SIDE_VIDEO =
  "https://cdn.prod.website-files.com/647fe94790c03420770215ff/6a28dc85362ee9ec135591de_coin1_mp4.mp4";
const SIDE_POSTER =
  "https://cdn.prod.website-files.com/647fe94790c03420770215ff/6a2295f0d320c08683feda80_Frame%201000008940.png";
const LOGO =
  "https://cdn.prod.website-files.com/647fe94790c03420770215ff/668cbc7303652c18886b3e83_White-logo.svg";
const DISPLAY_FONT =
  "https://cdn.prod.website-files.com/647fe94790c03420770215ff/64e6d629d66cf95dd050563e_PPAgrandir-Bold.woff2";

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
@font-face{font-family:'PP Agrandir';src:url('${DISPLAY_FONT}') format('woff2');font-weight:700;font-style:normal;font-display:swap}
:root{--bg:#000;--card:#131315;--field:#0e0e10;--border:#2e2e34;--card-border:#1e1e22;--text:#fff;--muted:#8a8a8a;
  --accent:#d0bcff;--accent-text:#1f1033;--neutral300:#c8c8cf;--radius:20px;--pill:31px;
  --font:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;--display:'PP Agrandir','DM Sans',-apple-system,sans-serif;
  color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}
.wrap{display:flex;min-height:100vh;padding:32px;gap:32px}
.left{flex:1.15 1 0;position:relative;overflow:hidden;border-radius:24px;background:#000}
.left video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.left-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:1}
.hero{position:absolute;top:50%;left:8%;right:8%;transform:translateY(-50%);z-index:2}
.hero h1{font-family:var(--display);font-size:64px;font-weight:700;line-height:1.1;letter-spacing:-0.03em;margin:0 0 16px}
.hero p{font-size:18px;line-height:1.2;color:var(--neutral300);margin:0}
.right{flex:1 1 0;display:flex;align-items:center;justify-content:center}
.card{width:100%;max-width:560px;background:var(--card);border:1px solid var(--card-border);border-radius:28px;padding:48px}
.card-inner{width:100%;max-width:420px;margin:0 auto}
.logo{height:26px;margin-bottom:40px}.logo img{height:100%}
h2{font-family:var(--display);font-size:26px;font-weight:700;margin:0 0 8px}
.sub{color:var(--neutral300);font-size:16px;line-height:1.3;margin:0 0 24px}
.sub strong{color:var(--text);font-weight:500}
.notice{background:rgba(147,130,255,.10);border:1px solid rgba(147,130,255,.35);color:var(--text);font-size:14px;line-height:1.5;border-radius:14px;padding:12px 14px;margin-bottom:20px}
.warn{background:rgba(255,196,77,.10);border:1px solid rgba(255,196,77,.4);color:#ffd98a;font-size:14px;line-height:1.5;border-radius:14px;padding:12px 14px;margin-bottom:20px}
.error{background:rgba(255,77,79,.12);border:1px solid rgba(255,77,79,.4);color:#ffb3b3;font-size:14px;line-height:1.4;border-radius:14px;padding:12px 14px;margin-bottom:20px}
label.lbl{display:block;font-size:15px;font-weight:500;margin:0 0 10px}
.env-list{display:flex;flex-direction:column;gap:10px;margin:0 0 24px}
.env{display:flex;gap:14px;align-items:flex-start;background:var(--field);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;cursor:pointer;transition:border-color .15s ease}
.env:hover{border-color:var(--muted)}
.env:has(input:checked){border-color:var(--accent)}
.env input{margin:4px 0 0;accent-color:var(--accent);flex:none}
.env .env-name{display:block;font-size:16px;font-weight:500}
.env .env-desc{display:block;color:var(--muted);font-size:13px;line-height:1.4;margin-top:2px}
.env code{background:#1b1b1f;border:1px solid var(--border);padding:1px 6px;border-radius:6px;font-size:12px;color:var(--neutral300)}
.actions{display:flex;flex-direction:column;gap:10px}
.btn{width:100%;border:none;cursor:pointer;font-family:var(--font);font-size:16px;font-weight:700;border-radius:var(--pill);padding:16px;transition:opacity .15s ease,transform .05s ease}
.btn-primary{background:var(--accent);color:var(--accent-text)}
.btn-primary:hover{opacity:.9}.btn-primary:active{transform:translateY(1px)}
.btn-secondary{background:transparent;color:var(--text);border:1px solid var(--border);font-weight:500}
.btn-secondary:hover{border-color:var(--muted)}
.btn[disabled]{opacity:.55;cursor:default}
.foot{color:var(--muted);font-size:13px;margin-top:24px;line-height:1.5;text-align:center}
.foot a{color:var(--muted);text-decoration:none}.foot a:hover{color:var(--accent)}
@media (max-width:960px){.wrap{flex-direction:column;padding:16px;gap:16px}.left{flex:0 0 220px;min-height:220px}.hero{left:24px;right:24px}.hero h1{font-size:40px}.hero p{font-size:15px}.card{padding:32px 24px}}
`;

function layout(options: {
  title: string;
  heroTitle: string;
  heroSub: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(options.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="left">
    <video autoplay muted loop playsinline poster="${SIDE_POSTER}"><source src="${SIDE_VIDEO}" type="video/mp4"></video>
    <div class="left-overlay"></div>
    <div class="hero"><h1>${escapeHtml(options.heroTitle)}</h1><p>${escapeHtml(options.heroSub)}</p></div>
  </div>
  <div class="right">
    <div class="card"><div class="card-inner">
      <div class="logo"><img src="${LOGO}" alt="Stables"></div>
${options.body}
    </div></div>
  </div>
</div>
</body>
</html>`;
}

const HERO_TITLE = "Connect your AI agent";
const HERO_SUB =
  "Let it move money and manage customers through Stables, with the access you approve.";

export function consentPage(details: ConsentDescription, handle: string): string {
  const name = escapeHtml(details.clientName);
  const origin = details.clientDomain
    ? `Published by <strong>${escapeHtml(details.clientDomain)}</strong>.`
    : "This app registered itself, so its name is not verified.";
  const loopback = details.redirectIsLoopback
    ? `<p class="warn"><strong>This sends access to an app on your computer.</strong> Continue only if you just started connecting from it.</p>`
    : "";
  return layout({
    title: `Connect ${details.clientName} to Stables`,
    heroTitle: HERO_TITLE,
    heroSub: HERO_SUB,
    body: `<h2>Connect ${name} to Stables?</h2>
<p class="sub">${origin} Access will be sent to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
${loopback}
<p class="notice">Next you'll sign in with your Stables dashboard account and choose an organisation. Allowing creates an API key there named after ${name}; revoke it any time under Developer → API keys.</p>
<form method="post" autocomplete="off" onsubmit="if(this.dataset.sent)return false;this.dataset.sent=1;setTimeout(()=>{for(const b of this.querySelectorAll('button'))b.disabled=true},0);">
  <input type="hidden" name="handle" value="${escapeHtml(handle)}">
  <label class="lbl">Environment</label>
  <div class="env-list">
    <label class="env"><input type="radio" name="environment" value="sandbox" checked>
      <span><span class="env-name">Sandbox</span><span class="env-desc">Test data, no real money. Keys start with <code>sti_test_</code>.</span></span></label>
    <label class="env"><input type="radio" name="environment" value="production">
      <span><span class="env-name">Production</span><span class="env-desc">Live organisation. The agent can move real money.</span></span></label>
  </div>
  <div class="actions">
    <button type="submit" name="decision" value="approve" class="btn btn-primary">Allow and sign in</button>
    <button type="submit" name="decision" value="deny" class="btn btn-secondary">Cancel</button>
  </div>
</form>
<p class="foot">You can disconnect at any time by revoking the key in your dashboard.</p>`,
  });
}

export function errorPage(title: string, message: string, hint?: string): string {
  return layout({
    title,
    heroTitle: HERO_TITLE,
    heroSub: HERO_SUB,
    body: `<h2>${escapeHtml(title)}</h2>
<p class="error">${escapeHtml(message)}</p>
${hint ? `<p class="sub">${escapeHtml(hint)}</p>` : ""}
<p class="sub">Go back to the app that sent you here and try connecting again.</p>`,
  });
}
