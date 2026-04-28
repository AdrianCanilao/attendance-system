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

# 🔥 SUPABASE CONFIG
SUPABASE_URL = "https://gncvkqqmreufoarakjmj.supabase.co"
SUPABASE_SERVICE_KEY = "sb_publishable_o2igaNv9uPIf3iM6nmgN4w_b8DyuYtZ"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 🔥 ROOT
@app.get("/")
def home():
    return {"message": "Face Recognition API is running"}


# 🔥 UPLOAD FACE (USE FIXED NAME = user_id.jpg)
@app.post("/upload-face")
async def upload_face(file: UploadFile = File(...), user_id: str = Form(...)):
    try:
        contents = await file.read()

        file_name = f"{user_id}.jpg"  # 🔥 IMPORTANT FIX

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


# 🔥 VERIFY FACE (THIS IS THE MAIN FEATURE)
@app.post("/verify-face")
async def verify_face(file: UploadFile = File(...), user_id: str = Form(...)):
    from deepface import DeepFace

    try:
        contents = await file.read()

        npimg = np.frombuffer(contents, np.uint8)
        captured_img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if captured_img is None:
            return {"status": "Error", "message": "Invalid image"}

        # 🔥 GET STORED IMAGE FROM SUPABASE
        file_name = f"{user_id}.jpg"
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/faces/{file_name}"

        response = requests.get(public_url)

        if response.status_code != 200:
            return {"status": "Error", "message": "Registered face not found"}

        face_bytes = np.asarray(bytearray(response.content), dtype=np.uint8)
        stored_img = cv2.imdecode(face_bytes, cv2.IMREAD_COLOR)

        if stored_img is None:
            return {"status": "Error", "message": "Stored image invalid"}

        # 🔍 COMPARE
        result = DeepFace.verify(
            captured_img,
            stored_img,
            enforce_detection=False,
            model_name="VGG-Face"
        )

        if result.get("verified"):
            return {"status": "Match"}
        else:
            return {"status": "No Match"}

    except Exception as e:
        return {"status": "Error", "message": str(e)}