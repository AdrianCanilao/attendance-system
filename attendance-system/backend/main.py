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


@app.get("/")
def home():
    return {"message": "Face Recognition API is running"}


# 🔥 UPLOAD FACE
@app.post("/upload-face")
async def upload_face(file: UploadFile = File(...), user_id: str = Form(...)):
    try:
        contents = await file.read()
        file_name = f"{user_id}_{int(time.time() * 1000)}.jpg"

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


# 🔥 VERIFY FACE (STRONG BLINK)
@app.post("/verify-face")
async def verify_face(files: List[UploadFile] = File(...), user_id: str = Form(...)):
    print("🔥 VERIFY STARTED", flush=True)

    try:
        frames = []

        # =========================
        # LOAD FRAMES
        # =========================
        for file in files:
            contents = await file.read()
            npimg = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

            if img is None:
                return {"status": "Error", "message": "Invalid frame"}

            frames.append(img)

        print("📸 Frames:", len(frames), flush=True)

        # =========================
        # 🔥 STRONG BLINK DETECTION
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

                print("👁️ EAR:", ear, flush=True)

        if len(ear_values) < 3:
            return {"status": "Fake", "message": "Face not detected properly"}

        # 🔥 REQUIRE OPEN → CLOSED → OPEN
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
            faces = DeepFace.extract_faces(
                img_path=img,
                enforce_detection=False
            )
            if faces:
                valid_frames.append(img)

        print("👤 Valid frames:", len(valid_frames), flush=True)

        if len(valid_frames) < 2:
            return {"status": "No Face"}

        # =========================
        # LOAD STORED FACES
        # =========================
        files_list = supabase.storage.from_("faces").list()
        user_files = [f for f in files_list if f["name"].startswith(user_id)]
        print("👤 USER ID:", user_id, flush=True)
        print("📁 FILES USED:", [f["name"] for f in user_files], flush=True)

        print("📁 Stored:", len(user_files), flush=True)

        if not user_files:
            return {"status": "Error", "message": "No registered faces"}

        best_distance = 1.0
        distances = []

        # =========================
        # MATCH
        # =========================
        for f in user_files:
            url = f"{SUPABASE_URL}/storage/v1/object/public/faces/{f['name']}"
            response = requests.get(url)

            if response.status_code != 200:
                continue

            stored_img = cv2.imdecode(
                np.asarray(bytearray(response.content), dtype=np.uint8),
                cv2.IMREAD_COLOR
            )

            if stored_img is None:
                continue

            stored_img = cv2.resize(stored_img, (160, 160))

            for img in valid_frames:
                img_resized = cv2.resize(img, (160, 160))

                result = DeepFace.verify(
                    img_resized,
                    stored_img,
                    model_name="ArcFace",
                    enforce_detection=False
                )

                distance = result.get("distance", 1)
                distances.append(distance)

                if distance < best_distance:
                    best_distance = distance

        variation = (max(distances) - min(distances)) if len(distances) > 1 else 0

        print("🔥 BEST DISTANCE:", best_distance, flush=True)
        print("📊 VARIATION:", variation, flush=True)

        # =========================
        # FINAL DECISION
        # =========================
        # =========================
# FINAL DECISION (STRICT + MULTI-FRAME)
# =========================
        valid_matches = [d for d in distances if d < 0.45]

        print("✅ VALID MATCHES:", valid_matches, flush=True)

        if len(valid_matches) >= 2:
             return {"status": "Match"}
        else:
            return {"status": "No Match"}

    except Exception as e:
        print("❌ ERROR:", str(e), flush=True)
        return {"status": "Error", "message": str(e)}