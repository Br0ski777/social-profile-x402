import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "social-profile",
  slug: "social-profile",
  description: "Enrich social profiles from handle or URL -- Twitter/X, GitHub, LinkedIn, YouTube. Followers, bio, verification.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/lookup",
      price: "$0.008",
      description: "Lookup a social media profile by handle or URL",
      toolName: "social_lookup_profile",
      toolDescription: `Use this when you need public profile data from a social media handle or URL. Returns structured profile data in JSON.

Returns: 1. displayName and bio 2. avatarUrl 3. followerCount and followingCount 4. postCount 5. location and website 6. createdAt (account creation date) 7. isVerified (boolean) 8. platform.

Example output: {"platform":"github","handle":"torvalds","displayName":"Linus Torvalds","bio":"Linux kernel developer","avatarUrl":"https://avatars.githubusercontent.com/u/1024025","followerCount":213000,"followingCount":0,"postCount":729,"location":"Portland, OR","isVerified":true}

Use this FOR influencer research, lead enrichment, social listening, building contact profiles, and verifying social media presence.

Do NOT use for email lookup -- use email_find_by_name instead. Do NOT use for company data -- use company_enrich_from_domain instead. Do NOT use for person enrichment by email -- use person_enrich_from_email instead.`,
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
