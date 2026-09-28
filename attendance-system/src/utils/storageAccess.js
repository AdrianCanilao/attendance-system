import { supabase } from "../supabaseClient";

export async function getStorageAccessUrl(bucket, storedUrl, expiresIn = 3600) {
  if (!storedUrl) return null;

  const marker = `/storage/v1/object/public/${bucket}/`;

  let objectPath = storedUrl;

  if (storedUrl.includes(marker)) {
    objectPath = decodeURIComponent(
      storedUrl.split(marker)[1].split("?")[0]
    );
  }

  if (!objectPath || objectPath.startsWith("http")) {
    return storedUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn);

  if (error || !data?.signedUrl) {
    console.error("Failed to create storage access URL:", error);
    return null;
  }

  return data.signedUrl;
}
