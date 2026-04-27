from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import requests
import os
from supabase import create_client

app = FastAPI()

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔥 SUPABASE CONFIG (REPLACE THESE)
SUPABASE_URL = "https://gncvkqqmreufoarakjmj.supabase.co"
SUPABASE_SERVICE_KEY = "sb_publishable_o2igaNv9uPIf3iM6nmgN4w_b8DyuYtZ"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 🔥 ROOT
@app.get("/")
def home():
    return {"message": "Face Recognition API is running"}

# 🔥 UPLOAD FACE (BYPASS RLS)
@app.post("/upload-face")
async def upload_face(file: UploadFile = File(...), user_id: str = Form(...)):
    try:
        contents = await file.read()

        print("🔥 RECEIVED USER:", user_id)
        print("🔥 FILE SIZE:", len(contents))

        import time
        file_name = f"{user_id}_{int(time.time())}.jpg"

        result = supabase.storage.from_("faces").upload(
            file_name,
            contents,
            {"content-type": "image/jpeg", "upsert": "true"}
        )

        print("🔥 UPLOAD RESULT:", result)

        public_url = supabase.storage.from_("faces").get_public_url(file_name)

        print("🔥 PUBLIC URL:", public_url)

        return {
            "status": "Uploaded",
            "file": file_name,
            "url": public_url
        }

    except Exception as e:
        print("❌ Upload error:", e)
        return {"status": "Error", "message": str(e)}

# 🔥 RECOGNIZE FACE (FROM SUPABASE URLS)
@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
    from deepface import DeepFace   # ✅ MOVE HERE
    try:
        contents = await file.read()

        if not contents:
            return {"status": "Error", "message": "Empty image"}

        npimg = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "Error", "message": "Invalid image"}

        import json
        with open("users.json") as f:
            users = json.load(f)

        for user in users:
            face_url = user.get("face_url")
            user_id = user.get("id")

            if not face_url:
                continue

            try:
                response = requests.get(face_url)

                if response.status_code != 200:
                    continue

                face_bytes = np.asarray(bytearray(response.content), dtype=np.uint8)
                known_img = cv2.imdecode(face_bytes, cv2.IMREAD_COLOR)

                if known_img is None:
                    continue

                result = DeepFace.verify(
                    img,
                    known_img,
                    enforce_detection=False,
                    model_name="VGG-Face"
                )

                if result.get("verified"):
                    return {
                        "status": "Match",
                        "user": user_id
                    }

            except Exception as inner_error:
                print("Compare error:", inner_error)

        return {"status": "No Match"}

    except Exception as e:
        print("Recognition error:", e)
        return {"status": "Error", "message": str(e)}

# 🔥 OPTIONAL LOCAL SAVE (KEEP OR REMOVE)
@app.post("/register")
async def register(file: UploadFile = File(...), name: str = ""):
    try:
        contents = await file.read()

        os.makedirs("known_faces", exist_ok=True)

        filename = f"{name}.jpg"
        filepath = os.path.join("known_faces", filename)

        with open(filepath, "wb") as f:
            f.write(contents)

        return {"status": "Saved", "user": name}

    except Exception as e:
        return {"status": "Error", "message": str(e)}