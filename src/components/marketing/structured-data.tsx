import { SITE_URL } from "@/lib/site";

export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "MEMORA",
        url: SITE_URL,
        description: "The trust layer for AI memory.",
      },
      {
        "@type": "SoftwareApplication",
        name: "MEMORA",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description:
          "MEMORA decides what's worth remembering, resolves contradictions instead of guessing, and explains why every memory exists — so AI agents get more reliable over time, not noisier.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };

  return (
    // Our own static copy, not third-party input — safe to serialize directly.
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
