import { attendanceMapsUrl, attendanceLocationLabel } from "../utils/attendanceLocation";

function Evidence({ title, photo, location }) {
  const url = attendanceMapsUrl(location);
  return (
    <div className="cibo-staff-evidence">
      <strong>{title} Photo</strong>
      <div className="cibo-staff-photo">
        {photo ? <img src={photo} alt={`${title} attendance evidence`} loading="lazy" /> : <span>Photo unavailable</span>}
      </div>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer">View on Google Maps ↗</a> : <span className="cibo-staff-unavailable">Location unavailable</span>}
    </div>
  );
}

export default function StaffMobileAttendanceCards({ logs = [], hoursWorked, onUpdateAttendance }) {
  return (
    <div className="cibo-staff-mobile-cards">
      <style>{`
        .cibo-staff-mobile-cards { display: none; }
        @media (max-width: 768px) {
          .cibo-staff-mobile-cards { display: grid; gap: 12px; width: 100%; min-width: 0; }
          .cibo-staff-mobile-card { min-width: 0; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 12px; background: #fff; color: #111827; }
          .cibo-staff-mobile-head { display: flex; align-items: start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
          .cibo-staff-mobile-head strong { font-size: 14px; overflow-wrap: anywhere; }
          .cibo-staff-mobile-head small { display: block; color: #6b7280; margin-top: 3px; font-size: 11px; }
          .cibo-staff-mobile-status { flex-shrink: 0; border-radius: 20px; background: #f3f4f6; padding: 4px 8px; font-size: 11px; }
          .cibo-staff-mobile-times { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
          .cibo-staff-mobile-times small { display: block; color: #6b7280; font-size: 10px; font-weight: 700; }
          .cibo-staff-mobile-times strong { display: block; margin: 5px 0 8px; font-size: clamp(14px,4vw,18px); white-space: nowrap; }
          .cibo-staff-mobile-times span { font-size: 11px; color: #6b7280; }
          .cibo-staff-mobile-metrics { display: flex; flex-wrap: wrap; gap: 5px 12px; margin-top: 12px; color: #6b7280; font-size: 11px; }
          .cibo-staff-mobile-details { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
          .cibo-staff-mobile-details summary { list-style: none; cursor: pointer; text-align: center; border: 1px solid #f97316; color: #c2410c; padding: 10px; border-radius: 9px; font-size: 12px; font-weight: 600; }
          .cibo-staff-mobile-details summary::-webkit-details-marker { display: none; }
          .cibo-staff-mobile-details summary::before { content: "⌄  "; }
          .cibo-staff-mobile-details[open] summary::before { content: "⌃  "; }
          .cibo-staff-mobile-evidence-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; margin-top: 14px; }
          .cibo-staff-evidence { min-width: 0; text-align: center; }
          .cibo-staff-evidence strong { display: block; font-size: 11px; margin-bottom: 8px; }
          .cibo-staff-photo { height: 116px; background: #f3f4f6; border-radius: 10px; display: flex; justify-content: center; align-items: center; overflow: hidden; }
          .cibo-staff-photo img { width: 100%; height: 100%; object-fit: contain; }
          .cibo-staff-photo span { font-size: 11px; color: #6b7280; }
          .cibo-staff-evidence a, .cibo-staff-unavailable { display: block; margin-top: 9px; font-size: 11px; overflow-wrap: anywhere; }
          .cibo-staff-evidence a { color: #c2410c; text-decoration: underline; }
          .cibo-staff-unavailable { color: #6b7280; }
          .cibo-staff-correction { margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 12px; overflow-wrap: anywhere; }
          .cibo-staff-correction a { color: #c2410c; }
          .cibo-staff-update { margin-top: 10px; width: 100%; padding: 10px; border: 0; border-radius: 8px; color: #fff; background: #f97316; font-size: 12px; font-weight: 600; cursor: pointer; }
        }
      `}</style>
      {logs.length === 0 && <p>No attendance records found.</p>}
      {logs.map((log, index) => (
        <article className="cibo-staff-mobile-card" key={log.id || `${log.name}-${log.log_date}-${index}`}>
          <div className="cibo-staff-mobile-head">
            <div><strong>{log.name || "Employee"}</strong><small>{log.position || "—"}</small></div>
            <span className="cibo-staff-mobile-status">{log.status || "—"}</span>
          </div>
          <div className="cibo-staff-mobile-times">
            <div><small>TIME IN</small><strong>{log.time_in || "—"}</strong><span>⌖ {attendanceLocationLabel(log.time_in_location)}</span></div>
            <div><small>TIME OUT</small><strong>{log.time_out || "—"}</strong><span>⌖ {attendanceLocationLabel(log.time_out_location)}</span></div>
          </div>
          <div className="cibo-staff-mobile-metrics">
            <span>Late: {log.late || "—"}</span>
            <span>Overtime: {log.overtime || "—"}</span>
            {hoursWorked && <span>Hours worked: {hoursWorked(log)}</span>}
          </div>
          <details className="cibo-staff-mobile-details">
            <summary>View photos &amp; locations</summary>
            <div className="cibo-staff-mobile-evidence-grid">
              <Evidence title="Time In" photo={log.time_in_face_url} location={log.time_in_location} />
              <Evidence title="Time Out" photo={log.time_out_face_url} location={log.time_out_location} />
            </div>
            {log.correction && <div className="cibo-staff-correction">Correction: {log.correction.concern || log.correction.status || "Submitted"}{log.correction.attachment_url && <> · <a href={log.correction.attachment_url} target="_blank" rel="noopener noreferrer">View attachment</a></>}</div>}
            {onUpdateAttendance && log.correction && log.correction.status !== "Approved" && <button type="button" className="cibo-staff-update" onClick={() => onUpdateAttendance(log)}>Update Attendance</button>}
          </details>
        </article>
      ))}
    </div>
  );
}
