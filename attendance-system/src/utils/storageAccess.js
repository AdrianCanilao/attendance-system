import { supabase } from "../supabaseClient";

export async function getStorageAccessUrl(
  bucket,
  storedUrl,
  expiresIn = 3600
) {
  if (!storedUrl) return null;

  let objectPath = storedUrl;

  // Stored values may be either a raw object path or an older
  // Supabase public/signed/authenticated URL. Always normalize
  // Supabase Storage URLs back to the object path before signing.
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];

  for (const marker of markers) {
    if (storedUrl.includes(marker)) {
      objectPath = decodeURIComponent(
        storedUrl.split(marker)[1].split("?")[0]
      );
      break;
    }
  }

  // Do not pass unrelated external URLs through the private-storage
  // helper. Those can remain normal image URLs.
  if (
    objectPath.startsWith("http://") ||
    objectPath.startsWith("https://")
  ) {
    return storedUrl;
  }

  objectPath = objectPath.replace(/^\/+/, "");

  if (!objectPath) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  // Fallback: download through the authenticated Storage client and
  // expose only a temporary in-memory URL to the current browser.
  // This keeps the bucket private while allowing image rendering when
  // signed URL creation is unavailable in a particular browser/session.
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(objectPath);

  if (!downloadError && fileData) {
    return URL.createObjectURL(fileData);
  }

  console.error(
    "Failed to create storage access URL:",
    error || downloadError
  );

  return null;
}
