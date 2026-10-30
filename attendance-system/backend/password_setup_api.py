"""Authenticated temporary-password setup endpoints.

Registered via include_router from backend.main. Never logs or stores plaintext
credentials; the service-role Supabase client stays on the backend.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .password_setup_status import ACTIVE, EXPIRED, PENDING_SETUP, get_password_setup_status
from .temporary_passwords import (
    generate_temporary_password, temporary_password_expires_at,
    validate_permanent_password,
)

router = APIRouter(prefix="/auth/password-setup", tags=["password-setup"])


class ResetTemporaryPasswordRequest(BaseModel):
    target_user_id: str


class CompletePasswordSetupRequest(BaseModel):
    password: str


def _client():
    # Resolve lazily to avoid circular imports during FastAPI initialization.
    from .main import supabase
    return supabase


def _user(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required.")
    try:
        response = _client().auth.get_user(authorization[7:].strip())
        if response.user:
            return response.user
    except Exception:
        pass
    raise HTTPException(401, "Invalid authentication session.")


def _profile(user_id):
    rows = (_client().from_("employee_profiles")
            .select("id,role_id,branch_id").eq("id", user_id).limit(1)
            .execute().data or [])
    if not rows:
        raise HTTPException(403, "Employee profile not found.")
    return rows[0]


def _role(profile):
    rows = (_client().from_("roles").select("name")
            .eq("id", profile["role_id"]).limit(1).execute().data or [])
    return (rows[0].get("name") or "").strip().lower() if rows else ""


def _status(user_id):
    rows = (_client().from_("employee_password_setup")
            .select("change_required,temporary_password_expires_at")
            .eq("user_id", user_id).limit(1).execute().data or [])
    if not rows:
        return ACTIVE, None
    row = rows[0]
    expires = row.get("temporary_password_expires_at")
    expiry = datetime.fromisoformat(expires.replace("Z", "+00:00")) if expires else None
    return get_password_setup_status(bool(row["change_required"]), expiry), expires


@router.get("/status")
def password_setup_status(authorization: str | None = Header(default=None)):
    user = _user(authorization)
    try:
        status, expiry = _status(user.id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Unable to verify password setup status.")
    return {"status": status, "expires_at": expiry}


@router.get("/employees")
def employee_setup_statuses(authorization: str | None = Header(default=None)):
    caller = _user(authorization)
    caller_profile = _profile(caller.id)
    caller_role = _role(caller_profile)
    if caller_role not in ("maintenance", "hr"):
        raise HTTPException(403, "Supervisor access required.")
    db = _client()
    if caller_role == "maintenance":
        employees = (db.from_("employee_profiles").select("id,role_id,branch_id")
                     .eq("branch_id", caller_profile.get("branch_id")).execute().data or [])
        employees = [row for row in employees if _role(row) == "employee"]
    else:
        employees = (db.from_("employee_profiles").select("id,role_id,branch_id")
                     .execute().data or [])
        employees = [row for row in employees if _role(row) == "maintenance"]
    return {"statuses": {
        row["id"]: _status(row["id"])[0] for row in employees
    }}


@router.post("/issue")
def issue_temporary_password(
    payload: ResetTemporaryPasswordRequest,
    authorization: str | None = Header(default=None),
):
    caller = _user(authorization)
    db = _client()
    caller_profile = _profile(caller.id)
    target_profile = _profile(payload.target_user_id)
    caller_role = _role(caller_profile)
    target_role = _role(target_profile)
    permitted = (
        (caller_role == "maintenance" and target_role == "employee"
         and caller_profile.get("branch_id") == target_profile.get("branch_id"))
        or (caller_role == "hr" and target_role == "maintenance")
    )
    if not permitted or caller.id == payload.target_user_id:
        raise HTTPException(403, "You are not authorized to reset this account.")
    now = datetime.now(timezone.utc)
    expiry = temporary_password_expires_at(now)
    password = generate_temporary_password()
    # Fail closed: record required setup before changing the Auth password.
    try:
        db.from_("employee_password_setup").upsert({
            "user_id": payload.target_user_id,
            "change_required": True,
            "issued_at": now.isoformat(),
            "temporary_password_expires_at": expiry.isoformat(),
            "completed_at": None,
            "updated_at": now.isoformat(),
        }).execute()
    except Exception:
        raise HTTPException(503, "Unable to prepare password setup.")
    try:
        db.auth.admin.update_user_by_id(payload.target_user_id, {"password": password})
    except Exception:
        # Keep setup required; do not inadvertently restore dashboard access.
        raise HTTPException(503, "Unable to issue temporary password. Contact HR.")
    return {"status": PENDING_SETUP, "temporary_password": password,
            "expires_at": expiry.isoformat()}


@router.post("/complete")
def complete_password_setup(
    payload: CompletePasswordSetupRequest,
    authorization: str | None = Header(default=None),
):
    user = _user(authorization)
    if not validate_permanent_password(payload.password):
        raise HTTPException(400, "Use at least 12 characters with uppercase, lowercase, number and symbol.")
    db = _client()
    try:
        status, _ = _status(user.id)
    except Exception:
        raise HTTPException(503, "Unable to verify password setup.")
    if status == EXPIRED:
        raise HTTPException(403, "Temporary password expired. Contact your supervisor.")
    if status != PENDING_SETUP:
        raise HTTPException(409, "No temporary password setup is pending.")
    try:
        db.auth.admin.update_user_by_id(user.id, {"password": payload.password})
        db.from_("employee_password_setup").update({
            "change_required": False,
            "temporary_password_expires_at": None,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("user_id", user.id).eq("change_required", True).execute()
    except Exception:
        raise HTTPException(503, "Password setup could not be completed. Please retry.")
    return {"status": ACTIVE}
