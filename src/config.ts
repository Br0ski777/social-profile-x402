import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "social-profile",
  slug: "social-profile",
  description: "Social media profile enrichment from handle or URL. Twitter/X, GitHub, LinkedIn, YouTube.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/lookup",
      price: "$0.008",
      description: "Lookup a social media profile by handle or URL",
      toolName: "social_lookup_profile",
      toolDescription: "Use this when you need public profile data from a social media handle or URL. Supports Twitter/X, GitHub, LinkedIn, and YouTube. Returns: display name, bio, avatar URL, follower count, following count, post count, location, website, account creation date, verification status. Ideal for influencer research, lead enrichment, social listening. Do NOT use for email lookup — use email_find_by_name. Do NOT use for company data — use company_enrich_from_domain.",
      inputSchema: {
        type: "object",
        properties: {
          handle: { type: "string", description: "Username/handle to lookup (e.g. torvalds)" },
          platform: {
            type: "string",
            enum: ["github", "twitter", "linkedin", "youtube"],
            description: "Platform to search on (github, twitter, linkedin, youtube)",
          },
          url: { type: "string", description: "Full profile URL (alternative to handle+platform, e.g. https://github.com/torvalds)" },
        },
      },
    },
  ],
};
