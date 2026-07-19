# Social Profile Enrichment API

[![MCP Server](https://img.shields.io/badge/MCP-server-blue)](https://social-profile.api.klymax402.com/mcp)
[![x402](https://img.shields.io/badge/payments-x402-6E56CF)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Enrich social profiles from handle or URL -- Twitter/X, GitHub, LinkedIn, YouTube. Followers, bio, verification. Pay-per-call via [x402](https://x402.org) (USDC on Base L2) -- no API key, no signup, no rate-limit wall.

Part of the [klymax402](https://klymax402.com) marketplace -- 100 x402 micropayment APIs for AI agents, one wallet, USDC on Base.

## Quickstart -- MCP

Add to your MCP client config (Claude Desktop, Cursor, ElizaOS, etc.):

```json
{
  "mcpServers": {
    "social-profile": {
      "url": "https://social-profile.api.klymax402.com/mcp"
    }
  }
}
```

## Quickstart -- HTTP (x402)

```bash
curl "https://social-profile.api.klymax402.com/api/lookup"
# -> 402 Payment Required, with an x402 payment challenge in the response body
```

Any x402-aware client ([`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch), [`x402-agent-tools`](https://www.npmjs.com/package/x402-agent-tools), ATXP) handles the 402 -> sign -> retry cycle automatically.

## Tools

| Tool | Method | Path | Price | Description |
|---|---|---|---|---|
| `social_lookup_profile` | GET | `/api/lookup` | $0.015 | Lookup a social media profile by handle or URL |
| `social_lookup_profile` | POST | `/api/lookup` | $0.015 | Lookup a social media profile by handle or URL. POST variant of social_lookup_profile -- same params passed as JSON body instead of query string. |

### `social_lookup_profile`

Use this when you need public profile data from a social media handle or URL. Returns structured profile data in JSON.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `handle` | string | no | Username/handle to lookup (e.g. torvalds) |
| `platform` | string | no | Platform to search on (github, twitter, linkedin, youtube) |
| `url` | string | no | Full profile URL (alternative to handle+platform, e.g. https://github.com/torvalds) |

Example response:

```json
{"platform":"github","handle":"torvalds","displayName":"Linus Torvalds","bio":"Linux kernel developer","avatarUrl":"https://avatars.githubusercontent.com/u/1024025","followerCount":213000,"followingCount":0,"postCount":729,"location":"Portland, OR","isVerified":true}
```

**When to use**: influencer research, lead enrichment, social listening, building contact profiles, and verifying social media presence.

**Not for**: email lookup (use `email_find_by_name`), company data (use `company_enrich_from_domain`), person enrichment by email (use `person_enrich_from_email`).

### `social_lookup_profile`

Use this when you need public profile data from a social media handle or URL. Returns structured profile data in JSON.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `handle` | string | no | Username/handle to lookup (e.g. torvalds) |
| `platform` | string | no | Platform to search on (github, twitter, linkedin, youtube) |
| `url` | string | no | Full profile URL (alternative to handle+platform, e.g. https://github.com/torvalds) |

Example response:

```json
{"platform":"github","handle":"torvalds","displayName":"Linus Torvalds","bio":"Linux kernel developer","avatarUrl":"https://avatars.githubusercontent.com/u/1024025","followerCount":213000,"followingCount":0,"postCount":729,"location":"Portland, OR","isVerified":true}
```

**When to use**: influencer research, lead enrichment, social listening, building contact profiles, and verifying social media presence.

**Not for**: email lookup (use `email_find_by_name`), company data (use `company_enrich_from_domain`), person enrichment by email (use `person_enrich_from_email`).

## Example agent prompts

- "Public profile data from a social media handle or URL"
- "Public profile data from a social media handle or URL"

## Payment

- Protocol: [x402](https://x402.org) -- HTTP-native pay-per-call, no signup, no API key
- Network: Base L2 (`eip155:8453`)
- Asset: USDC
- Facilitator: Coinbase CDP (primary), PayAI (fallback)
- Also reachable via [ATXP](https://atxp.ai) (OAuth-wrapped x402, RFC 9728 protected-resource metadata)

## Part of klymax402

100 x402 micropayment APIs for AI agents -- one wallet, USDC on Base, zero signup.

- Catalog: https://klymax402.com/llms.txt
- Full API reference: https://klymax402.com/llms-full.txt
- Live stats: https://klymax402.com/stats

## License

MIT
