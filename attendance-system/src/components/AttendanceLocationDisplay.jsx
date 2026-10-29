import { attendanceMapsUrl, attendanceLocationLabel } from "../utils/attendanceLocation";

// Presentation only: never modifies stored attendance coordinates.
export default function AttendanceLocationDisplay({ location }) {
  const url = attendanceMapsUrl(location);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, minWidth: 0, maxWidth: "100%", lineHeight: 1.35, textAlign: "center" }}>
      <span style={{ color: "#667085", fontSize: 11, whiteSpace: "nowrap" }}>
        {attendanceLocationLabel(location)}
      </span>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open recorded attendance location in Google Maps"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap", textDecoration: "none", border: "1px solid #fed7aa", borderRadius: 6, background: "#fff7ed", color: "#c2410c", fontSize: 10, fontWeight: 600, padding: "4px 7px", boxSizing: "border-box" }}>
          <span aria-hidden="true">⌖</span> View map <span aria-hidden="true">↗</span>
        </a>
      )}
    </span>
  );
}
