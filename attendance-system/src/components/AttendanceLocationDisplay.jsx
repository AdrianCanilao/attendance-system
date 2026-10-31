import { attendanceMapsUrl, attendanceKioskBranch } from "../utils/attendanceLocation";

// Shared read-only location presentation for all employee and supervisor views.
export default function AttendanceLocationDisplay({ location, source, compact = false }) {
  const branch = attendanceKioskBranch(location, source);
  const url = branch ? null : attendanceMapsUrl(location);
  const status = branch ? "On-site" : url ? "Off-site" : null;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 0, maxWidth: "100%", lineHeight: 1.3, textAlign: "center" }}>
      {status && <span style={{ fontSize: 10, fontWeight: 600, color: branch ? "#047857" : "#c2410c" }}>{status}</span>}
      {branch ? (
        <span title={branch} style={{ fontSize: 10, color: "#667085", overflowWrap: "anywhere", maxWidth: "100%" }}>{branch}</span>
      ) : url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="View recorded attendance location in Google Maps"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, textDecoration: "none", border: "1px solid #fed7aa", borderRadius: 6, background: "#fff7ed", color: "#c2410c", fontSize: 10, fontWeight: 600, padding: compact ? "3px 6px" : "4px 7px", boxSizing: "border-box" }}>
          <span aria-hidden="true">⌖</span> View map <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span style={{ color: "#667085", fontSize: 10 }}>{location ? "Location unavailable" : "Location unavailable"}</span>
      )}
    </span>
  );
}
