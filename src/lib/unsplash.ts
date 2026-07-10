export interface UnsplashPhoto {
  id: string;
  url: string;
  thumbUrl: string;
  authorName: string;
  authorUrl: string;
  downloadLocation: string;
}

export async function searchUnsplashPhotos(query: string): Promise<UnsplashPhoto[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("UNSPLASH_ACCESS_KEY manquant, recherche Unsplash ignoree");
    return [];
  }

const res = await fetch(
  "https://api.unsplash.com/search/photos?query=" + encodeURIComponent(query) + "&per_page=12",
  {
    headers: { Authorization: "Client-ID " + accessKey },
  }
  );

if (!res.ok) {
  console.error("Unsplash error", res.status, await res.text());
  return [];
}

const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

return results.map((photo: any) => ({
  id: photo.id,
  url: photo.urls?.regular || photo.urls?.full || "",
  thumbUrl: photo.urls?.thumb || photo.urls?.small || "",
  authorName: photo.user?.name || "Inconnu",
  authorUrl: photo.user?.links?.html || "",
  downloadLocation: photo.links?.download_location || "",
}));
}

export async function triggerUnsplashDownload(downloadLocation: string): Promise<void> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !downloadLocation) return;
  try {
    const separator = downloadLocation.includes("?") ? "&" : "?";
    await fetch(downloadLocation + separator + "client_id=" + accessKey);
  } catch (err) {
    console.error("triggerUnsplashDownload error", err);
  }
}
