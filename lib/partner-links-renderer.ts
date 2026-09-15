// Generated from footer-links-worker. Edit the shared source, then run npm run sync:apps.
export interface PartnerLink {
  id: string | number;
  label: string;
  url: string;
  type?: string;
  image_src?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  image_alt?: string | null;
  created_at?: string | null;
  sort_order?: number;
  rel?: string;
}

export const MANAGED_SITES = new Set(['pixfy.io', 'scribix.io', 'fablepilot.com']);
export const FRAGMENT_PATH = '/api/partner-links';
const VISIBLE_COUNT = 8;

function escape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]!));
}
function safeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
function timestamp(link: PartnerLink): number {
  const time = link.created_at ? Date.parse(link.created_at) : NaN;
  return Number.isFinite(time) ? time : 0;
}
function id(link: PartnerLink): bigint {
  return /^\d+$/.test(String(link.id)) ? BigInt(link.id) : BigInt(0);
}
// Normalize only for comparison: keep the published URL, including queries, intact.
function key(link: PartnerLink): string {
  const url = new URL(link.url);
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return `${link.type === 'badge' ? 'badge' : 'link'}:${url.href}`;
}
export function prepareLinks(data: unknown): PartnerLink[] {
  if (!Array.isArray(data)) return [];
  const links = data.filter((link): link is PartnerLink => !!link && typeof link.label === 'string'
    && !!link.label.trim() && safeUrl(link.url)
    && (link.type !== 'badge' || safeUrl(link.image_src)));
  links.sort((a, b) => timestamp(b) - timestamp(a)
    // Unknown historical dates retain their explicit legacy order.
    || (!timestamp(a) && !timestamp(b) ? (a.sort_order || 0) - (b.sort_order || 0) : 0)
    || (id(a) < id(b) ? 1 : id(a) > id(b) ? -1 : 0));
  const seen = new Set<string>();
  return links.filter(link => { const identity = key(link); if (seen.has(identity)) return false; seen.add(identity); return true; });
}
function renderLink(link: PartnerLink): string {
  const rel = Array.from(new Set(['noopener', ...(typeof link.rel === 'string' ? link.rel : '').split(/\s+/)
    .filter(token => ['nofollow', 'noreferrer', 'sponsored', 'ugc'].includes(token))])).join(' ');
  let content = escape(link.label);
  let badgeClass = 'partner-badge';
  if (link.type === 'badge') {
    const dimension = (name: string, value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 4096 ? ` ${name}="${value}"` : '';
    // ToolPilot's legacy 20x4 Shopify thumbnail is unreadable at any useful size.
    // This is the same official artwork at a verified higher resolution; keep
    // the stored badge and destination URL untouched.
    const imageUrl = new URL(link.image_src!);
    const imageSrc = imageUrl.hostname === 'www.toolpilot.ai'
      && imageUrl.pathname === '/cdn/shop/files/f-b_20x4_crop_center.png'
      ? 'https://www.toolpilot.ai/cdn/shop/files/f-b_690x151_crop_center.png?v=1695882701'
      : link.image_src!;
    const iconOnly = imageUrl.hostname === 'navai.tools'
      && imageUrl.pathname === '/navai-badge-transparent.png';
    if (iconOnly) badgeClass += ' partner-badge-icon';
    content = `<img src="${escape(imageSrc)}" alt="${escape(typeof link.image_alt === 'string' && link.image_alt ? link.image_alt : link.label)}"${dimension('width', link.image_width)}${dimension('height', link.image_height)} loading="lazy" decoding="async">${iconOnly ? `<span>${escape(link.label)}</span>` : ''}`;
  }
  return `<li><a href="${escape(link.url)}" rel="${rel}"${link.type === 'badge' ? ` class="${badgeClass}"` : ''}>${content}</a></li>`;
}
const CSS = `[data-partner-links-list]{border-top:1px solid color-mix(in srgb,currentColor 20%,transparent);padding-block:20px 8px;font:inherit;font-size:13px;line-height:1.5;text-align:start}
[data-partner-links-list] h2{font:inherit;font-weight:600;margin:0 0 12px}
[data-partner-links-list] ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr));grid-auto-rows:minmax(48px,auto);align-items:center;gap:8px 20px;list-style:none;margin:0;padding:0}
[data-partner-links-list] li{display:flex;align-items:center;min-width:0;max-width:100%;margin:0;padding:0}
[data-partner-links-list] a{display:inline-flex;align-items:center;min-height:44px;max-width:100%;color:inherit;text-decoration:none;text-underline-offset:3px;overflow-wrap:anywhere}
[data-partner-links-list] a:hover{text-decoration:underline}
[data-partner-links-list] a:focus-visible,[data-partner-links-list] summary:focus-visible{outline:2px solid currentColor;outline-offset:4px;border-radius:2px}
[data-partner-links-list] .partner-badge{width:180px;max-width:100%;gap:8px}
[data-partner-links-list] img{display:block;width:180px;max-width:100%;height:32px;object-fit:contain;object-position:left center}
[data-partner-links-list] .partner-badge-icon img{width:32px;height:32px;flex:0 0 32px}
[data-partner-links-list] .partner-badge-icon span{min-width:0}
[data-partner-links-list] details{margin-top:12px}
[data-partner-links-list] summary{cursor:pointer;min-height:44px;padding-block:12px;width:fit-content}
[data-partner-links-list] details[open] summary{margin-bottom:8px}
[data-partner-links-list] details[open]>ul{border-top:1px solid color-mix(in srgb,currentColor 14%,transparent);padding-top:16px}
[data-partner-links-list] .partner-less{display:none}
[data-partner-links-list] details[open] .partner-more{display:none}
[data-partner-links-list] details[open] .partner-less{display:inline}
@media(max-width:640px){[data-partner-links-list] ul{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}}
@media(max-width:360px){[data-partner-links-list] ul{grid-template-columns:minmax(0,1fr)}}`;
export function renderPartners(data: unknown): string {
  const links = prepareLinks(data);
  if (!links.length) return '';
  const latest = links.slice(0, VISIBLE_COUNT).map(renderLink).join('');
  const more = links.slice(VISIBLE_COUNT);
  return `<section data-partner-links-list aria-label="Partners and directories"><style>${CSS}</style><h2>Partners &amp; directories</h2><ul>${latest}</ul>${more.length ? `<details><summary><span class="partner-more">More partners (${more.length})</span><span class="partner-less">Show fewer partners</span></summary><ul>${more.map(renderLink).join('')}</ul></details>` : ''}</section>`;
}
