import React from "react";

// Read coordinates already stored in attendance_logs; never geocode or modify them.
function mapsUrl(location) {
  if (typeof location !== "string") return null;
  const match = location.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function formatTime(value) {
  return value
    ? new Date(value).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
      })
    : "—";
}

function AttendanceEvidence({ label, location, photo }) {
  const url = mapsUrl(location);
  return (
    <div className="cibo-mobile-event">
      <strong className="cibo-mobile-photo-label">{label} Photo</strong>
      <div className="cibo-mobile-photo">
        {photo ? <img src={photo} alt={`${label} attendance photo`} loading="lazy" /> : <span>Photo unavailable</span>}
      </div>
      {url ? <a className="cibo-mobile-maps" href={url} target="_blank" rel="noopener noreferrer">View on Google Maps ↗</a> : <span className="cibo-mobile-maps-unavailable">Location unavailable</span>}
    </div>
  );
}

export default function MobileAttendanceCards({ logs, onCorrect }) {
  return (
    <div className="cibo-mobile-attendance">
      <style>{`
        .cibo-mobile-attendance { display: none; }
        @media (max-width: 768px) {
          .cibo-profile-attendance .cibo-desktop-attendance-table { display: none !important; }
          .cibo-mobile-attendance { display: grid; gap: 12px; width: 100%; min-width: 0; text-align: left; }
          .cibo-mobile-attendance-card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px 12px; background: #fff; min-width: 0; }
          .cibo-mobile-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
          .cibo-mobile-card-heading strong { font-size: 14px; color: #111827; }
          .cibo-mobile-card-status { border-radius: 999px; background: #f3f4f6; color: #374151; font-size: 11px; padding: 4px 8px; white-space: nowrap; }
          .cibo-mobile-event-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
          .cibo-mobile-event { min-width: 0; display: flex; flex-direction: column; align-items: stretch; }
          .cibo-mobile-event-label { font-size: 10px; font-weight: 700; color: #6b7280; }
          .cibo-mobile-event-time { font-size: clamp(14px,4vw,18px); font-weight: 700; color: #111827; white-space: nowrap; margin: 5px 0 8px; }
          .cibo-mobile-event-location,.cibo-mobile-event-photo-state { font-size: 11px; color: #6b7280; margin-bottom: 6px; }
          .cibo-mobile-details { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
          .cibo-mobile-details summary { list-style: none; cursor: pointer; border: 1px solid #f97316; border-radius: 10px; text-align: center; padding: 10px; font-size: 13px; font-weight: 600; color: #c2410c; }
          .cibo-mobile-details summary::-webkit-details-marker { display: none; }
          .cibo-mobile-details summary::before { content: "⌄  "; }
          .cibo-mobile-details[open] summary::before { content: "⌃  "; }
          .cibo-mobile-details .cibo-mobile-event-grid { margin-top: 14px; }
          .cibo-mobile-photo { background: #f3f4f6; border-radius: 10px; height: 104px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 7px; }
          .cibo-mobile-photo img { width: 100%; height: 100%; object-fit: contain; }
          .cibo-mobile-photo span { font-size: 11px; color: #6b7280; }
          .cibo-mobile-photo-label { display: block; text-align: center; font-size: 11px; color: #374151; margin-bottom: 8px; }
          .cibo-mobile-maps,.cibo-mobile-maps-unavailable { display: block; margin-top: 9px; font-size: 11px; overflow-wrap: anywhere; text-align: center; }
          .cibo-mobile-maps { color: #c2410c; text-decoration: underline; }
          .cibo-mobile-maps-unavailable { color: #6b7280; }
          .cibo-mobile-correction { display: block; width: 100%; margin-top: 12px; padding: 10px; border: 0; border-radius: 8px; color: white; background: #f97316; font-weight: 600; font-size: 12px; cursor: pointer; }
          .cibo-mobile-correction:disabled { background: #9ca3af; cursor: not-allowed; }
          .cibo-mobile-metrics { margin: 10px 0 0; display: flex; gap: 8px; flex-wrap: wrap; color: #6b7280; font-size: 11px; }
        }
      `}</style>
      {(logs || []).slice(0, 5).map((log) => {
        const date = log.log_date
          ? new Date(`${log.log_date}T12:00:00+08:00`)
          : log.time_in ? new Date(log.time_in) : null;
        const status = log.status || "Present";
        const correctionLabel = log.correction?.status === "Pending" ? "Correction Pending" : ["Approved", "Rejected"].includes(log.correction?.status) ? "Request Again" : "Request to Correct";
        return (
          <article className="cibo-mobile-attendance-card" key={log.id}>
            <div className="cibo-mobile-card-heading">
              <strong>{date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }) : "Date unavailable"}</strong>
              <span className="cibo-mobile-card-status">{status}</span>
            </div>
            <div className="cibo-mobile-event-grid">
              {[["TIME IN", log.time_in, log.time_in_location, log.time_in_face_url], ["TIME OUT", log.time_out, log.time_out_location, log.time_out_face_url]].map(([label, time, location, photo]) => (
                <div key={label}>
                  <div className="cibo-mobile-event-label">{label}</div>
                  <div className="cibo-mobile-event-time">{formatTime(time)}</div>
                  <div className="cibo-mobile-event-location">{location ? (/offsite|off-site/i.test(location) ? "Off-site" : "Recorded location") : "Location unavailable"}</div>
                  <div className="cibo-mobile-event-photo-state">{photo ? "Photo saved" : "Photo unavailable"}</div>
                </div>
              ))}
            </div>
            <div className="cibo-mobile-metrics">
              <span>Late: {log.late_minutes > 0 ? `${Math.floor(log.late_minutes / 60)}h ${log.late_minutes % 60}m` : "0m"}</span>
              <span>Overtime: {log.overtime_minutes > 0 ? `${Math.floor(log.overtime_minutes / 60)}h ${log.overtime_minutes % 60}m` : "0m"}</span>
            </div>
            <details className="cibo-mobile-details">
              <summary>View photos &amp; locations</summary>
              <div className="cibo-mobile-event-grid">
                <AttendanceEvidence label="Time In" location={log.time_in_location} photo={log.time_in_face_url} />
                <AttendanceEvidence label="Time Out" location={log.time_out_location} photo={log.time_out_face_url} />
              </div>
              <button className="cibo-mobile-correction" disabled={log.correction?.status === "Pending"} onClick={() => onCorrect(log)}>{correctionLabel}</button>
            </details>
          </article>
        );
      })}
    </div>
  );
}
