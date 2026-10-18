// Optional social / portfolio links on a profile. Only plain http(s) links are ever stored, so a
// value can never be a javascript: or data: URL when it is rendered as a link.
export const SOCIAL_KEYS = ['linkedin_url', 'github_url', 'portfolio_url'];

const RULES = {
  linkedin_url: { label: 'LinkedIn', hosts: ['linkedin.com'] },
  github_url: { label: 'GitHub', hosts: ['github.com'] },
  portfolio_url: { label: 'Portfolio', hosts: null },
};

const hostMatches = (host, domain) => host === domain || host.endsWith(`.${domain}`);

/** Cleans the social link keys present in `patch` in place. Returns an error message, or null. */
export function cleanSocialLinks(patch) {
  for (const key of SOCIAL_KEYS) {
    if (!(key in patch)) continue;
    const { label, hosts } = RULES[key];
    const raw = String(patch[key] ?? '').trim();
    if (!raw) { patch[key] = null; continue; }
    if (raw.length > 200) return `${label} link is too long (200 characters max)`;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return `${label} link must start with http:// or https://`;
    let url;
    try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return `${label} link is not a valid URL`; }
    if (url.username || url.password) return `${label} link must not contain a login`;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.')) return `${label} link is not a valid URL`;
    if (hosts && !hosts.some((d) => hostMatches(host, d))) return `${label} link must be a ${hosts[0]} address`;
    patch[key] = url.toString();
  }
  return null;
}
