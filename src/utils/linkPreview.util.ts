// // utils/linkPreview.util.ts
// import ogs from "open-graph-scraper";

// export const getLinkPreview = async (url: string) => {
//   try {
//     const { result } = await ogs({ url });

//     return {
//       url,
//       title: result.ogTitle || "",
//       description: result.ogDescription || "",
//       image: result.ogImage?.[0]?.url || "",
//       siteName: result.ogSiteName || ""
//     };
//   } catch (err) {
//     return { url };
//   }
// };
import axios from "axios";
import ogs from "open-graph-scraper";
import * as cheerio from "cheerio";
import { Agent } from "undici";
import https from "https";

type LinkPreviewResult = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

const undiciAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

function normalizeUrl(url: string) {
  if (!url) return "";
  const value = String(url).trim();

  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;

  return value;
}

function getHostName(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function toAbsoluteUrl(baseUrl: string, value?: string | null) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function cleanText(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getYoutubeVideoId(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim();
    }

    return null;
  } catch {
    return null;
  }
}

function getYouTubeFallbackPreview(url: string): LinkPreviewResult | null {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;

  return {
    url,
    title: "YouTube",
    description: "",
    image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    siteName: "YouTube",
  };
}

async function resolveFinalUrl(inputUrl: string) {
  try {
    const response = await axios.get(inputUrl, {
      maxRedirects: 5,
      timeout: 10000,
      validateStatus: () => true,
      responseType: "text",
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      headers: {
        "user-agent": USER_AGENT,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ar;q=0.8",
      },
    });

    const finalUrl =
      (response.request as any)?.res?.responseUrl ||
      response.config?.url ||
      inputUrl;

    return normalizeUrl(finalUrl);
  } catch (error) {
    console.log("⚠️ [LINK PREVIEW] resolveFinalUrl fallback:", inputUrl);
    console.log("⚠️ [LINK PREVIEW] resolveFinalUrl raw error:", error);
    return normalizeUrl(inputUrl);
  }
}

async function fetchHtml(url: string) {
  const response = await axios.get(url, {
    maxRedirects: 5,
    timeout: 12000,
    validateStatus: () => true,
    responseType: "text",
    decompress: true,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
    headers: {
      "user-agent": USER_AGENT,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,ar;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });

  const finalUrl =
    (response.request as any)?.res?.responseUrl || response.config?.url || url;

  const html =
    typeof response.data === "string"
      ? response.data
      : Buffer.isBuffer(response.data)
      ? response.data.toString("utf8")
      : "";

  return {
    html,
    finalUrl: normalizeUrl(finalUrl),
    status: response.status,
    contentType: String(response.headers?.["content-type"] || ""),
  };
}

function getMetaContent(
  $: cheerio.CheerioAPI,
  selectors: string[],
  baseUrl: string
) {
  for (const selector of selectors) {
    const value = $(selector).attr("content") || $(selector).attr("href");
    const cleaned = cleanText(value);
    if (cleaned) return toAbsoluteUrl(baseUrl, cleaned);
  }
  return "";
}

function extractJsonLdData(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Partial<LinkPreviewResult> {
  let best: Partial<LinkPreviewResult> = {};

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of list) {
        if (!item || typeof item !== "object") continue;

        const title = cleanText(item.headline || item.name || item.alternativeHeadline);
        const description = cleanText(item.description);
        const siteName = cleanText(item.publisher?.name || item.author?.name);
        let image = "";

        if (typeof item.image === "string") {
          image = toAbsoluteUrl(baseUrl, item.image);
        } else if (Array.isArray(item.image) && item.image.length > 0) {
          const first = item.image[0];
          if (typeof first === "string") {
            image = toAbsoluteUrl(baseUrl, first);
          } else if (first?.url) {
            image = toAbsoluteUrl(baseUrl, first.url);
          }
        } else if (item.image?.url) {
          image = toAbsoluteUrl(baseUrl, item.image.url);
        }

        if (title || description || image || siteName) {
          best = {
            title: best.title || title,
            description: best.description || description,
            image: best.image || image,
            siteName: best.siteName || siteName,
          };
          return false;
        }
      }
    } catch {
      // ignore invalid json-ld
    }
  });

  return best;
}

function extractFirstUsefulImage(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string {
  const candidates: string[] = [];

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src") ||
      $(el).attr("data-original");
    if (!src) return;

    const width = Number($(el).attr("width") || 0);
    const height = Number($(el).attr("height") || 0);

    if ((width && width < 150) || (height && height < 150)) return;

    candidates.push(toAbsoluteUrl(baseUrl, src));
  });

  return candidates.find(Boolean) || "";
}

function extractManualPreview(html: string, finalUrl: string): LinkPreviewResult {
  const $ = cheerio.load(html);

  const jsonLd = extractJsonLdData($, finalUrl);

  const title = cleanText(
    getMetaContent(
      $,
      [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]',
      ],
      finalUrl
    ) ||
      jsonLd.title ||
      $("title").first().text()
  );

  const description = cleanText(
    getMetaContent(
      $,
      [
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]',
      ],
      finalUrl
    ) || jsonLd.description
  );

  const image =
    getMetaContent(
      $,
      [
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
        'link[rel="image_src"]',
      ],
      finalUrl
    ) ||
    jsonLd.image ||
    extractFirstUsefulImage($, finalUrl) ||
    toAbsoluteUrl(
      finalUrl,
      $('link[rel="icon"]').attr("href") ||
        $('link[rel="shortcut icon"]').attr("href") ||
        ""
    );

  const siteName = cleanText(
    getMetaContent(
      $,
      ['meta[property="og:site_name"]', 'meta[name="application-name"]'],
      finalUrl
    ) ||
      jsonLd.siteName ||
      getHostName(finalUrl)
  );

  return {
    url: finalUrl,
    title,
    description,
    image,
    siteName,
  };
}

function isGoodPreview(preview?: Partial<LinkPreviewResult> | null) {
  if (!preview) return false;
  return Boolean(
    cleanText(preview.title) ||
      cleanText(preview.description) ||
      cleanText(preview.image) ||
      cleanText(preview.siteName)
  );
}

export async function getLinkPreview(inputUrl: string): Promise<LinkPreviewResult> {
  const normalizedInput = normalizeUrl(inputUrl);

  try {
    const resolvedUrl = await resolveFinalUrl(normalizedInput);

    console.log("🟡 [LINK PREVIEW] Input URL:", normalizedInput);
    console.log("🟢 [LINK PREVIEW] Resolved URL:", resolvedUrl);

    const youtubeFallback = getYouTubeFallbackPreview(resolvedUrl);

    let html = "";
    let finalUrl = resolvedUrl;

    try {
      const fetched = await fetchHtml(resolvedUrl);
      html = fetched.html;
      finalUrl = fetched.finalUrl || resolvedUrl;

      console.log("🌐 [LINK PREVIEW] fetchHtml status:", fetched.status);
      console.log("🌐 [LINK PREVIEW] fetchHtml finalUrl:", finalUrl);
      console.log("🌐 [LINK PREVIEW] fetchHtml contentType:", fetched.contentType);
      console.log("🌐 [LINK PREVIEW] fetchHtml html length:", html?.length || 0);
    } catch (fetchErr) {
      console.log("⚠️ [LINK PREVIEW] fetchHtml failed:", fetchErr);
    }

    // 1) جرّب OGS باستخدام html الجاهز
    if (html) {
      try {
        const ogsData = await ogs({
          html,
          url: finalUrl,
          timeout: 10000,
          onlyGetOpenGraphInfo: false,
          fetchOptions: {
            dispatcher: undiciAgent,
            headers: {
              "user-agent": USER_AGENT,
              accept: "text/html,application/xhtml+xml",
            },
          },
        });

        console.log("🧪 [LINK PREVIEW] ogs from html raw:", ogsData);

        const { error, result } = ogsData as any;

        if (!error && result) {
          const preview: LinkPreviewResult = {
            url: finalUrl,
            title: cleanText(
              result?.ogTitle ||
                result?.twitterTitle ||
                result?.dcTitle ||
                ""
            ),
            description: cleanText(
              result?.ogDescription ||
                result?.twitterDescription ||
                result?.dcDescription ||
                ""
            ),
            image: cleanText(
              result?.ogImage?.[0]?.url ||
                result?.twitterImage?.[0]?.url ||
                youtubeFallback?.image ||
                ""
            ),
            siteName: cleanText(
              result?.ogSiteName ||
                youtubeFallback?.siteName ||
                getHostName(finalUrl)
            ),
          };

          if (isGoodPreview(preview)) {
            console.log("✅ [LINK PREVIEW] Using OGS(html) preview:", preview);
            return preview;
          }
        }
      } catch (ogsHtmlErr) {
        console.log("⚠️ [LINK PREVIEW] OGS(html) failed:", ogsHtmlErr);
      }

      // 2) fallback يدوي من الـ HTML
      const manualPreview = extractManualPreview(html, finalUrl);
      if (isGoodPreview(manualPreview)) {
        console.log("✅ [LINK PREVIEW] Using manual HTML preview:", manualPreview);
        return manualPreview;
      }
    }

    // 3) جرّب OGS مباشرة بالرابط
    try {
      const ogsData = await ogs({
        url: finalUrl,
        timeout: 10000,
        onlyGetOpenGraphInfo: false,
        fetchOptions: {
          dispatcher: undiciAgent,
          headers: {
            "user-agent": USER_AGENT,
            accept: "text/html,application/xhtml+xml",
          },
        },
      });

      console.log("🧪 [LINK PREVIEW] ogs(url) raw:", ogsData);

      const { error, result } = ogsData as any;

      if (!error && result) {
        const preview: LinkPreviewResult = {
          url: finalUrl,
          title: cleanText(
            result?.ogTitle ||
              result?.twitterTitle ||
              result?.dcTitle ||
              ""
          ),
          description: cleanText(
            result?.ogDescription ||
              result?.twitterDescription ||
              result?.dcDescription ||
              ""
          ),
          image: cleanText(
            result?.ogImage?.[0]?.url ||
              result?.twitterImage?.[0]?.url ||
              youtubeFallback?.image ||
              ""
          ),
          siteName: cleanText(
            result?.ogSiteName ||
              youtubeFallback?.siteName ||
              getHostName(finalUrl)
          ),
        };

        if (isGoodPreview(preview)) {
          console.log("✅ [LINK PREVIEW] Using OGS(url) preview:", preview);
          return preview;
        }
      }
    } catch (ogsUrlErr) {
      console.log("⚠️ [LINK PREVIEW] OGS(url) failed:", ogsUrlErr);
    }

    // 4) fallback خاص يوتيوب
    if (youtubeFallback) {
      console.log("🎬 [LINK PREVIEW] Using YouTube fallback preview");
      return youtubeFallback;
    }

    // 5) آخر fallback
    const fallback: LinkPreviewResult = {
      url: finalUrl,
      title: "",
      description: "",
      image: "",
      siteName: getHostName(finalUrl),
    };

    console.log("🪫 [LINK PREVIEW] Final empty fallback:", fallback);
    return fallback;
  } catch (err: any) {
    console.log("❌ [LINK PREVIEW] catch raw error:", err);
    console.log("❌ [LINK PREVIEW] catch error message:", err?.message);
    console.log("❌ [LINK PREVIEW] catch error stack:", err?.stack);

    const youtubeFallback = getYouTubeFallbackPreview(normalizedInput);
    if (youtubeFallback) {
      console.log("🎬 [LINK PREVIEW] Using YouTube fallback from catch");
      return youtubeFallback;
    }

    return {
      url: normalizedInput,
      title: "",
      description: "",
      image: "",
      siteName: getHostName(normalizedInput),
    };
  }
}