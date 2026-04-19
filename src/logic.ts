import type { Hono } from "hono";
import { parse as parseHTML } from "node-html-parser";


// ATXP: requirePayment only fires inside an ATXP context (set by atxpHono middleware).
// For raw x402 requests, the existing @x402/hono middleware handles the gate.
// If neither protocol is active (ATXP_CONNECTION unset), tryRequirePayment is a no-op.
async function tryRequirePayment(price: number): Promise<void> {
  if (!process.env.ATXP_CONNECTION) return;
  try {
    const { requirePayment } = await import("@atxp/server");
    const BigNumber = (await import("bignumber.js")).default;
    await requirePayment({ price: BigNumber(price) });
  } catch (e: any) {
    if (e?.code === -30402) throw e;
  }
}

// ---------------------------------------------------------------------------
// Normalized profile result
// ---------------------------------------------------------------------------

interface ProfileResult {
  platform: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  followers: number | null;
  following: number | null;
  posts_count: number | null;
  location: string | null;
  website: string | null;
  company: string | null;
  created_at: string | null;
  verified: boolean;
  profile_url: string;
  raw: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Platform detection from URL
// ---------------------------------------------------------------------------

function detectPlatformFromUrl(url: string): { platform: string; handle: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "").toLowerCase();
    const pathParts = u.pathname.split("/").filter(Boolean);

    if (host === "github.com" && pathParts.length >= 1) {
      return { platform: "github", handle: pathParts[0] };
    }
    if ((host === "twitter.com" || host === "x.com") && pathParts.length >= 1) {
      return { platform: "twitter", handle: pathParts[0].replace("@", "") };
    }
    if ((host === "linkedin.com" || host === "www.linkedin.com") && pathParts[0] === "in" && pathParts.length >= 2) {
      return { platform: "linkedin", handle: pathParts[1] };
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (pathParts[0] === "channel" && pathParts.length >= 2) {
        return { platform: "youtube", handle: pathParts[1] };
      }
      if (pathParts[0]?.startsWith("@")) {
        return { platform: "youtube", handle: pathParts[0] };
      }
      if (pathParts[0] === "c" && pathParts.length >= 2) {
        return { platform: "youtube", handle: pathParts[1] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GitHub (public API, no auth, 60 req/hr per IP)
// ---------------------------------------------------------------------------

async function lookupGitHub(handle: string): Promise<ProfileResult> {
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
    headers: { "Accept": "application/vnd.github+json", "User-Agent": "social-profile-x402/1.0" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json() as any;

  return {
    platform: "github",
    handle: data.login,
    display_name: data.name || null,
    bio: data.bio || null,
    avatar_url: data.avatar_url || null,
    followers: data.followers ?? null,
    following: data.following ?? null,
    posts_count: data.public_repos ?? null,
    location: data.location || null,
    website: data.blog || null,
    company: data.company || null,
    created_at: data.created_at || null,
    verified: false,
    profile_url: data.html_url || `https://github.com/${handle}`,
    raw: {
      public_repos: data.public_repos,
      public_gists: data.public_gists,
      type: data.type,
      hireable: data.hireable,
      twitter_username: data.twitter_username,
    },
  };
}

// ---------------------------------------------------------------------------
// Twitter/X — try nitter mirrors for public profile scraping
// ---------------------------------------------------------------------------

const NITTER_MIRRORS = [
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.net",
];

async function lookupTwitter(handle: string): Promise<ProfileResult> {
  const cleanHandle = handle.replace("@", "");
  let lastError = "";

  for (const mirror of NITTER_MIRRORS) {
    try {
      const res = await fetch(`${mirror}/${encodeURIComponent(cleanHandle)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });

      if (!res.ok) continue;

      const html = await res.text();
      const root = parseHTML(html);

      const displayName = root.querySelector(".profile-card-fullname")?.text?.trim() || null;
      const bio = root.querySelector(".profile-bio p")?.text?.trim() || null;
      const avatar = root.querySelector(".profile-card-avatar img")?.getAttribute("src") || null;
      const location = root.querySelector(".profile-location span:last-child")?.text?.trim() || null;
      const website = root.querySelector(".profile-website a")?.getAttribute("href") || null;
      const joinDate = root.querySelector(".profile-joindate span:last-child")?.text?.trim() || null;

      // Parse stat counts
      const statEls = root.querySelectorAll(".profile-stat-num");
      const tweets = statEls[0]?.text?.trim()?.replace(/,/g, "") || null;
      const following = statEls[1]?.text?.trim()?.replace(/,/g, "") || null;
      const followers = statEls[2]?.text?.trim()?.replace(/,/g, "") || null;

      const verified = html.includes("verified-icon") || html.includes("icon-ok");

      return {
        platform: "twitter",
        handle: cleanHandle,
        display_name: displayName,
        bio,
        avatar_url: avatar ? (avatar.startsWith("http") ? avatar : `${mirror}${avatar}`) : null,
        followers: followers ? parseInt(followers, 10) || null : null,
        following: following ? parseInt(following, 10) || null : null,
        posts_count: tweets ? parseInt(tweets, 10) || null : null,
        location,
        website,
        company: null,
        created_at: joinDate,
        verified,
        profile_url: `https://x.com/${cleanHandle}`,
        raw: null,
      };
    } catch (e: any) {
      lastError = e.message;
      continue;
    }
  }

  // Fallback: return minimal profile with known URL
  return {
    platform: "twitter",
    handle: cleanHandle,
    display_name: null,
    bio: null,
    avatar_url: null,
    followers: null,
    following: null,
    posts_count: null,
    location: null,
    website: null,
    company: null,
    created_at: null,
    verified: false,
    profile_url: `https://x.com/${cleanHandle}`,
    raw: { error: `Scraping failed — nitter mirrors unreachable. ${lastError}` },
  };
}

// ---------------------------------------------------------------------------
// LinkedIn — public profile page (often blocked, best-effort)
// ---------------------------------------------------------------------------

async function lookupLinkedIn(handle: string): Promise<ProfileResult> {
  const profileUrl = `https://www.linkedin.com/in/${encodeURIComponent(handle)}`;

  try {
    const res = await fetch(profileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    const html = await res.text();
    const root = parseHTML(html);

    // LinkedIn public profiles have limited data in the HTML
    const title = root.querySelector("title")?.text?.trim() || "";
    const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content") || null;

    // Parse name from title: "FirstName LastName - Title | LinkedIn"
    const nameMatch = title.match(/^(.+?)\s*[-–|]/);
    const displayName = nameMatch?.[1]?.trim() || null;

    return {
      platform: "linkedin",
      handle,
      display_name: displayName,
      bio: metaDesc || null,
      avatar_url: ogImage,
      followers: null,
      following: null,
      posts_count: null,
      location: null,
      website: null,
      company: null,
      created_at: null,
      verified: false,
      profile_url: profileUrl,
      raw: { note: "LinkedIn limits public profile data. Full enrichment requires LinkedIn API." },
    };
  } catch (e: any) {
    return {
      platform: "linkedin",
      handle,
      display_name: null,
      bio: null,
      avatar_url: null,
      followers: null,
      following: null,
      posts_count: null,
      location: null,
      website: null,
      company: null,
      created_at: null,
      verified: false,
      profile_url: profileUrl,
      raw: { error: `LinkedIn scraping failed: ${e.message}` },
    };
  }
}

// ---------------------------------------------------------------------------
// YouTube — channel page scraping
// ---------------------------------------------------------------------------

async function lookupYouTube(handle: string): Promise<ProfileResult> {
  // Handle can be @username, channel ID, or custom URL
  let channelUrl: string;
  if (handle.startsWith("UC") && handle.length >= 20) {
    channelUrl = `https://www.youtube.com/channel/${handle}`;
  } else if (handle.startsWith("@")) {
    channelUrl = `https://www.youtube.com/${handle}`;
  } else {
    channelUrl = `https://www.youtube.com/@${handle}`;
  }

  try {
    const res = await fetch(channelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });

    const html = await res.text();

    // Extract from meta tags and inline JSON
    const root = parseHTML(html);
    const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute("content") || null;
    const ogDesc = root.querySelector('meta[property="og:description"]')?.getAttribute("content") || null;
    const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content") || null;
    const ogUrl = root.querySelector('meta[property="og:url"]')?.getAttribute("content") || channelUrl;

    // Try to extract subscriber count from page source
    let subscribers: number | null = null;
    let videoCount: number | null = null;

    // YouTube puts subscriber count in the page's JSON data
    const subMatch = html.match(/"subscriberCountText":\s*\{"simpleText":\s*"([^"]+)"/);
    if (subMatch) {
      subscribers = parseYouTubeCount(subMatch[1]);
    }

    const vidMatch = html.match(/"videosCountText":\s*\{"runs":\s*\[\{"text":\s*"([\d,]+)"/);
    if (vidMatch) {
      videoCount = parseInt(vidMatch[1].replace(/,/g, ""), 10) || null;
    }

    // Try joinedDateText
    let joinedDate: string | null = null;
    const joinMatch = html.match(/"joinedDateText":\s*\{"content":\s*"Joined\s+([^"]+)"/);
    if (joinMatch) {
      joinedDate = joinMatch[1];
    }

    return {
      platform: "youtube",
      handle: handle.startsWith("@") ? handle : `@${handle}`,
      display_name: ogTitle,
      bio: ogDesc,
      avatar_url: ogImage,
      followers: subscribers,
      following: null,
      posts_count: videoCount,
      location: null,
      website: null,
      company: null,
      created_at: joinedDate,
      verified: html.includes('"isVerified":true'),
      profile_url: ogUrl || channelUrl,
      raw: null,
    };
  } catch (e: any) {
    return {
      platform: "youtube",
      handle,
      display_name: null,
      bio: null,
      avatar_url: null,
      followers: null,
      following: null,
      posts_count: null,
      location: null,
      website: null,
      company: null,
      created_at: null,
      verified: false,
      profile_url: channelUrl,
      raw: { error: `YouTube scraping failed: ${e.message}` },
    };
  }
}

function parseYouTubeCount(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/subscribers?/i, "").trim();
  const match = cleaned.match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || "").toUpperCase();
  const multipliers: Record<string, number> = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  return Math.round(num * (multipliers[suffix] || 1));
}

// ---------------------------------------------------------------------------
// Platform lookup dispatcher
// ---------------------------------------------------------------------------

const PLATFORM_HANDLERS: Record<string, (handle: string) => Promise<ProfileResult>> = {
  github: lookupGitHub,
  twitter: lookupTwitter,
  linkedin: lookupLinkedIn,
  youtube: lookupYouTube,
};

const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_HANDLERS);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerRoutes(app: Hono) {
  app.get("/api/lookup", async (c) => {
    await tryRequirePayment(0.008);
    let handle = c.req.query("handle");
    let platform = c.req.query("platform")?.toLowerCase();
    const url = c.req.query("url");

    // If URL is provided, detect platform and handle from it
    if (url) {
      const detected = detectPlatformFromUrl(url);
      if (!detected) {
        return c.json({ error: "Could not detect platform from URL. Supported: github.com, twitter.com, x.com, linkedin.com/in/, youtube.com" }, 400);
      }
      handle = detected.handle;
      platform = detected.platform;
    }

    if (!handle) {
      return c.json({ error: "Missing required parameter: handle (or url)" }, 400);
    }
    if (!platform) {
      return c.json({ error: "Missing required parameter: platform (github, twitter, linkedin, youtube)" }, 400);
    }
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return c.json({ error: `Unsupported platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(", ")}` }, 400);
    }

    const startTime = Date.now();
    try {
      const result = await PLATFORM_HANDLERS[platform](handle);
      return c.json({ ...result, lookup_time_ms: Date.now() - startTime });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Profile lookup failed";
      return c.json({ error: msg, platform, handle, lookup_time_ms: Date.now() - startTime }, 500);
    }
  });
}
