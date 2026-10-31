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

 
// Kiosk records may store the actual branch name instead of GPS coordinates.
// Keep the recorded branch as the source of truth; never infer it from the employee's assignment.
export function attendanceKioskBranch(value, source) {
  if (source !== "kiosk" || typeof value !== "string") return null;
  const name = value.trim();
  if (!name || /offsite|off-site|onsite|on-site/i.test(name) ||
      /-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?/.test(name)) return null;
  return name;
}
