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
from zoneinfo import ZoneInfo

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

    MAINTENANCE_ROLE_ID = (
        "b381a7a0-9595-4c69-abf1-5c15a827647a"
    )

    employees_response = (
        supabase
        .from_("employee_profiles")
        .select(
            "id, full_name, branch_id, shift_id, role_id"
        )
        .in_(
            "role_id",
            [
                EMPLOYEE_ROLE_ID,
                MAINTENANCE_ROLE_ID
            ]
        )
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

                # Create ArcFace embedding directly from stored image
                # Detect and extract the actual face first
                detected_faces = DeepFace.extract_faces(
                    img_path=stored_img,
                    detector_backend="opencv",
                    enforce_detection=False,
                    align=True
                )

                if not detected_faces:
                    print(
                        f"❌ NO FACE DETECTED: "
                        f"{employee_name} | "
                        f"FILE: {stored_file['name']}",
                        flush=True
                    )
                    continue

                print(
                    f"🔍 FACE DETECTED: "
                    f"{employee_name} | "
                    f"FILE: {stored_file['name']} | "
                    f"CONFIDENCE: {detected_faces[0].get('confidence')} | "
                    f"AREA: {detected_faces[0].get('facial_area')}",
                    flush=True
                )

                # Get the face crop
                face_crop = detected_faces[0]["face"]

                # Convert normalized image to uint8
                face_crop = np.asarray(
                    face_crop * 255,
                    dtype=np.uint8
                )

                # Convert RGB to BGR
                face_crop = cv2.cvtColor(
                    face_crop,
                    cv2.COLOR_RGB2BGR
                )

                # Create ArcFace embedding from the face crop
                embedding_result = DeepFace.represent(
                    img_path=face_crop,
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
                    f"{employee_name} | FILE: {stored_file['name']} | ERROR: {e}",
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
# ============================================================
# 🔥 LIVE REGISTRATION FACE VALIDATION
# ============================================================

@app.post("/validate-face")
async def validate_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        npimg = np.frombuffer(contents, np.uint8)

        img = cv2.imdecode(
            npimg,
            cv2.IMREAD_COLOR
        )

        if img is None:
            return {
                "valid": False,
                "message": "Unable to read camera frame."
            }

        # ---------------------------------------------
        # RESIZE FOR FAST LIVE DETECTION
        # ---------------------------------------------

        img = cv2.resize(img, (320, 240))

        gray = cv2.cvtColor(
            img,
            cv2.COLOR_BGR2GRAY
        )

        # ---------------------------------------------
        # LOAD OPENCV FRONTAL FACE DETECTOR
        # ---------------------------------------------

        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades +
            "haarcascade_frontalface_default.xml"
        )

        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60)
        )

        # ---------------------------------------------
        # NO FACE
        # ---------------------------------------------

        if len(faces) == 0:
            return {
                "valid": False,
                "message": "No face detected.",
                "box": None
            }

        # ---------------------------------------------
        # MORE THAN ONE FACE
        # ---------------------------------------------

        if len(faces) > 1:
            return {
                "valid": False,
                "message": "Multiple faces detected. Only one person should be in the camera.",
                "box": None
            }

        # ---------------------------------------------
        # GET FACE BOX
        # ---------------------------------------------

        x, y, w, h = faces[0]

        frame_h, frame_w = gray.shape

        # ---------------------------------------------
        # FACE SIZE CHECK
        # ---------------------------------------------

        face_area = w * h
        frame_area = frame_w * frame_h

        face_ratio = face_area / frame_area

        if face_ratio < 0.08:
            return {
                "valid": False,
                "message": "Move closer to the camera.",
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h)
                }
            }

        if face_ratio > 0.70:
            return {
                "valid": False,
                "message": "Move slightly farther from the camera.",
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h)
                }
            }

        # ---------------------------------------------
        # FACE CENTER CHECK
        # ---------------------------------------------

        face_center_x = x + (w / 2)
        face_center_y = y + (h / 2)

        frame_center_x = frame_w / 2
        frame_center_y = frame_h / 2

        horizontal_offset = abs(
            face_center_x - frame_center_x
        ) / frame_w

        vertical_offset = abs(
            face_center_y - frame_center_y
        ) / frame_h

        if horizontal_offset > 0.25:
            return {
                "valid": False,
                "message": "Move your face to the center.",
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h)
                }
            }

        if vertical_offset > 0.25:
            return {
                "valid": False,
                "message": "Move your face to the center.",
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h)
                }
            }

        # ---------------------------------------------
        # BRIGHTNESS CHECK
        # ---------------------------------------------

        brightness = float(np.mean(gray))

        if brightness < 45:
            return {
                "valid": False,
                "message": "Lighting is too dark.",
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h)
                }
            }

        if brightness > 235:
            return {
                "valid": False,
                "message": "Lighting is too bright.",
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h)
                }
            }

        # ---------------------------------------------
        # FACE IS GOOD
        # ---------------------------------------------

        print(
            "🟢 LIVE REGISTRATION FACE READY",
            f"BOX=({x},{y},{w},{h})",
            flush=True
        )

        return {
            "valid": True,
            "message": "Face detected. Ready to capture.",
            "box": {
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h)
            }
        }

    except Exception as e:

        print(
            "❌ LIVE FACE VALIDATION ERROR:",
            str(e),
            flush=True
        )

        return {
            "valid": False,
            "message": "Unable to validate face."
        }
        
# 🔥 VERIFY FACE
@app.post("/verify-face")
async def verify_face(
    files: List[UploadFile] = File(...),
    user_id: str = Form(...),
    full_name: str = Form(...)
):
    print("🔥 VERIFY STARTED", flush=True)

    try:
        # =====================================================
        # LOAD CAPTURED FRAMES
        # =====================================================

        frames = []

        for file in files[:8]:
            contents = await file.read()

            npimg = np.frombuffer(
                contents,
                np.uint8
            )

            img = cv2.imdecode(
                npimg,
                cv2.IMREAD_COLOR
            )

            if img is None:
                continue

            # Smaller image = faster processing
            img = cv2.resize(
                img,
                (320, 240)
            )

            frames.append(img)

        if len(frames) < 2:
            return {
                "status": "Error",
                "message": "Not enough frames"
            }

        print(
            "📸 WEB FRAMES:",
            len(frames),
            flush=True
        )

        # =====================================================
        # BLINK / LIVENESS DETECTION
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

        # Make sure MediaPipe detected the face
        if len(ear_values) < 2:

            return {
                "status": "Fake",
                "message": "Face not detected properly"
            }

        # Show the actual EAR values
        print(
            "👁️ EAR VALUES:",
            [round(e, 3) for e in ear_values],
            flush=True
        )

                # =====================================================
        # REAL BLINK / LIVENESS DETECTION
        # OPEN → CLOSED → OPEN
        # =====================================================

        OPEN_THRESHOLD = 0.23
        CLOSED_THRESHOLD = 0.22

        blink_detected = False
        open_before = False
        closed_during = False

        for ear in ear_values:

            # Step 1: Eyes must start open
            if not open_before:
                if ear > OPEN_THRESHOLD:
                    open_before = True

            # Step 2: Eyes must close
            elif not closed_during:
                if ear < CLOSED_THRESHOLD:
                    closed_during = True

            # Step 3: Eyes must open again
            else:
                if ear > OPEN_THRESHOLD:
                    blink_detected = True
                    break

        print(
            "👁️ BLINK CHECK:",
            f"OPEN_BEFORE={open_before}",
            f"CLOSED={closed_during}",
            f"OPEN_AFTER={blink_detected}",
            flush=True
        )

        if not blink_detected:

            return {
                "status": "Fake",
                "message": "Please blink once naturally during scanning."
            }

        print(
            "👁️ WEB BLINK DETECTED",
            flush=True
        )

        # =====================================================
        # FACE DETECTION
        # =====================================================

        valid_frames = []
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
                "status": "No Face",
                "message": "No face detected."
            }

        print(
            "👤 VALID WEB FRAMES:",
            len(valid_frames),
            flush=True
        )

        # =====================================================
        # FIND THIS EMPLOYEE IN THE CACHE
        # =====================================================
        employee_cache = kiosk_face_cache.copy()

        print(
            "👤 WEB CACHED FACES:",
            len(employee_cache),
            flush=True
        )

        if not employee_cache:
            return {
                "status": "Error",
                "message": "No cached faces available."
            }

        if not employee_cache:
            return {
                "status": "Error",
                "message": (
                    "No cached face found for this employee. "
                    "Please restart the FastAPI server "
                    "after registering the employee face."
                )
            }

        # =====================================================
        # CREATE ONE ARCFACE EMBEDDING
        # =====================================================

        img = valid_frames[-1]

        print(
            "⚡ Creating web face embedding...",
            flush=True
        )

        try:

            # Detect and extract the actual face first
            detected_faces = DeepFace.extract_faces(
                img_path=img,
                detector_backend="opencv",
                enforce_detection=True,
                align=True
            )

            if not detected_faces:
                return {
                    "status": "No Face",
                    "message": "Unable to detect face for recognition."
                }

            # Use the detected face crop
            face_crop = detected_faces[0]["face"]

            # Convert DeepFace face image to uint8 BGR
            face_crop = np.asarray(face_crop * 255, dtype=np.uint8)

            face_crop = cv2.cvtColor(
                face_crop,
                cv2.COLOR_RGB2BGR
            )

            # Create ArcFace embedding from the actual face crop
            captured_result = DeepFace.represent(
                img_path=face_crop,
                model_name="ArcFace",
                detector_backend="skip",
                enforce_detection=False
            )

            if not captured_result:
                return {
                    "status": "No Face",
                    "message": "Unable to create face embedding."
                }

            captured_embedding = captured_result[0]["embedding"]

            print(
                "✅ Web ArcFace embedding created",
                flush=True
            )

        except Exception as e:

            print(
                "❌ WEB EMBEDDING ERROR:",
                str(e),
                flush=True
            )

            return {
                "status": "Error",
                "message": "Unable to process face for recognition."
            }
        # =====================================================
        # COMPARE AGAINST EMPLOYEE'S CACHED EMBEDDINGS
        # USE ALL REGISTERED FACE IMAGES PER EMPLOYEE
        # =====================================================

        employee_distances = {}

        for cached_face in employee_cache:

            employee = cached_face["employee"]

            stored_embedding = (
                cached_face["embedding"]
            )

            distance = cosine_distance(
                captured_embedding,
                stored_embedding
            )

            employee_id = str(employee.get("id"))
            employee_name = employee.get("full_name")

            print(
                f"📏 WEB DISTANCE "
                f"{employee_name}: "
                f"{distance}",
                flush=True
            )

            if employee_id not in employee_distances:
                employee_distances[employee_id] = {
                    "employee": employee,
                    "distances": []
                }

            employee_distances[employee_id]["distances"].append(
                distance
            )


        # =====================================================
        # CALCULATE MEDIAN DISTANCE PER EMPLOYEE
        # =====================================================

        best_distance = 1.0
        best_employee = None

        for employee_id, data in employee_distances.items():

            distances = data["distances"]
            employee = data["employee"]

            median_distance = float(
                np.median(distances)
            )

            print(
                f"📊 WEB MEDIAN "
                f"{employee.get('full_name')}: "
                f"{median_distance} "
                f"FROM {len(distances)} FACE(S)",
                flush=True
            )

            if median_distance < best_distance:

                best_distance = median_distance
                best_employee = employee


        print(
            "🏆 WEB BEST EMPLOYEE:",
            best_employee.get("full_name")
            if best_employee
            else None,
            flush=True
        )

        print(
            "🔥 WEB BEST MEDIAN DISTANCE:",
            best_distance,
            flush=True
        )


        # =====================================================
        # FINAL DECISION WITH CONFIDENCE MARGIN
        # =====================================================

        requested_id = str(user_id)

        # Sort all employees by their median distance
        ranked_employees = sorted(
            employee_distances.values(),
            key=lambda item: float(np.median(item["distances"]))
        )

        best_employee = (
            ranked_employees[0]["employee"]
            if len(ranked_employees) >= 1
            else None
        )

        best_distance = (
            float(np.median(ranked_employees[0]["distances"]))
            if len(ranked_employees) >= 1
            else 1.0
        )

        second_distance = (
            float(np.median(ranked_employees[1]["distances"]))
            if len(ranked_employees) >= 2
            else 1.0
        )

        # Difference between the best and second-best employee
        margin = second_distance - best_distance

        print(
            "🏆 WEB BEST EMPLOYEE:",
            best_employee.get("full_name")
            if best_employee
            else None,
            flush=True
        )

        print(
            "🔥 WEB BEST DISTANCE:",
            best_distance,
            flush=True
        )

        print(
            "🥈 WEB SECOND-BEST DISTANCE:",
            second_distance,
            flush=True
        )

        print(
            "📐 WEB CONFIDENCE MARGIN:",
            margin,
            flush=True
        )


        # =====================================================
        # REQUIRE A CLEAR DIFFERENCE BETWEEN EMPLOYEES
        # =====================================================

        MIN_MARGIN = 0.05

        if (
            best_employee is not None
            and best_distance < 0.35
            and margin >= MIN_MARGIN
        ):

            matched_id = str(best_employee.get("id"))

            # =================================================
            # CORRECT LOGGED-IN EMPLOYEE
            # =================================================

            if matched_id == requested_id:

                print(
                    "✅ WEB FACE MATCH:",
                    best_employee["full_name"],
                    flush=True
                )

                return {
                    "status": "Match",
                    "distance": best_distance,
                    "employee": {
                        "id": best_employee["id"],
                        "full_name": best_employee["full_name"],
                        "branch_id": best_employee["branch_id"],
                        "shift_id": best_employee["shift_id"]
                    }
                }

            # =================================================
            # FACE BELONGS TO ANOTHER EMPLOYEE
            # =================================================

            print(
                "🚨 WRONG EMPLOYEE:",
                best_employee["full_name"],
                "LOGGED-IN:",
                full_name,
                flush=True
            )

            return {
                "status": "No Match",
                "message": "Face does not belong to the logged-in employee."
            }


        # =====================================================
        # FACE MATCH IS TOO CLOSE / UNCERTAIN
        # =====================================================

        if (
            best_employee is not None
            and best_distance < 0.35
            and margin < MIN_MARGIN
        ):

            print(
                "⚠️ UNCERTAIN FACE MATCH:",
                best_employee["full_name"],
                "MARGIN:",
                margin,
                flush=True
            )

            return {
                "status": "No Match",
                "message": "Face recognition was not confident enough. Please try again."
            }


        # =====================================================
        # NO MATCH
        # =====================================================

        print(
            "❌ WEB FACE NO MATCH",
            flush=True
        )

        return {
            "status": "No Match",
            "distance": best_distance
        }

    except Exception as e:

        print(
            "❌ WEB VERIFY ERROR:",
            str(e),
            flush=True
        )

        return {
            "status": "Error",
            "message": str(e)
        }

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


async def record_kiosk_attendance(employee, action, face_url=None):
    try:
        employee_id = employee["id"]
        shift_id = employee.get("shift_id")

        action = action.strip().upper()

        MANILA_TZ = ZoneInfo("Asia/Manila")

        now = datetime.now(MANILA_TZ)
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
                    scheduled_in_time,
                    tzinfo=MANILA_TZ
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

            # Save the kiosk face photo URL
            if face_url:
                attendance_data["time_in_face_url"] = face_url

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
                    scheduled_out_time,
                    tzinfo=MANILA_TZ
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

            update_data = {
                "time_out": now.isoformat(),
                "overtime_minutes": overtime_minutes,
                "updated_at": now.isoformat(),
                "source": "kiosk"
            }

            # Save the kiosk Time Out face photo URL
            if face_url:
                update_data["time_out_face_url"] = face_url

            updated_result = (
                supabase
                .table("attendance_logs")
                .update(update_data)
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

            print(
    "👁️ EAR VALUES:",
    [round(e, 3) for e in ear_values],
    flush=True
)

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

        try:

            print(
                "⚡ Creating kiosk face embedding...",
                flush=True
            )

            # Detect and extract the actual face first
            detected_faces = DeepFace.extract_faces(
                img_path=img,
                detector_backend="opencv",
                enforce_detection=True,
                align=True
            )

            if not detected_faces:
                return {
                    "status": "No Face",
                    "message": "Unable to detect face for recognition."
                }

            # Get the detected face crop
            face_crop = detected_faces[0]["face"]

            # Convert normalized face image to uint8
            face_crop = np.asarray(
                face_crop * 255,
                dtype=np.uint8
            )

            # Convert RGB to BGR
            face_crop = cv2.cvtColor(
                face_crop,
                cv2.COLOR_RGB2BGR
            )

            # Create ArcFace embedding from the face crop
            captured_result = DeepFace.represent(
                img_path=face_crop,
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

# =====================================================
# COMPARE AGAINST CACHED EMPLOYEE EMBEDDINGS
# USE ALL REGISTERED FACE IMAGES PER EMPLOYEE
# =====================================================

        employee_distances = {}

        for cached_face in kiosk_face_cache:

            employee = cached_face["employee"]

            stored_embedding = (
                cached_face["embedding"]
            )

            distance = cosine_distance(
                captured_embedding,
                stored_embedding
            )

            employee_id = str(employee.get("id"))
            employee_name = (
                employee.get("full_name") or ""
            )

            print(
                f"📏 {employee_name}: {distance}",
                flush=True
            )

            if employee_id not in employee_distances:
                employee_distances[employee_id] = {
                    "employee": employee,
                    "distances": []
                }

            employee_distances[employee_id]["distances"].append(
                distance
            )


# =====================================================
# CALCULATE MEDIAN DISTANCE PER EMPLOYEE
# =====================================================

        best_distance = 1.0
        best_employee = None

        for employee_id, data in employee_distances.items():

            distances = data["distances"]
            employee = data["employee"]

            median_distance = float(
                np.median(distances)
            )

            print(
                f"📊 KIOSK MEDIAN "
                f"{employee.get('full_name')}: "
                f"{median_distance} "
                f"FROM {len(distances)} FACE(S)",
                flush=True
            )

            if median_distance < best_distance:

                best_distance = median_distance
                best_employee = employee


        print(
            "🏆 KIOSK BEST EMPLOYEE:",
            best_employee.get("full_name")
            if best_employee
            else None,
            flush=True
        )

        print(
            "🔥 KIOSK BEST MEDIAN DISTANCE:",
            best_distance,
            flush=True
        )
        # =====================================================
        # FINAL DECISION
        # =====================================================

# =====================================================
# FINAL DECISION WITH CONFIDENCE MARGIN
# =====================================================

        ranked_employees = sorted(
            employee_distances.values(),
            key=lambda item: float(np.median(item["distances"]))
        )

        best_employee = (
            ranked_employees[0]["employee"]
            if len(ranked_employees) >= 1
            else None
        )

        best_distance = (
            float(np.median(ranked_employees[0]["distances"]))
            if len(ranked_employees) >= 1
            else 1.0
        )

        second_distance = (
            float(np.median(ranked_employees[1]["distances"]))
            if len(ranked_employees) >= 2
            else 1.0
        )

        margin = second_distance - best_distance

        print(
            "🏆 KIOSK BEST EMPLOYEE:",
            best_employee.get("full_name")
            if best_employee
            else None,
            flush=True
        )

        print(
            "🔥 KIOSK BEST DISTANCE:",
            best_distance,
            flush=True
        )

        print(
            "🥈 KIOSK SECOND-BEST DISTANCE:",
            second_distance,
            flush=True
        )

        print(
            "📐 KIOSK CONFIDENCE MARGIN:",
            margin,
            flush=True
        )


        # =====================================================
        # REQUIRE A CLEAR DIFFERENCE
        # =====================================================

        MIN_MARGIN = 0.05

        if (
            best_employee is not None
            and best_distance < 0.35
            and margin >= MIN_MARGIN
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
            # 📸 SAVE SUCCESSFUL KIOSK FACE IMAGE
            # =================================================

            face_url = None

            try:

                face_frame = valid_frames[-1]

                success, encoded_image = cv2.imencode(
                    ".jpg",
                    face_frame
                )

                if success:

                    face_bytes = encoded_image.tobytes()

                    safe_name = normalize_name(
                        best_employee["full_name"]
                    )

                    action_folder = action.strip().lower()

                    file_name = (
                        f"attendance/"
                        f"{safe_name}/"
                        f"{action_folder}/"
                        f"{int(time.time() * 1000)}.jpg"
                    )

                    print(
                        "📸 Uploading kiosk attendance photo:",
                        file_name,
                        flush=True
                    )

                    supabase.storage.from_("faces").upload(
                        file_name,
                        face_bytes,
                        {
                            "content-type": "image/jpeg",
                            "upsert": "true"
                        }
                    )

                    face_url = (
                        supabase
                        .storage
                        .from_("faces")
                        .get_public_url(file_name)
                    )

                    print(
                        "✅ KIOSK FACE PHOTO SAVED:",
                        face_url,
                        flush=True
                    )

            except Exception as e:

                print(
                    "⚠️ KIOSK PHOTO UPLOAD FAILED:",
                    str(e),
                    flush=True
                )


            # =================================================
            # RECORD ATTENDANCE
            # =================================================

            attendance_result = await record_kiosk_attendance(
                employee_result,
                action,
                face_url
            )

            return {
                "status": "Match",
                "employee": employee_result,
                "distance": best_distance,
                "attendance": attendance_result
            }


        # =====================================================
        # UNCERTAIN MATCH
        # =====================================================

        if (
            best_employee is not None
            and best_distance < 0.35
            and margin < MIN_MARGIN
        ):

            print(
                "⚠️ KIOSK UNCERTAIN FACE MATCH:",
                best_employee["full_name"],
                "MARGIN:",
                margin,
                flush=True
            )

            return {
                "status": "No Match",
                "message": "Face recognition was not confident enough. Please try again."
            }


        # =====================================================
        # NO MATCH
        # =====================================================

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