// Display-only helper. Attendance locations remain unchanged in the database.
export function attendanceMapsUrl(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function attendanceLocationLabel(value) {
  if (!value) return "Location unavailable";
  if (/offsite|off-site/i.test(value)) return "Off-site";
  if (/onsite|on-site/i.test(value)) return "On-site";
  return "Recorded location";
}
