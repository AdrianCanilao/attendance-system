import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import cv2
import numpy as np
import requests
from supabase import create_client
from deepface import DeepFace
#from insightface_engine import (
    #insightface_app,
    #get_face_embedding,
    #detect_faces,
    #cosine_distance as insightface_cosine_distance
#)
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
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_KEY")
INSIGHTFACE_URL = os.getenv("INSIGHTFACE_URL", "http://127.0.0.1:8002").rstrip("/")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY environment variables are required.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 🔥 BLINK SETUP
face_mesh = mp_face_mesh.FaceMesh()

# 🔥 PRELOAD ARCFACE MODEL
print("🔥 Loading ArcFace model...", flush=True)
DeepFace.build_model("ArcFace")
print("✅ ArcFace model ready", flush=True)



def recognize_insightface_frame(index, img):
    """Send one frame to InsightFace without changing recognition rules."""
    try:
        success, encoded_image = cv2.imencode(
            ".jpg",
            img,
            [cv2.IMWRITE_JPEG_QUALITY, 85]
        )

        if not success:
            return index, None, "JPEG encoding failed"

        response = requests.post(
            f"{INSIGHTFACE_URL}/recognize-live-face",
            files={
                "file": (
                    f"frame_{index}.jpg",
                    encoded_image.tobytes(),
                    "image/jpeg"
                )
            },
            timeout=15
        )

        if response.status_code != 200:
            return index, None, f"HTTP {response.status_code}"

        return index, response.json(), None

    except Exception as e:
        return index, None, str(e)

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

            file_name = stored_file.get("name")

            if not file_name:
                continue

            file_path = (
                f"{folder_path}/{file_name}"
            )

            url = (
                f"{SUPABASE_URL}"
                f"/storage/v1/object/public/"
                f"faces/{file_path}"
            )

            try:

                # ==================================================
                # DOWNLOAD IMAGE
                # ==================================================

                response = requests.get(
                    url,
                    timeout=5
                )

                if response.status_code != 200:

                    print(
                        f"⚠️ DOWNLOAD FAILED: "
                        f"{employee_name} | "
                        f"FILE: {file_name} | "
                        f"STATUS: {response.status_code}",
                        flush=True
                    )

                    continue

                stored_img = cv2.imdecode(
                    np.asarray(
                        bytearray(response.content),
                        dtype=np.uint8
                    ),
                    cv2.IMREAD_COLOR
                )

                if stored_img is None:

                    print(
                        f"❌ INVALID IMAGE: "
                        f"{employee_name} | "
                        f"FILE: {file_name}",
                        flush=True
                    )

                    continue

                # ==================================================
                # REAL FACE DETECTION
                # ==================================================

                detected_faces = DeepFace.extract_faces(
                    img_path=stored_img,
                    detector_backend="opencv",
                    enforce_detection=True,
                    align=True
                )

                # --------------------------------------------------
                # MUST HAVE EXACTLY ONE FACE
                # --------------------------------------------------

                if len(detected_faces) != 1:

                    print(
                        f"❌ INVALID FACE COUNT: "
                        f"{employee_name} | "
                        f"FILE: {file_name} | "
                        f"FACES: {len(detected_faces)}",
                        flush=True
                    )

                    continue

                detected_face = detected_faces[0]

                confidence = float(
                    detected_face.get(
                        "confidence",
                        0
                    )
                )

                facial_area = (
                    detected_face.get(
                        "facial_area",
                        {}
                    )
                )

                x = int(
                    facial_area.get("x", 0)
                )

                y = int(
                    facial_area.get("y", 0)
                )

                w = int(
                    facial_area.get("w", 0)
                )

                h = int(
                    facial_area.get("h", 0)
                )

                image_height, image_width = (
                    stored_img.shape[:2]
                )

                # ==================================================
                # VALIDATION
                # ==================================================

                # Reject zero/invalid confidence
                if confidence <= 0:

                    print(
                        f"❌ INVALID CONFIDENCE: "
                        f"{employee_name} | "
                        f"FILE: {file_name} | "
                        f"CONFIDENCE: {confidence}",
                        flush=True
                    )

                    continue

                # Reject invalid bounding box
                if w <= 0 or h <= 0:

                    print(
                        f"❌ INVALID FACE AREA: "
                        f"{employee_name} | "
                        f"FILE: {file_name}",
                        flush=True
                    )

                    continue

                # Reject full-image fallback detection
                if (
                    w >= image_width * 0.95
                    and h >= image_height * 0.95
                ):

                    print(
                        f"❌ FULL FRAME DETECTION SKIPPED: "
                        f"{employee_name} | "
                        f"FILE: {file_name} | "
                        f"AREA: {facial_area}",
                        flush=True
                    )

                    continue

                # Reject extremely small faces
                if (
                    w < 40
                    or h < 40
                ):

                    print(
                        f"❌ FACE TOO SMALL: "
                        f"{employee_name} | "
                        f"FILE: {file_name} | "
                        f"AREA: {facial_area}",
                        flush=True
                    )

                    continue

                # ==================================================
                # VALID FACE
                # ==================================================

                print(
                    f"🔍 FACE DETECTED: "
                    f"{employee_name} | "
                    f"FILE: {file_name} | "
                    f"CONFIDENCE: {confidence} | "
                    f"AREA: {facial_area}",
                    flush=True
                )

                # ==================================================
                # EXTRACT ACTUAL FACE
                # ==================================================

                face_crop = detected_face["face"]

                face_crop = np.asarray(
                    face_crop * 255,
                    dtype=np.uint8
                )

                face_crop = cv2.cvtColor(
                    face_crop,
                    cv2.COLOR_RGB2BGR
                )

                # ==================================================
                # CREATE ARCFACE EMBEDDING
                # ==================================================

                embedding_result = DeepFace.represent(
                    img_path=face_crop,
                    model_name="ArcFace",
                    detector_backend="skip",
                    enforce_detection=False
                )

                if not embedding_result:

                    print(
                        f"❌ EMBEDDING FAILED: "
                        f"{employee_name} | "
                        f"FILE: {file_name}",
                        flush=True
                    )

                    continue

                embedding = (
                    embedding_result[0]["embedding"]
                )

                # ==================================================
                # SAVE TO KIOSK CACHE
                # ==================================================

                kiosk_face_cache.append({
                    "employee": employee,
                    "embedding": embedding
                })

                print(
                    f"✅ Cached: "
                    f"{employee_name} | "
                    f"FILE: {file_name}",
                    flush=True
                )

            except Exception as e:

                print(
                    f"❌ CACHE ERROR: "
                    f"{employee_name} | "
                    f"FILE: {file_name} | "
                    f"ERROR: {e}",
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

# ============================================================
# 🔥 LIVE FACE RECOGNITION
# ============================================================

@app.post("/recognize-live-face")
async def recognize_live_face(
    file: UploadFile = File(...)
):
    try:
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
            return {
                "status": "No Face",
                "message": "Unable to read camera frame."
            }

        # Resize for faster processing
        img = cv2.resize(
            img,
            (320, 240)
        )

        # =====================================================
        # DETECT FACE
        # =====================================================

        detected_faces = DeepFace.extract_faces(
            img_path=img,
            detector_backend="opencv",
            enforce_detection=True,
            align=True
        )

        if not detected_faces:
            return {
                "status": "No Face",
                "message": "No face detected."
            }

        # Only use the first detected face
        face_crop = detected_faces[0]["face"]

        face_crop = np.asarray(
            face_crop * 255,
            dtype=np.uint8
        )

        face_crop = cv2.cvtColor(
            face_crop,
            cv2.COLOR_RGB2BGR
        )

        # =====================================================
        # CREATE ARCFACE EMBEDDING
        # =====================================================

        embedding_result = DeepFace.represent(
            img_path=face_crop,
            model_name="ArcFace",
            detector_backend="skip",
            enforce_detection=False
        )

        if not embedding_result:
            return {
                "status": "No Face",
                "message": "Unable to create face embedding."
            }

        captured_embedding = (
            embedding_result[0]["embedding"]
        )

        # =====================================================
        # COMPARE AGAINST REGISTERED EMPLOYEES
        # =====================================================

        if not kiosk_face_cache:
            return {
                "status": "Error",
                "message": "No registered faces available."
            }

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

            employee_id = str(
                employee.get("id")
            )

            employee_name = (
                employee.get("full_name")
            )

            if employee_id not in employee_distances:
                employee_distances[employee_id] = {
                    "employee": employee,
                    "distances": []
                }

            employee_distances[
                employee_id
            ]["distances"].append(distance)

        # =====================================================
        # MEDIAN DISTANCE PER EMPLOYEE
        # =====================================================

        ranked_employees = sorted(
            employee_distances.values(),
            key=lambda item: float(
                np.median(item["distances"])
            )
        )

        if not ranked_employees:
            return {
                "status": "No Match",
                "message": "No registered face matched."
            }

        best_employee = (
            ranked_employees[0]["employee"]
        )

        best_distance = float(
            np.median(
                ranked_employees[0]["distances"]
            )
        )

        if len(ranked_employees) >= 2:
            second_distance = float(
                np.median(
                    ranked_employees[1]["distances"]
                )
            )
        else:
            second_distance = 1.0

        margin = (
            second_distance -
            best_distance
        )

        employee_name = (
            best_employee.get("full_name")
        )

        print(
            f"🔎 LIVE RECOGNITION: "
            f"{employee_name} | "
            f"DISTANCE={best_distance:.4f} | "
            f"MARGIN={margin:.4f}",
            flush=True
        )

        # =====================================================
        # RECOGNITION DECISION
        # =====================================================

        MIN_DISTANCE = 0.35
        MIN_MARGIN = 0.05

        if (
            best_distance < MIN_DISTANCE
            and margin >= MIN_MARGIN
        ):
            print(
                f"✅ LIVE IDENTITY VERIFIED: "
                f"{employee_name}",
                flush=True
            )

            return {
                "status": "Match",
                "message": "Identity verified.",
                "employee": {
                    "id": best_employee.get("id"),
                    "full_name": employee_name,
                    "branch_id": best_employee.get("branch_id"),
                    "shift_id": best_employee.get("shift_id")
                },
                "distance": best_distance,
                "margin": margin
            }

        # Face is recognized as a possible employee,
        # but the difference is not strong enough.
        print(
            f"⚠️ LIVE IDENTITY UNCERTAIN: "
            f"{employee_name}",
            flush=True
        )

        return {
            "status": "Uncertain",
            "message": "Face detected, but identity is not confident enough.",
            "employee": {
                "id": best_employee.get("id"),
                "full_name": employee_name
            },
            "distance": best_distance,
            "margin": margin
        }

    except Exception as e:

        print(
            "❌ LIVE RECOGNITION ERROR:",
            str(e),
            flush=True
        )

        return {
            "status": "Error",
            "message": "Unable to recognize face."
        }

# 🔥 VERIFY FACE
# ============================================================
# 🔥 VERIFY FACE
# FINAL WEB ATTENDANCE VERIFICATION
#
# InsightFace recognition runs on port 8002.
# MediaPipe blink/liveness remains here on port 8000.
# ============================================================

@app.post("/verify-face")
async def verify_face(
    files: List[UploadFile] = File(...),
    user_id: str = Form(...),
    full_name: str = Form(...)
):
    print("🔥 VERIFY STARTED", flush=True)

    try:

        # =====================================================
        # 1. LOAD CAPTURED FRAMES
        # =====================================================

        frames = []

        for file in files[:12]:

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

            # Keep processing fast
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
        # 2. MEDIA PIPE BLINK / LIVENESS
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


        # Make sure MediaPipe detected enough frames
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


        # =====================================================
        # 3. BLINK SEQUENCE
        # OPEN → CLOSED → OPEN
        # =====================================================

        # Use the user's observed open-eye EAR as a baseline.
        # This keeps the liveness check tolerant of camera distance,
        # face size, and natural differences in eye shape while still
        # requiring a real OPEN -> CLOSED -> OPEN transition.
        sorted_ears = sorted(ear_values, reverse=True)
        open_reference = float(
            np.median(sorted_ears[:min(4, len(sorted_ears))])
        )

        OPEN_THRESHOLD = max(
            0.20,
            open_reference * 0.72
        )

        CLOSED_THRESHOLD = min(
            0.20,
            open_reference * 0.68
        )

        blink_detected = False
        open_before = False
        closed_during = False

        for ear in ear_values:

            # Eyes start/open normally.
            if not open_before:

                if ear >= OPEN_THRESHOLD:
                    open_before = True

            # Eyes close enough relative to the user's normal open-eye EAR.
            elif not closed_during:

                if ear <= CLOSED_THRESHOLD:
                    closed_during = True

            # Eyes must open again after the closed state.
            else:

                if ear >= OPEN_THRESHOLD:
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
        # 4. SEND FRAMES TO INSIGHTFACE SERVER
        # PORT 8002
        # =====================================================

        recognition_results = []

        # Keep the longer 12-frame capture for liveness, but only
        # send three representative frames to InsightFace. This reduces
        # recognition time while keeping three matching votes required.
        # Matching thresholds and identity checks remain unchanged.
        recognition_indices = (
            [1, 6, 10]
            if len(frames) >= 12
            else list(range(len(frames)))
        )

        recognition_frames = [
            (index, frames[index])
            for index in recognition_indices
        ]

        print(
            "🧠 WEB INSIGHTFACE RECOGNITION FRAMES:",
            [index + 1 for index, _ in recognition_frames],
            flush=True
        )

        completed_results = []

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [
                executor.submit(
                    recognize_insightface_frame,
                    index,
                    img
                )
                for index, img in recognition_frames
            ]

            for future in as_completed(futures):
                index, result, error = future.result()

                if error:
                    print(
                        f"❌ INSIGHTFACE FRAME {index + 1} ERROR:",
                        error,
                        flush=True
                    )
                    continue

                print(
                    f"🔎 INSIGHTFACE FRAME {index + 1}:",
                    result,
                    flush=True
                )

                if result is not None:
                    completed_results.append((index, result))

        completed_results.sort(key=lambda item: item[0])
        recognition_results = [
            result
            for _, result in completed_results
        ]

        # =====================================================
        # 5. MAKE SURE INSIGHTFACE RESPONDED
        # =====================================================

        if not recognition_results:

            return {
                "status": "Error",
                "message": (
                    "Unable to connect to the InsightFace "
                    "recognition service."
                )
            }


        # =====================================================
        # 6. TEMPORAL VOTING
        # COUNT RECOGNIZED EMPLOYEES ACROSS FRAMES
        # =====================================================

        employee_votes = {}

        for result in recognition_results:

            if result.get("status") != "Match":
                continue

            employee_id = result.get("employee_id")
            full_name = result.get("full_name")

            if not employee_id or not full_name:
                continue

            employee_id = str(employee_id)

            if employee_id not in employee_votes:

                employee_votes[employee_id] = {
                    "employee": {
                        "id": employee_id,
                        "full_name": full_name
                    },
                    "votes": 0,
                    "distances": []
                }

            employee_votes[employee_id]["votes"] += 1

            distance = result.get("distance")

            if distance is not None:

                employee_votes[
                    employee_id
                ]["distances"].append(
                    float(distance)
                )

        # =====================================================
        # 7. NO RECOGNIZED EMPLOYEE
        # =====================================================

        if not employee_votes:

            print(
                "❌ INSIGHTFACE: NO MATCH",
                flush=True
            )

            return {
                "status": "No Match",
                "message": "Face was not recognized."
            }


        # =====================================================
        # 8. SELECT EMPLOYEE WITH MOST VOTES
        # =====================================================

        ranked_votes = sorted(
            employee_votes.values(),
            key=lambda item: (
                -item["votes"],
                np.median(item["distances"])
                if item["distances"]
                else 1.0
            )
        )


        best_result = ranked_votes[0]

        best_employee = best_result["employee"]

        best_employee_id = str(
            best_employee.get("id")
        )

        vote_count = best_result["votes"]


        if best_result["distances"]:

            median_distance = float(
                np.median(
                    best_result["distances"]
                )
            )

        else:

            median_distance = 1.0


        print(
            "🏆 INSIGHTFACE BEST EMPLOYEE:",
            best_employee.get("full_name"),
            flush=True
        )

        print(
            "🗳️ INSIGHTFACE VOTES:",
            vote_count,
            "/",
            len(recognition_results),
            flush=True
        )

        print(
            "📏 INSIGHTFACE MEDIAN DISTANCE:",
            median_distance,
            flush=True
        )


        # =====================================================
        # 9. REQUIRE TEMPORAL CONSISTENCY
        #
        # At least 3 frames must recognize the same employee.
        # This prevents one accidental frame from being enough.
        # =====================================================

        if vote_count < 3:

            print(
                "⚠️ INSIGHTFACE: NOT ENOUGH CONSISTENT MATCHES",
                flush=True
            )

            return {
                "status": "No Match",
                "message": (
                    "Face recognition was not consistent "
                    "enough. Please try again."
                )
            }


        # =====================================================
        # 10. VERIFY AGAINST LOGGED-IN EMPLOYEE
        #
        # IMPORTANT:
        # Compare employee IDs, NOT names.
        # =====================================================

        requested_id = str(user_id)


        if best_employee_id != requested_id:

            print(
                "🚨 WRONG EMPLOYEE:",
                best_employee.get("full_name"),
                "| LOGGED-IN:",
                full_name,
                flush=True
            )

            return {
                "status": "No Match",
                "message": (
                    "Face does not belong to the "
                    "logged-in employee."
                )
            }


        # =====================================================
        # 11. FINAL SUCCESS
        # =====================================================

        print(
            "✅ WEB FACE MATCH:",
            best_employee.get("full_name"),
            flush=True
        )


        return {
            "status": "Match",
            "distance": median_distance,
            "employee": {
                "id": best_employee.get("id"),
                "full_name": best_employee.get("full_name")
            }
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
# ============================================================
# KIOSK ATTENDANCE USING LIVE INSIGHTFACE RESULT
# ============================================================

# ============================================================
# 🔥 KIOSK LIVE VERIFICATION
#
# Flow:
# 1. Kiosk sends captured frames
# 2. Verify registered kiosk
# 3. MediaPipe checks blink/liveness
# 4. Frames are sent to InsightFace :8002
# 5. Temporal voting confirms the employee
# 6. Successful frame is uploaded to Supabase
# 7. Attendance is recorded
# ============================================================

@app.post("/kiosk-verify-live")
async def kiosk_verify_live(
    files: List[UploadFile] = File(...),
    action: str = Form(...),
    kiosk_code: str = Form(...)
):
    print("🔥 KIOSK LIVE VERIFICATION STARTED", flush=True)
    print("ACTION:", action, flush=True)
    print("KIOSK CODE:", kiosk_code, flush=True)

    try:

        # =====================================================
        # 1. VALIDATE ACTION
        # =====================================================

        action = action.strip().upper()

        if action not in ["TIME IN", "TIME OUT"]:
            return {
                "status": "Error",
                "message": "Invalid attendance action."
            }

        # =====================================================
        # 2. VERIFY KIOSK
        # =====================================================

        kiosk_response = (
            supabase
            .rpc(
                "verify_kiosk",
                {
                    "p_kiosk_code": kiosk_code
                }
            )
            .execute()
        )

        registered_kiosks = (
            kiosk_response.data or []
        )

        print(
            "🏪 KIOSK REGISTRATION RESULT:",
            registered_kiosks,
            flush=True
        )

        if not registered_kiosks:
            return {
                "status": "Error",
                "message": "This kiosk is not registered."
            }

        kiosk = registered_kiosks[0]

        if not kiosk.get("is_active"):
            return {
                "status": "Error",
                "message": "This kiosk is inactive."
            }

        print(
            "✅ REGISTERED KIOSK:",
            kiosk.get("kiosk_code"),
            flush=True
        )

        # =====================================================
        # 3. LOAD CAMERA FRAMES
        # =====================================================

        frames = []

        # Allow the full 12-frame kiosk blink window to reach MediaPipe.
        for file in files[:12]:

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

            # Keep the same processing size used
            # by the employee web verification.
            img = cv2.resize(
                img,
                (320, 240)
            )

            frames.append(img)

        print(
            "📸 KIOSK CAPTURED FRAMES:",
            len(frames),
            flush=True
        )

        if len(frames) < 2:
            return {
                "status": "Error",
                "message": "Not enough camera frames were captured."
            }

        # =====================================================
        # 4. MEDIAPIPE BLINK / LIVENESS
        #
        # Required sequence:
        # OPEN → CLOSED → OPEN
        # =====================================================

        ear_values = []

        for index, img in enumerate(frames):

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

        print(
            "👁️ KIOSK EAR VALUES:",
            [round(e, 3) for e in ear_values],
            flush=True
        )

        if len(ear_values) < 2:
            return {
                "status": "Fake",
                "message": (
                    "Face was not detected properly. "
                    "Please position your face in the camera."
                )
            }

        # =====================================================
        # BLINK SEQUENCE
        # OPEN → CLOSED → OPEN
        # =====================================================

        # Match the web attendance adaptive blink detection.
        # Use the user's observed open-eye EAR as a baseline while
        # still requiring OPEN -> CLOSED -> OPEN.
        sorted_ears = sorted(ear_values, reverse=True)
        open_reference = float(
            np.median(
                sorted_ears[:min(4, len(sorted_ears))]
            )
        )

        OPEN_THRESHOLD = max(
            0.20,
            open_reference * 0.72
        )

        CLOSED_THRESHOLD = min(
            0.20,
            open_reference * 0.68
        )

        blink_detected = False
        open_before = False
        closed_during = False

        for ear in ear_values:

            # Eyes start open
            if not open_before:

                if ear > OPEN_THRESHOLD:
                    open_before = True

            # Eyes close
            elif not closed_during:

                if ear < CLOSED_THRESHOLD:
                    closed_during = True

            # Eyes open again
            else:

                if ear > OPEN_THRESHOLD:
                    blink_detected = True
                    break

        print(
            "👁️ KIOSK BLINK CHECK:",
            f"OPEN_BEFORE={open_before}",
            f"CLOSED={closed_during}",
            f"OPEN_AFTER={blink_detected}",
            flush=True
        )

        if not blink_detected:
            return {
                "status": "Fake",
                "message": (
                    "Please blink once naturally "
                    "during scanning."
                )
            }

        print(
            "✅ KIOSK BLINK VERIFIED",
            flush=True
        )

        # =====================================================
        # 5. SEND FRAMES TO INSIGHTFACE
        # =====================================================

        recognition_results = []

        # Match Web Attendance: keep all 12 frames for blink/liveness,
        # but send only three representative frames to InsightFace.
        recognition_indices = (
            [1, 6, 10]
            if len(frames) >= 12
            else list(range(len(frames)))
        )

        recognition_frames = [
            (index, frames[index])
            for index in recognition_indices
        ]

        print(
            "🧠 KIOSK INSIGHTFACE RECOGNITION FRAMES:",
            [index + 1 for index, _ in recognition_frames],
            flush=True
        )

        completed_results = []

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [
                executor.submit(
                    recognize_insightface_frame,
                    index,
                    img
                )
                for index, img in recognition_frames
            ]

            for future in as_completed(futures):
                index, result, error = future.result()

                if error:
                    print(
                        f"❌ INSIGHTFACE FRAME {index + 1} ERROR:",
                        error,
                        flush=True
                    )
                    continue

                print(
                    f"🔎 INSIGHTFACE FRAME {index + 1}:",
                    result,
                    flush=True
                )

                if result is not None:
                    completed_results.append((index, result))

        completed_results.sort(key=lambda item: item[0])
        recognition_results = [
            {
                "result": result,
                "frame": frames[index]
            }
            for index, result in completed_results
        ]

        # =====================================================
        # 6. MAKE SURE INSIGHTFACE RESPONDED
        # =====================================================

        if not recognition_results:
            return {
                "status": "Error",
                "message": (
                    "Unable to connect to the "
                    "InsightFace recognition service."
                )
            }

        # =====================================================
        # 7. TEMPORAL VOTING
        # =====================================================

        employee_votes = {}

        for item in recognition_results:

            result = item["result"]

            if result.get("status") != "Match":
                continue

            # Current InsightFace response:
            #
            # "employee": {
            #     "id": "...",
            #     "full_name": "...",
            #     "branch_id": "...",
            #     "shift_id": "..."
            # }
            #
            # Also support the older flat response format.

            employee_data = (
                result.get("employee")
                or {}
            )

            employee_id = (
                employee_data.get("id")
                or result.get("employee_id")
            )

            full_name = (
                employee_data.get("full_name")
                or result.get("full_name")
            )

            if not employee_id or not full_name:
                continue

            employee_id = str(employee_id)

            if employee_id not in employee_votes:

                employee_votes[employee_id] = {
                    "employee": {
                        "id": employee_id,
                        "full_name": full_name,
                        "branch_id":
                            employee_data.get("branch_id"),
                        "shift_id":
                            employee_data.get("shift_id")
                    },
                    "votes": 0,
                    "distances": [],
                    "frames": []
                }

            employee_votes[
                employee_id
            ]["votes"] += 1

            distance = result.get("distance")

            if distance is not None:

                employee_votes[
                    employee_id
                ]["distances"].append(
                    float(distance)
                )

            employee_votes[
                employee_id
            ]["frames"].append(
                item["frame"]
            )

        # =====================================================
        # 8. NO RECOGNIZED EMPLOYEE
        # =====================================================

        if not employee_votes:

            print(
                "❌ KIOSK INSIGHTFACE: NO MATCH",
                flush=True
            )

            return {
                "status": "No Match",
                "message": "Face was not recognized."
            }

        # =====================================================
        # 9. RANK EMPLOYEES
        # =====================================================

        ranked_employees = sorted(
            employee_votes.values(),
            key=lambda item: (
                -item["votes"],
                np.median(item["distances"])
                if item["distances"]
                else 1.0
            )
        )

        best_result = ranked_employees[0]

        best_employee = best_result["employee"]

        best_distance = float(
            np.median(
                best_result["distances"]
            )
        )

        best_votes = best_result["votes"]

        second_distance = (
            float(
                np.median(
                    ranked_employees[1]["distances"]
                )
            )
            if len(ranked_employees) >= 2
            else 1.0
        )

        margin = (
            second_distance -
            best_distance
        )

        print(
            "🏆 KIOSK BEST EMPLOYEE:",
            best_employee["full_name"],
            flush=True
        )

        print(
            "🗳️ KIOSK VOTES:",
            best_votes,
            "/",
            len(recognition_results),
            flush=True
        )

        print(
            "📏 KIOSK DISTANCE:",
            best_distance,
            flush=True
        )

        print(
            "📐 KIOSK MARGIN:",
            margin,
            flush=True
        )

        # =====================================================
        # 10. REQUIRE CONSISTENT RECOGNITION
        # =====================================================

        if best_votes < 3:

            print(
                "⚠️ KIOSK: NOT ENOUGH CONSISTENT MATCHES",
                flush=True
            )

            return {
                "status": "No Match",
                "message": (
                    "Face recognition was not consistent "
                    "enough. Please try again."
                )
            }

        # =====================================================
        # 11. FINAL RECOGNITION THRESHOLD
        # =====================================================

        MIN_DISTANCE = 0.35
        MIN_MARGIN = 0.05

        if best_distance >= MIN_DISTANCE:

            print(
                "❌ KIOSK: DISTANCE TOO HIGH",
                best_distance,
                flush=True
            )

            return {
                "status": "No Match",
                "message": (
                    "Face was detected, but the identity "
                    "could not be verified."
                )
            }

        if margin < MIN_MARGIN:

            print(
                "⚠️ KIOSK: MATCH TOO CLOSE",
                margin,
                flush=True
            )

            return {
                "status": "No Match",
                "message": (
                    "Face recognition was not confident "
                    "enough. Please try again."
                )
            }

        print(
            "✅ KIOSK IDENTITY VERIFIED:",
            best_employee["full_name"],
            flush=True
        )

        # =====================================================
        # 12. UPLOAD ATTENDANCE PHOTO
        #
        # Use the last successful frame belonging
        # to the recognized employee.
        # =====================================================

        face_url = None

        successful_frames = (
            best_result["frames"]
        )

        if successful_frames:

            face_frame = successful_frames[-1]

            try:

                success, encoded_image = cv2.imencode(
                    ".jpg",
                    face_frame,
                    [
                        cv2.IMWRITE_JPEG_QUALITY,
                        90
                    ]
                )

                if not success:

                    print(
                        "⚠️ KIOSK PHOTO ENCODE FAILED",
                        flush=True
                    )

                else:

                    face_bytes = (
                        encoded_image.tobytes()
                    )

                    safe_name = normalize_name(
                        best_employee["full_name"]
                    )

                    action_folder = (
                        action.lower().replace(" ", "_")
                    )

                    file_name = (
                        f"attendance/"
                        f"{safe_name}/"
                        f"{action_folder}/"
                        f"{int(time.time() * 1000)}.jpg"
                    )

                    print(
                        "📸 KIOSK ATTENDANCE PHOTO:",
                        file_name,
                        flush=True
                    )

                    supabase.storage.from_(
                        "faces"
                    ).upload(
                        file_name,
                        face_bytes,
                        {
                            "content-type":
                                "image/jpeg",
                            "upsert": "true"
                        }
                    )

                    face_url = (
                        supabase
                        .storage
                        .from_("faces")
                        .get_public_url(
                            file_name
                        )
                    )

                    print(
                        "✅ KIOSK PHOTO SAVED:",
                        face_url,
                        flush=True
                    )

            except Exception as e:

                print(
                    "⚠️ KIOSK PHOTO UPLOAD FAILED:",
                    str(e),
                    flush=True
                )

        # =====================================================
        # 13. RECORD ATTENDANCE
        # =====================================================

        attendance_result = (
            await record_kiosk_attendance(
                best_employee,
                action,
                face_url
            )
        )

        # =====================================================
        # 14. RETURN FINAL RESULT
        # =====================================================

        return {
            "status": "Match",
            "message": (
                "Identity verified and attendance recorded."
            ),
            "employee": {
                "id": best_employee["id"],
                "full_name": best_employee["full_name"]
            },
            "distance": best_distance,
            "margin": margin,
            "blink_verified": True,
            "face_url": face_url,
            "attendance": attendance_result
        }

    except Exception as e:

        print(
            "❌ KIOSK LIVE VERIFICATION ERROR:",
            str(e),
            flush=True
        )

        return {
            "status": "Error",
            "message": str(e)
        }
@app.post("/kiosk-attendance")
async def kiosk_attendance(
    employee_id: str = Form(...),
    action: str = Form(...),
    kiosk_code: str = Form(...)
):
    print("🔥 KIOSK ATTENDANCE REQUEST", flush=True)
    print("EMPLOYEE ID:", employee_id, flush=True)
    print("ACTION:", action, flush=True)
    print("KIOSK CODE:", kiosk_code, flush=True)

    try:
        # Verify kiosk
        kiosk_response = (
            supabase
            .rpc(
                "verify_kiosk",
                {
                    "p_kiosk_code": kiosk_code
                }
            )
            .execute()
        )

        registered_kiosks = kiosk_response.data or []

        if not registered_kiosks:
            return {
                "status": "Error",
                "message": "This kiosk is not registered."
            }

        kiosk = registered_kiosks[0]

        if not kiosk.get("is_active"):
            return {
                "status": "Error",
                "message": "This kiosk is inactive."
            }

        # Find employee recognized by InsightFace
        employee_response = (
            supabase
            .table("employee_profiles")
            .select(
                "id, full_name, branch_id, shift_id, role_id"
            )
            .eq("id", employee_id)
            .limit(1)
            .execute()
        )

        employees = employee_response.data or []

        if not employees:
            return {
                "status": "Error",
                "message": "Employee profile was not found."
            }

        employee = employees[0]

        # Reuse existing attendance logic
        attendance = await record_kiosk_attendance(
            employee,
            action
        )

        return {
            **attendance,
            "employee": {
                "id": employee["id"],
                "full_name": employee["full_name"]
            }
        }

    except Exception as e:
        print(
            "❌ KIOSK ATTENDANCE ENDPOINT ERROR:",
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
    action: str = Form(...),
    kiosk_code: str = Form(...)
):
    print("🔥 KIOSK VERIFY STARTED", flush=True)
    print(
    "🏪 KIOSK CODE:",
    kiosk_code,
    flush=True
)

    try:
                # =====================================================
        # 🏪 VERIFY KIOSK REGISTRATION
        # =====================================================

        kiosk_response = (
            supabase
            .rpc(
                "verify_kiosk",
                {
                    "p_kiosk_code": kiosk_code
                }
            )
            .execute()
        )

        registered_kiosks = (
            kiosk_response.data or []
        )

        print(
            "🏪 KIOSK REGISTRATION RESULT:",
            registered_kiosks,
            flush=True
        )

        if not registered_kiosks:
            return {
                "status": "Error",
                "message": "This kiosk is not registered."
            }

        kiosk = registered_kiosks[0]

        if not kiosk.get("is_active"):
            return {
                "status": "Error",
                "message": "This kiosk is inactive."
            }

        print(
            "✅ REGISTERED KIOSK:",
            kiosk.get("kiosk_code"),
            flush=True
        )
                # =====================================================
        # 🏢 GET KIOSK BRANCH
        # =====================================================

        kiosk_branch_id = kiosk.get("branch_id")

        if kiosk_branch_id:
            print(
                "🏢 KIOSK BRANCH:",
                kiosk_branch_id,
                flush=True
            )
        else:
            print(
                "🏢 KIOSK BRANCH: NOT ASSIGNED "
                "(DEVELOPMENT MODE)",
                flush=True
            )
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
        # 🏢 FILTER FACES BY KIOSK BRANCH
        # =====================================================

        if kiosk_branch_id:

            branch_face_cache = [
                cached_face
                for cached_face in kiosk_face_cache
                if str(
                    cached_face["employee"].get("branch_id")
                ) == str(kiosk_branch_id)
            ]

            print(
                "🏢 BRANCH-FILTERED FACE CACHE:",
                len(branch_face_cache),
                "FACE EMBEDDINGS",
                flush=True
            )

        else:

            # Development kiosk has no branch assigned yet.
            # Keep using the complete cache temporarily.
            branch_face_cache = kiosk_face_cache

            print(
                "🧪 DEVELOPMENT MODE:",
                "Using all kiosk face embeddings.",
                flush=True
            )

        if not branch_face_cache:
            return {
                "status": "Error",
                "message": (
                    "No registered employees were found "
                    "for this kiosk branch."
                )
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

        for cached_face in branch_face_cache:

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