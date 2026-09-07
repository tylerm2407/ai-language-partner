// Static site for fluenciapp.com: index, /privacy, /terms.
// Legal text lives in content/*.md (synced from ../docs by hand, with the
// contact addresses on the owned domain). Run `npm run build`; output in dist/.
import { marked } from 'marked';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';

const SITE = 'https://fluenciapp.com';

const css = `
:root{--bg:#FFFFFF;--surface:#F5F4FA;--border:#E9E7F3;--ink:#23203A;--muted:#6E6A88;--primary:#6A4CFF;--slab:#4D33D6;--tint:#EFEBFF;--tint-border:#D9D1FF;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#0C0B14;--surface:#100E1C;--border:#27243F;--ink:#F4F2FF;--muted:#A6A2C2;--primary:#7057FF;--slab:#5641D9;--tint:#2A2450;--tint-border:#3E3670}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6;font-size:17px}
a{color:var(--primary)}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;backdrop-filter:saturate(1.2) blur(8px)}
header .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;text-decoration:none;color:var(--ink);letter-spacing:-.02em}
.brand img{width:32px;height:32px;border-radius:9px}
nav a{margin-left:18px;text-decoration:none;color:var(--muted);font-weight:600;font-size:15px}
nav a:hover,nav a[aria-current]{color:var(--primary)}
main{padding:40px 0 64px}
.hero{padding:56px 0 24px}
.hero h1{font-size:clamp(34px,6vw,52px);line-height:1.05;letter-spacing:-.03em;margin:0 0 16px}
.hero p{font-size:19px;color:var(--muted);max-width:560px;margin:0 0 28px}
.cta{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px;box-shadow:0 4px 0 var(--slab)}
.cta.secondary{background:var(--tint);color:var(--slab);box-shadow:0 4px 0 var(--tint-border);margin-left:10px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:40px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px}
.card h3{margin:0 0 6px;font-size:16px}
.card p{margin:0;color:var(--muted);font-size:15px}
article h1{font-size:clamp(30px,5vw,40px);letter-spacing:-.03em;line-height:1.1;margin:0 0 8px}
article h2{font-size:24px;margin:40px 0 10px;letter-spacing:-.02em;scroll-margin-top:80px}
article h3{font-size:18px;margin:26px 0 6px}
article table{border-collapse:collapse;width:100%;font-size:15px;display:block;overflow-x:auto}
article th,article td{border:1px solid var(--border);padding:8px 10px;text-align:left;vertical-align:top}
article th{background:var(--surface)}
article blockquote{margin:0;padding:12px 16px;background:var(--tint);border:1px solid var(--tint-border);border-radius:12px;color:var(--ink)}
article hr{border:0;border-top:1px solid var(--border);margin:32px 0}
article code{background:var(--surface);padding:1px 5px;border-radius:5px;font-size:.92em}
.meta{color:var(--muted);font-size:15px;margin-bottom:28px}
footer{border-top:1px solid var(--border);padding:28px 0;color:var(--muted);font-size:14px}
footer .wrap{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between}
footer a{color:var(--muted)}
`;

function layout({ title, description, path, body }) {
  const nav = (href, label) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${SITE}${path === '/' ? '' : path}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${SITE}/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="/"><img src="/icon.png" alt="" width="32" height="32">Fluenci</a>
  <nav>${nav('/privacy', 'Privacy')}${nav('/terms', 'Terms')}<a href="mailto:support@fluenciapp.com">Support</a></nav>
</div></header>
<main><div class="wrap">${body}</div></main>
<footer><div class="wrap">
  <span>&copy; ${new Date().getFullYear()} NovaWealth. Fluenci is a NovaWealth product.</span>
  <span><a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a> &middot; <a href="mailto:privacy@fluenciapp.com">privacy@fluenciapp.com</a></span>
</div></footer>
</body>
</html>`;
}

const index = layout({
  title: 'Fluenci — AI language tutor',
  description: 'Fluenci is an AI-powered language learning app: lessons, spaced repetition, a live voice tutor, and measured CEFR proficiency.',
  path: '/',
  body: `
<section class="hero">
  <h1>Learn a language by actually speaking it.</h1>
  <p>Fluenci pairs short daily lessons and spaced repetition with an AI tutor you can talk to. Progress is measured as real CEFR proficiency, not points.</p>
  <a class="cta" href="mailto:support@fluenciapp.com">Get in touch</a>
  <a class="cta secondary" href="/privacy">Privacy policy</a>
</section>
<section class="cards">
  <div class="card"><h3>Lessons that adapt</h3><p>Every card is scheduled by spaced repetition, so you review exactly what you are about to forget.</p></div>
  <div class="card"><h3>A tutor you can talk to</h3><p>Live voice conversation with corrections that match your level.</p></div>
  <div class="card"><h3>Built for classrooms</h3><p>Teachers assign work, see progress, and keep student data protected under FERPA and COPPA.</p></div>
</section>`,
});

async function legalPage(slug, title, description) {
  const md = await readFile(new URL(`./content/${slug}.md`, import.meta.url), 'utf8');
  const html = marked.parse(md, { gfm: true, breaks: true });
  return layout({ title: `${title} — Fluenci`, description, path: `/${slug}`, body: `<article>${html}</article>` });
}

await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await writeFile('dist/index.html', index);
await writeFile('dist/privacy.html', await legalPage('privacy', 'Privacy Policy', 'How Fluenci collects, uses, and protects your information, including FERPA and COPPA commitments.'));
await writeFile('dist/terms.html', await legalPage('terms', 'Terms of Service', 'The terms that govern your use of the Fluenci app and services.'));
console.log('built dist/: index, privacy, terms');
