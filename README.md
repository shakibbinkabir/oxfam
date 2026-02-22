# CFADT Dashboard — oxfam.capec.ai
## Climate Finance Availing & Disbursement Toolkit | Oxfam Bangladesh

---

## Quick Deploy

### Cloudflare Pages (recommended if capec.ai is on Cloudflare)
1. Dashboard → Workers & Pages → Create → Pages → Direct Upload
2. Upload the contents of this folder
3. Custom Domains → Add `oxfam.capec.ai`
4. DNS auto-configured, SSL automatic

### Netlify
1. Drag-drop folder at app.netlify.com
2. Domain Management → Add `oxfam.capec.ai`
3. DNS: `oxfam CNAME [site].netlify.app`

### Vercel
1. `npx vercel --prod` in this folder
2. Add domain in dashboard
3. DNS: `oxfam CNAME cname.vercel-dns.com`

### Any Static Host (Nginx)
```nginx
server {
    listen 443 ssl http2;
    server_name oxfam.capec.ai;
    root /var/www/oxfam-cfadt;
    location / { try_files $uri /index.html; }
}
```

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Complete SPA — all 8 dashboard pages (165 KB) |
| `404.html` | SPA fallback (identical to index.html) |
| `_redirects` | Netlify/Cloudflare SPA routing |
| `netlify.toml` | Netlify config with security headers |
| `vercel.json` | Vercel rewrite rules |
| `robots.txt` | Search engine directives |
| `sitemap.xml` | Sitemap for SEO |
| `cfadt_mathematical_framework_v2.pdf` | V2.0 methodology document |

## Dashboard Pages

| Hash | Page | Description |
|------|------|-------------|
| `#overview` | Overview Dashboard | KPI cards, choropleth map, priority donut, top districts, radar chart |
| `#layer1` | Layer 1: CRI | Climate Risk Index — 4 dimension cards with indicator tables |
| `#layer2` | Layer 2: MCDA | Multi-Criteria prioritisation — weight sliders, ranking table |
| `#layer3` | Layer 3: Allocation | Funding engine — budget controls, λ/μ sliders, allocation table |
| `#layer4` | Layer 4: Scenarios | Simulation — baseline vs scenario, sensitivity heatmap |
| `#map` | Map Explorer | Full-screen interactive map with layer controls |
| `#data` | Data Manager | Upload datasets, indicator registry, quality checks |
| `#settings` | Settings | Formula config, thresholds, export templates |

## Technical Notes

- Zero build step — pure HTML/CSS/JS single file
- CDN: Tailwind CSS, Google Fonts (Inter), Material Symbols
- Dark/light mode toggle, collapsible sidebar, hash routing
- No external image dependencies (all self-contained)
- Mathematical framework: V2.0 (20 equations, 11-step pipeline)

---

Built by **CapeC Consulting** — Strategic Advisory for Oxfam Bangladesh
