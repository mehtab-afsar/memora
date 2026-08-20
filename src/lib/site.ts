/**
 * No production domain has been registered for this project yet. Set
 * NEXT_PUBLIC_SITE_URL once one exists — everything here (metadata, sitemap,
 * robots, JSON-LD) reads from this single source rather than a hardcoded
 * guess at a domain.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
