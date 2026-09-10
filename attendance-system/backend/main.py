from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import cv2
import numpy as np
import requests
from supabase import create_client
from deepface import DeepFace
import time
from mediapipe.python.solutions import face_mesh as mp_face_mesh
from datetime import datetime, date, timedelta

app = FastAPI()

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔥 SUPABASE CONFIG
SUPABASE_URL = "https://gncvkqqmreufoarakjmj.supabase.co"
SUPABASE_SERVICE_KEY = "sb_publishable_o2igaNv9uPIf3iM6nmgN4w_b8DyuYtZ"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 🔥 BLINK SETUP
face_mesh = mp_face_mesh.FaceMesh()

# 🔥 PRELOAD ARCFACE MODEL
print("🔥 Loading ArcFace model...", flush=True)
DeepFace.build_model("ArcFace")
print("✅ ArcFace model ready", flush=True)

def normalize_name(name: str):
    return name.strip().lower().replace(" ", "_")

def eye_aspect_ratio(landmarks, eye_points):
    p1 = np.array(landmarks[eye_points[0]])
    p2 = np.array(landmarks[eye_points[1]])
    p3 = np.array(landmarks[eye_points[2]])
    p4 = np.array(landmarks[eye_points[3]])
    p5 = np.array(landmarks[eye_points[4]])
    p6 = np.array(landmarks[eye_points[5]])

    vertical = np.linalg.norm(p2 - p6) + np.linalg.norm(p3 - p5)
    horizontal = np.linalg.norm(p1 - p4)

    return vertical / (2.0 * horizontal)

    # ============================================================
# 🚀 KIOSK FACE EMBEDDING CACHE
# ============================================================

kiosk_face_cache = []


def cosine_distance(a, b):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)

    denominator = (
        np.linalg.norm(a) *
        np.linalg.norm(b)
    )

    if denominator == 0:
        return 1.0

    similarity = np.dot(a, b) / denominator

    return float(1.0 - similarity)


def load_kiosk_face_cache():
    global kiosk_face_cache

    print(
        "🚀 Loading kiosk face embeddings...",
        flush=True
    )

    kiosk_face_cache = []

    EMPLOYEE_ROLE_ID = (
        "e4dbb928-7f0e-4da9-9eff-d7700d37b25a"
    )

    employees_response = (
        supabase
        .from_("employee_profiles")
        .select(
            "id, full_name, branch_id, shift_id"
        )
        .eq("role_id", EMPLOYEE_ROLE_ID)
        .execute()
    )

    employees = employees_response.data or []

    print(
        f"👥 KIOSK EMPLOYEES: {len(employees)}",
        flush=True
    )

    for employee in employees:

        employee_name = (
            employee.get("full_name") or ""
        )

        if not employee_name:
            continue

        safe_name = normalize_name(employee_name)

        folder_path = (
            f"employees/{safe_name}"
        )

        try:
            files_list = (
                supabase
                .storage
                .from_("faces")
                .list(folder_path)
                or []
            )

        except Exception as e:
            print(
                f"❌ CACHE STORAGE ERROR: "
                f"{employee_name}: {e}",
                flush=True
            )
            continue

        for stored_file in files_list:

            file_path = (
                f"{folder_path}/"
                f"{stored_file['name']}"
            )

            url = (
                f"{SUPABASE_URL}"
                f"/storage/v1/object/public/"
                f"faces/{file_path}"
            )

            try:

                response = requests.get(
                    url,
                    timeout=5
                )

                if response.status_code != 200:
                    continue

                stored_img = cv2.imdecode(
                    np.asarray(
                        bytearray(response.content),
                        dtype=np.uint8
                    ),
                    cv2.IMREAD_COLOR
                )

                if stored_img is None:
                    continue

                stored_img = cv2.resize(
                    stored_img,
                    (112, 112)
                )

                embedding_result = DeepFace.represent(
                    img_path=stored_img,
                    model_name="ArcFace",
                    detector_backend="skip",
                    enforce_detection=False
                )

                if not embedding_result:
                    continue

                embedding = (
                    embedding_result[0]["embedding"]
                )

                kiosk_face_cache.append({
                    "employee": employee,
                    "embedding": embedding
                })

                print(
                    f"✅ Cached: {employee_name}",
                    flush=True
                )

            except Exception as e:

                print(
                    f"❌ CACHE ERROR: "
                    f"{employee_name}: {e}",
                    flush=True
                )

    print(
        f"🎯 KIOSK CACHE READY: "
        f"{len(kiosk_face_cache)} face embeddings",
        flush=True
    )


# Load employee face embeddings when backend starts
load_kiosk_face_cache()


@app.get("/")
def home():
    return {"message": "Face Recognition API is running"}


# 🔥 UPLOAD FACE
@app.post("/upload-face")
async def upload_face(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    full_name: str = Form(...)
):
    try:
        contents = await file.read()

        safe_name = normalize_name(full_name)
        file_name = f"employees/{safe_name}/face_{int(time.time() * 1000)}.jpg"

        supabase.storage.from_("faces").upload(
            file_name,
            contents,
            {"content-type": "image/jpeg", "upsert": "true"}
        )

        public_url = supabase.storage.from_("faces").get_public_url(file_name)

        return {
            "status": "Uploaded",
            "file": file_name,
            "url": public_url
        }

    except Exception as e:
        return {"status": "Error", "message": str(e)}


# 🔥 VERIFY FACE
@app.post("/verify-face")
async def verify_face(
    files: List[UploadFile] = File(...),
    user_id: str = Form(...),
    full_name: str = Form(...)
):
    print("🔥 VERIFY STARTED", flush=True)

    try:
        frames = []

        # =========================
        # LOAD FRAMES (FASTER)
        # =========================
        for file in files[:6]:  # 🔥 only use first 5 frames
            contents = await file.read()

            npimg = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

            if img is None:
                continue

            # 🔥 smaller image = faster
            img = cv2.resize(img, (320, 240))

            frames.append(img)

        if len(frames) < 2:
            return {"status": "Error", "message": "Not enough frames"}

        print("📸 Frames:", len(frames), flush=True)

        # =========================
        # 🔥 BLINK DETECTION
        # =========================
        ear_values = []

        for img in frames:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            result = face_mesh.process(rgb)

            if result.multi_face_landmarks:
                landmarks = result.multi_face_landmarks[0].landmark
                h, w, _ = img.shape

                points = [(int(l.x * w), int(l.y * h)) for l in landmarks]

                left_eye = [33, 160, 158, 133, 153, 144]

                ear = eye_aspect_ratio(points, left_eye)
                ear_values.append(ear)

        if len(ear_values) < 2:
            return {"status": "Fake", "message": "Face not detected properly"}

        closed = any(e < 0.18 for e in ear_values)
        open_eye = any(e > 0.22 for e in ear_values)

        if not (closed and open_eye):
            return {"status": "Fake", "message": "No real blink detected"}

        print("👁️ Blink detected", flush=True)

        # =========================
        # FACE DETECTION
        # =========================
        valid_frames = []

        for img in frames:
            try:
                faces = DeepFace.extract_faces(
                    img_path=img,
                    detector_backend="opencv",
                    enforce_detection=True
                )

                if faces:
                    valid_frames.append(img)

            except:
                pass

        if len(valid_frames) < 1:
            return {"status": "No Face"}

        # =========================
        # LOAD STORED FACES
        # =========================
        safe_name = normalize_name(full_name)
        folder_path = f"employees/{safe_name}"

        files_list = supabase.storage.from_("faces").list(folder_path) or []

        print("📁 USER FOLDER:", folder_path, flush=True)

        if not files_list:
            return {"status": "Error", "message": "No registered faces"}

        best_distance = 1.0
        matched = False

        # =========================
        # MATCH (OPTIMIZED)
        # =========================
        for f in files_list:

            file_path = f"{folder_path}/{f['name']}"

            url = f"{SUPABASE_URL}/storage/v1/object/public/faces/{file_path}"

            response = requests.get(url)

            if response.status_code != 200:
                continue

            stored_img = cv2.imdecode(
                np.asarray(bytearray(response.content), dtype=np.uint8),
                cv2.IMREAD_COLOR
            )

            if stored_img is None:
                continue

            # 🔥 smaller image = faster
            stored_img = cv2.resize(stored_img, (112, 112))

            for img in valid_frames:

                img_resized = cv2.resize(img, (112, 112))

                try:
                    result = DeepFace.verify(
                        img1_path=img_resized,
                        img2_path=stored_img,
                        model_name="ArcFace",
                        detector_backend="opencv",
                        enforce_detection=True
                    )

                    distance = result.get("distance", 1)

                    print("📏 Distance:", distance, flush=True)

                    if distance < best_distance:
                        best_distance = distance

                    # 🔥 EARLY STOP FOR SPEED
                    if distance < 0.30:
                        matched = True
                        break

                except Exception as e:
                    print("VERIFY ERROR:", str(e), flush=True)

            if matched:
                break

        print("🔥 BEST DISTANCE:", best_distance, flush=True)

        # =========================
        # FINAL DECISION
        # =========================
        if matched or best_distance < 0.35:
            return {"status": "Match"}
        else:
            return {"status": "No Match"}

    except Exception as e:
        print("❌ ERROR:", str(e), flush=True)
        return {"status": "Error", "message": str(e)}


    # ============================================================
# KIOSK FACE IDENTIFICATION
# ============================================================
# ============================================================
# KIOSK ATTENDANCE RECORDING
# ============================================================

def parse_shift_time(value):
    if not value:
        return None

    if isinstance(value, str):
        return datetime.strptime(value[:8], "%H:%M:%S").time()

    return value


async def record_kiosk_attendance(employee, action):
    try:
        employee_id = employee["id"]
        shift_id = employee.get("shift_id")

        action = action.strip().upper()

        now = datetime.now()
        today = now.date()
        yesterday = today - timedelta(days=1)

        print(
            "🕒 ATTENDANCE:",
            action,
            employee["full_name"],
            "DATE:",
            today,
            flush=True
        )

        # =====================================================
        # GET EMPLOYEE SHIFT
        # =====================================================

        scheduled_time_in = None
        scheduled_time_out = None

        if shift_id:
            shift_result = (
                supabase
                .table("branch_shifts")
                .select("time_in,time_out")
                .eq("id", shift_id)
                .limit(1)
                .execute()
            )

            shift_records = shift_result.data or []

            if shift_records:
                scheduled_time_in = shift_records[0].get("time_in")
                scheduled_time_out = shift_records[0].get("time_out")

        # =====================================================
        # TIME IN
        # =====================================================

        if action == "TIME IN":

            # Check if employee already has ANY attendance record today
            existing_result = (
                supabase
                .table("attendance_logs")
                .select("*")
                .eq("employee_id", employee_id)
                .eq("log_date", str(today))
                .order("time_in", desc=True)
                .limit(1)
                .execute()
            )

            existing_records = existing_result.data or []

            if existing_records:
                existing_record = existing_records[0]

                # Already completed Time In + Time Out
                if existing_record.get("time_out"):
                    return {
                        "status": "Already Recorded",
                        "message": "Attendance has already been completed for today.",
                        "attendance": existing_record
                    }

                # Time In exists but Time Out has not been recorded
                return {
                    "status": "Already In",
                    "message": "Employee has already timed in today.",
                    "attendance": existing_record
                }
                    # =================================================
            # CALCULATE LATE MINUTES
            # =================================================

            late_minutes = 0

            scheduled_in_time = parse_shift_time(
                scheduled_time_in
            )

            if scheduled_in_time:

                scheduled_in_datetime = datetime.combine(
                    today,
                    scheduled_in_time
                )

                grace_datetime = (
                    scheduled_in_datetime
                    + timedelta(minutes=10)
                )

                if now > grace_datetime:
                    late_minutes = int(
                        (
                            now - scheduled_in_datetime
                        ).total_seconds() / 60
                    )

            # =================================================
            # CREATE ATTENDANCE RECORD
            # =================================================

            attendance_data = {
                "employee_id": employee_id,
                "log_date": str(today),
                "attendance_date": str(today),
                "time_in": now.isoformat(),
                "status": (
                    "Late"
                    if late_minutes > 0
                    else "Present"
                ),
                "source": "kiosk",
                "scheduled_time_in": scheduled_time_in,
                "scheduled_time_out": scheduled_time_out,
                "late_minutes": late_minutes,
                "overtime_minutes": 0
            }

            inserted_result = (
                supabase
                .table("attendance_logs")
                .insert(attendance_data)
                .execute()
            )

            inserted_records = inserted_result.data or []

            print(
                "✅ TIME IN INSERT:",
                inserted_records,
                flush=True
            )

            if not inserted_records:
                return {
                    "status": "Error",
                    "message": "Unable to create attendance record."
                }

            return {
                "status": "Time In Recorded",
                "message": (
                    "Time In recorded successfully."
                    if late_minutes == 0
                    else (
                        f"Time In recorded. "
                        f"Employee is {late_minutes} minutes late."
                    )
                ),
                "attendance": inserted_records[0]
            }

        # =====================================================
        # TIME OUT
        # =====================================================

        if action == "TIME OUT":

            # -------------------------------------------------
            # FIRST: FIND TODAY'S OPEN ATTENDANCE RECORD
            # -------------------------------------------------

            existing_result = (
                supabase
                .table("attendance_logs")
                .select("*")
                .eq("employee_id", employee_id)
                .eq("log_date", str(today))
                .is_("time_out", None)
                .order("time_in", desc=True)
                .limit(1)
                .execute()
            )

            existing_records = existing_result.data or []

            existing_record = (
                existing_records[0]
                if existing_records
                else None
            )

            print(
                "🔎 TODAY OPEN RECORD:",
                existing_record,
                flush=True
            )

            # -------------------------------------------------
            # SECOND: IF NONE, CHECK YESTERDAY
            # FOR OVERNIGHT/CLOSING SHIFTS
            # -------------------------------------------------

            if existing_record is None:

                yesterday_result = (
                    supabase
                    .table("attendance_logs")
                    .select("*")
                    .eq("employee_id", employee_id)
                    .eq("log_date", str(yesterday))
                    .is_("time_out", None)
                    .order("time_in", desc=True)
                    .limit(1)
                    .execute()
                )

                yesterday_records = (
                    yesterday_result.data or []
                )

                if yesterday_records:
                    existing_record = yesterday_records[0]

                    print(
                        "🌙 USING YESTERDAY'S OPEN RECORD:",
                        existing_record,
                        flush=True
                    )

            # -------------------------------------------------
            # NO OPEN TIME IN FOUND
            # -------------------------------------------------

            if existing_record is None:
                return {
                    "status": "No Time In",
                    "message": (
                        "No open Time In record was found."
                    )
                }

            # -------------------------------------------------
            # SAFETY CHECK
            # -------------------------------------------------

            if existing_record.get("time_out"):
                return {
                    "status": "Already Out",
                    "message": (
                        "Employee has already timed out."
                    ),
                    "attendance": existing_record
                }

            # =================================================
            # CALCULATE OVERTIME
            # =================================================

            overtime_minutes = 0

            scheduled_in_time = parse_shift_time(
                existing_record.get(
                    "scheduled_time_in"
                )
            )

            scheduled_out_time = parse_shift_time(
                existing_record.get(
                    "scheduled_time_out"
                )
            )

            if scheduled_out_time:

                record_date = (
                    datetime.strptime(
                        str(existing_record["log_date"]),
                        "%Y-%m-%d"
                    ).date()
                )

                scheduled_out_datetime = datetime.combine(
                    record_date,
                    scheduled_out_time
                )

                # ---------------------------------------------
                # OVERNIGHT SHIFT
                # ---------------------------------------------

                if (
                    scheduled_in_time
                    and scheduled_out_time <= scheduled_in_time
                ):
                    scheduled_out_datetime += timedelta(
                        days=1
                    )

                if now > scheduled_out_datetime:

                    overtime_minutes = int(
                        (
                            now - scheduled_out_datetime
                        ).total_seconds() / 60
                    )

            # =================================================
            # UPDATE THE EXACT ATTENDANCE ROW
            # =================================================

            attendance_id = existing_record["id"]

            print(
                "🎯 UPDATING ATTENDANCE ID:",
                attendance_id,
                flush=True
            )

            updated_result = (
                supabase
                .table("attendance_logs")
                .update({
                    "time_out": now.isoformat(),
                    "overtime_minutes": overtime_minutes,
                    "updated_at": now.isoformat(),
                    "source": "kiosk"
                })
                .eq("id", attendance_id)
                .execute()
            )

            print(
                "✅ TIME OUT UPDATE REQUEST SENT:",
                updated_result,
                flush=True
            )

            # Verify that the Time Out was actually saved
            verify_result = (
                supabase
                .table("attendance_logs")
                .select("*")
                .eq("id", attendance_id)
                .limit(1)
                .execute()
            )

            verified_records = verify_result.data or []

            print(
                "🔍 VERIFIED TIME OUT RECORD:",
                verified_records,
                flush=True
            )

            if not verified_records:
                return {
                    "status": "Error",
                    "message": "Unable to verify Time Out record."
                }

            verified_record = verified_records[0]

            if not verified_record.get("time_out"):
                return {
                    "status": "Error",
                    "message": "Time Out was not saved."
                }

            return {
                "status": "Time Out Recorded",
                "message": (
                    "Time Out recorded successfully."
                    if overtime_minutes == 0
                    else (
                        f"Time Out recorded. "
                        f"{overtime_minutes} minutes overtime."
                    )
                ),
                "attendance": verified_record
            }
                            
            return {
                "status": "Time Out Recorded",
                "message": (
                    "Time Out recorded successfully."
                    if overtime_minutes == 0
                    else (
                        f"Time Out recorded. "
                        f"{overtime_minutes} "
                        f"minutes overtime."
                    )
                ),
                "attendance": updated_records[0]
            }

        # =====================================================
        # INVALID ACTION
        # =====================================================

        return {
            "status": "Error",
            "message": "Invalid attendance action."
        }

    except Exception as e:

        print(
            "❌ KIOSK ATTENDANCE ERROR:",
            str(e),
            flush=True
        )

        return {
            "status": "Error",
            "message": str(e)
        }
@app.post("/kiosk-verify")
async def kiosk_verify(
    files: List[UploadFile] = File(...),
    action: str = Form(...)
):
    print("🔥 KIOSK VERIFY STARTED", flush=True)

    try:
        # =====================================================
        # LOAD FRAMES
        # =====================================================

        frames = []

        for file in files[:6]:
            contents = await file.read()

            npimg = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

            if img is None:
                continue

            # Keep the same optimized size used by
            # the existing employee verification system.
            img = cv2.resize(img, (320, 240))

            frames.append(img)

        if len(frames) < 2:
            return {
                "status": "Error",
                "message": "Not enough frames"
            }

        print(
            "📸 KIOSK FRAMES:",
            len(frames),
            flush=True
        )

        # =====================================================
        # BLINK DETECTION
        # =====================================================

        ear_values = []

        for img in frames:

            rgb = cv2.cvtColor(
                img,
                cv2.COLOR_BGR2RGB
            )

            result = face_mesh.process(rgb)

            if result.multi_face_landmarks:

                landmarks = (
                    result.multi_face_landmarks[0].landmark
                )

                h, w, _ = img.shape

                points = [
                    (
                        int(l.x * w),
                        int(l.y * h)
                    )
                    for l in landmarks
                ]

                left_eye = [
                    33,
                    160,
                    158,
                    133,
                    153,
                    144
                ]

                ear = eye_aspect_ratio(
                    points,
                    left_eye
                )

                ear_values.append(ear)

        if len(ear_values) < 2:
            return {
                "status": "Fake",
                "message": "Face not detected properly"
            }

        closed = any(
            e < 0.18
            for e in ear_values
        )

        open_eye = any(
            e > 0.22
            for e in ear_values
        )

        if not (closed and open_eye):
            return {
                "status": "Fake",
                "message": "No real blink detected"
            }

        print(
            "👁️ KIOSK BLINK DETECTED",
            flush=True
        )

        # =====================================================
        # FACE DETECTION
        # =====================================================

        valid_frames = []

        for img in frames:

            try:

                faces = DeepFace.extract_faces(
                    img_path=img,
                    detector_backend="opencv",
                    enforce_detection=True
                )

                if faces:
                    valid_frames.append(img)

            except Exception:
                pass

        if len(valid_frames) < 1:
            return {
                "status": "No Face"
            }

        print(
            "👤 VALID KIOSK FRAMES:",
            len(valid_frames),
            flush=True
        )

        # =====================================================
        # 🚀 FAST KIOSK IDENTIFICATION
        # =====================================================

        if not kiosk_face_cache:
            return {
                "status": "Error",
                "message": "Kiosk face database is empty."
            }


        # =====================================================
        # CREATE ONE EMBEDDING FROM THE CAPTURED FACE
        # =====================================================

        img = valid_frames[-1]

        img_resized = cv2.resize(
            img,
            (112, 112)
        )

        try:

            print(
                "⚡ Creating kiosk face embedding...",
                flush=True
            )

            captured_result = DeepFace.represent(
                img_path=img_resized,
                model_name="ArcFace",
                detector_backend="skip",
                enforce_detection=False
            )

            if not captured_result:
                return {
                    "status": "No Face",
                    "message": "Unable to create face embedding."
                }

            captured_embedding = (
                captured_result[0]["embedding"]
            )

        except Exception as e:

            print(
                "❌ EMBEDDING ERROR:",
                str(e),
                flush=True
            )

            return {
                "status": "Error",
                "message": "Unable to process face."
            }


        # =====================================================
        # COMPARE AGAINST CACHED EMPLOYEE EMBEDDINGS
        # =====================================================

        best_distance = 1.0
        best_employee = None

        for cached_face in kiosk_face_cache:

            employee = cached_face["employee"]

            stored_embedding = (
                cached_face["embedding"]
            )

            distance = cosine_distance(
                captured_embedding,
                stored_embedding
            )

            employee_name = (
                employee.get("full_name") or ""
            )

            print(
                f"📏 {employee_name}: {distance}",
                flush=True
            )

            if distance < best_distance:

                best_distance = distance
                best_employee = employee

            # Very strong ArcFace match
            if distance < 0.30:

                print(
                    f"🎯 STRONG MATCH: {employee_name}",
                    flush=True
                )

                break


        # =====================================================
        # FINAL DECISION
        # =====================================================

        print(
            "🔥 KIOSK BEST DISTANCE:",
            best_distance,
            flush=True
        )

        if (
            best_employee is not None
            and best_distance < 0.35
        ):

            print(
                "✅ KIOSK MATCH:",
                best_employee["full_name"],
                flush=True
            )

            employee_result = {
                "id": best_employee["id"],
                "full_name": best_employee["full_name"],
                "branch_id": best_employee["branch_id"],
                "shift_id": best_employee["shift_id"]
            }


            # =================================================
            # RECORD ATTENDANCE
            # =================================================

            attendance_result = await record_kiosk_attendance(
                employee_result,
                action
            )

            return {
                "status": "Match",
                "employee": employee_result,
                "distance": best_distance,
                "attendance": attendance_result
            }


        print(
            "❌ KIOSK NO MATCH",
            flush=True
        )

        return {
            "status": "No Match"
        }
    except Exception as e:

        print(
            "❌ KIOSK ERROR:",
            str(e),
            flush=True
        )

        return {
            "status": "Error",
            "message": str(e)
        }