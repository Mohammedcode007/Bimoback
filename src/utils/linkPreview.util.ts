// utils/linkPreview.util.ts
import ogs from "open-graph-scraper";

export const getLinkPreview = async (url: string) => {
  try {
    const { result } = await ogs({ url });

    return {
      url,
      title: result.ogTitle || "",
      description: result.ogDescription || "",
      image: result.ogImage?.[0]?.url || "",
      siteName: result.ogSiteName || ""
    };
  } catch (err) {
    return { url };
  }
};