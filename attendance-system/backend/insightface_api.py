import os
import cv2
import numpy as np
import requests

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.insightface_engine import insightface_app


# ============================================================
# CONFIG
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")

SUPABASE_KEY = os.getenv("SUPABASE_KEY")

EMPLOYEE_ROLE_ID = "e4dbb928-7f0e-4da9-9eff-d7700d37b25a"

MAINTENANCE_ROLE_ID = "b381a7a0-9595-4c69-abf1-5c15a827647a"

RECOGNITION_THRESHOLD = 0.45


if not SUPABASE_URL or not SUPABASE_KEY:

    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_KEY environment variables are required."
    )


headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="CIBO InsightFace Recognition API"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HELPERS
# ============================================================

def normalize_embedding(embedding):

    embedding = np.asarray(
        embedding,
        dtype=np.float32
    )

    norm = np.linalg.norm(embedding)

    if norm == 0:
        return None

    return embedding / norm


def cosine_distance(a, b):

    a = normalize_embedding(a)
    b = normalize_embedding(b)

    if a is None or b is None:
        return 1.0

    return float(
        1.0 - np.dot(a, b)
    )


def get_employees():

    url = (
        f"{SUPABASE_URL}"
        "/rest/v1/employee_profiles"
        "?select=id,full_name,branch_id,role_id"
        f"&role_id=in.({EMPLOYEE_ROLE_ID},{MAINTENANCE_ROLE_ID})"
    )

    response = requests.get(
        url,
        headers=headers,
        timeout=10
    )

    response.raise_for_status()

    return response.json()


def get_storage_files(folder_path):

    url = (
        f"{SUPABASE_URL}"
        "/storage/v1/object/list/faces"
    )

    payload = {
        "prefix": folder_path,
        "limit": 100,
        "offset": 0,
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=10
    )

    response.raise_for_status()

    return response.json()


def download_image(file_path):

    url = (
        f"{SUPABASE_URL}"
        "/storage/v1/object/public/faces/"
        f"{file_path}"
    )

    response = requests.get(
        url,
        headers={
            "apikey": SUPABASE_KEY
        },
        timeout=10
    )

    if response.status_code != 200:
        return None

    image_array = np.frombuffer(
        response.content,
        dtype=np.uint8
    )

    return cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )


# ============================================================
# BUILD EMPLOYEE TEMPLATE
# ============================================================

def build_template(employee):

    name = employee["full_name"]

    safe_name = (
        name
        .strip()
        .lower()
        .replace(" ", "_")
    )

    folder = (
        f"employees/{safe_name}"
    )

    try:

        files = get_storage_files(
            folder
        )

    except Exception as e:

        print(
            f"Storage error for {name}: {e}"
        )

        return None

    embeddings = []

    for stored_file in files:

        file_name = stored_file.get(
            "name"
        )

        if not file_name:
            continue

        if "." not in file_name:
            continue

        file_path = (
            f"{folder}/{file_name}"
        )

        image = download_image(
            file_path
        )

        if image is None:
            continue

        try:

            faces = insightface_app.get(
                image
            )

        except Exception as e:

            print(
                f"InsightFace error "
                f"for {name}: {e}"
            )

            continue

        if len(faces) != 1:
            continue

        embedding = normalize_embedding(
            faces[0].embedding
        )

        if embedding is not None:

            embeddings.append(
                embedding
            )

    if not embeddings:

        return None

    template = np.mean(
        np.stack(embeddings),
        axis=0
    )

    template = normalize_embedding(
        template
    )

    return template


# ============================================================
# LOAD EMPLOYEE TEMPLATES
# ============================================================
# ============================================================
# LOAD EMPLOYEE TEMPLATES
# ============================================================

templates = []


def load_employee_templates():

    global templates

    print()
    print("=" * 60)
    print("🔄 LOADING INSIGHTFACE EMPLOYEE TEMPLATES")
    print("=" * 60)

    print(
        "Loading employee templates...",
        flush=True
    )

    try:

        employees = get_employees()

        new_templates = []

        for employee in employees:

            template = build_template(
                employee
            )

            if template is None:

                print(
                    f"❌ No valid template: "
                    f"{employee['full_name']}",
                    flush=True
                )

                continue

            new_templates.append({
                "employee": employee,
                "template": template
            })

            print(
                f"✅ Template ready: "
                f"{employee['full_name']}",
                flush=True
            )

        # Replace the old templates only after
        # the new templates have been built.
        templates = new_templates

        print()
        print(
            f"🎯 TEMPLATES READY: "
            f"{len(templates)}",
            flush=True
        )

        print("=" * 60)
        print()

        return True

    except Exception as e:

        print(
            "❌ TEMPLATE LOADING ERROR:",
            str(e),
            flush=True
        )

        return False

load_employee_templates()

# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "status": "OK",
        "service": "CIBO InsightFace API",
        "templates": len(templates)
    }
# ============================================================
# RELOAD EMPLOYEE TEMPLATES
# ============================================================

@app.post("/reload-templates")
def reload_templates():

    success = load_employee_templates()

    if not success:

        return {
            "status": "Error",
            "message": "Unable to reload employee templates.",
            "templates": len(templates)
        }

    return {
        "status": "OK",
        "message": "Employee templates reloaded.",
        "templates": len(templates)
    }


# ============================================================
# RECOGNIZE FACE
# ============================================================

@app.post("/recognize-live-face")
async def recognize_live_face(
    file: UploadFile = File(...)
):

    contents = await file.read()

    image_array = np.frombuffer(
        contents,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if image is None:

        return {
            "status": "Error",
            "message": "Invalid image."
        }

    # ========================================================
    # INSIGHTFACE DETECTION
    # ========================================================

    faces = insightface_app.get(
        image
    )

    if len(faces) == 0:

        return {
            "status": "No Face",
            "message": "No face detected."
        }

    if len(faces) > 1:

        return {
            "status": "Multiple Faces",
            "message": "Only one face is allowed."
        }

    face = faces[0]

    # Face bounding box for the kiosk UI overlay.
    x1, y1, x2, y2 = face.bbox
    box = {
        "x": int(max(0, x1)),
        "y": int(max(0, y1)),
        "w": int(max(0, x2 - x1)),
        "h": int(max(0, y2 - y1)),
    }

    image_height, image_width = image.shape[:2]

    embedding = normalize_embedding(
        face.embedding
    )

    if embedding is None:

        return {
            "status": "Error",
            "message": "Could not create face embedding."
        }

    # ========================================================
    # COMPARE
    # ========================================================

    results = []

    for item in templates:

        distance = cosine_distance(
            embedding,
            item["template"]
        )

        results.append({
            "employee": item["employee"],
            "distance": distance
        })

    results.sort(
        key=lambda x: x["distance"]
    )

    if not results:

        return {
            "status": "Unknown",
            "message": "No employee templates available."
        }

    best = results[0]

    best_employee = best["employee"]

    best_distance = best["distance"]

    # ========================================================
    # THRESHOLD
    # ========================================================

    if best_distance > RECOGNITION_THRESHOLD:

        return {
            "status": "Unknown",
            "employee_id": None,
            "full_name": None,
            "distance": round(
                best_distance,
                4
            ),
            "threshold": RECOGNITION_THRESHOLD,
            "box": box,
        }

    # ========================================================
    # MATCH
    # ========================================================

    return {
        "status": "Match",
        "employee_id": best_employee["id"],
        "full_name": best_employee["full_name"],
        "distance": round(
            best_distance,
            4
        ),
        "threshold": RECOGNITION_THRESHOLD,
        "box": box,
        "image_width": image_width,
        "image_height": image_height,
    }

# ============================================================
# ENROLLMENT FACE VALIDATION
# Used by Register Employee
# ============================================================

@app.post("/validate-enrollment-face")
async def validate_enrollment_face(
    file: UploadFile = File(...)
):

    try:

        contents = await file.read()

        image_array = np.frombuffer(
            contents,
            dtype=np.uint8
        )

        image = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if image is None:

            return {
                "valid": False,
                "message": "Invalid camera image.",
                "box": None
            }


        # ====================================================
        # INSIGHTFACE / SCRFD DETECTION
        # ====================================================

        faces = insightface_app.get(image)


        # No face
        if len(faces) == 0:

            return {
                "valid": False,
                "message": "No face detected. Position your face inside the box.",
                "box": None
            }


        # Multiple faces
        if len(faces) > 1:

            return {
                "valid": False,
                "message": "Only one face is allowed.",
                "box": None
            }


        face = faces[0]


        # ====================================================
        # FACE BOUNDING BOX
        # ====================================================

        x1, y1, x2, y2 = face.bbox

        x1 = int(max(0, x1))
        y1 = int(max(0, y1))
        x2 = int(min(image.shape[1], x2))
        y2 = int(min(image.shape[0], y2))

        face_width = x2 - x1
        face_height = y2 - y1


        box = {
            "x": x1,
            "y": y1,
            "w": face_width,
            "h": face_height
        }


        # ====================================================
        # FACE SIZE CHECK
        # ====================================================

        MIN_FACE_WIDTH = 60
        MIN_FACE_HEIGHT = 80

        if (
            face_width < MIN_FACE_WIDTH
            or face_height < MIN_FACE_HEIGHT
        ):

            return {
                "valid": False,
                "message": "Move closer to the camera.",
                "box": box
            }


        # ====================================================
        # FACE CENTER CHECK
        # ====================================================

        image_height, image_width = image.shape[:2]

        face_center_x = (
            x1 + face_width / 2
        )

        face_center_y = (
            y1 + face_height / 2
        )

        image_center_x = image_width / 2
        image_center_y = image_height / 2

        center_x_difference = abs(
            face_center_x - image_center_x
        )

        center_y_difference = abs(
            face_center_y - image_center_y
        )


        MAX_CENTER_X = image_width * 0.30
        MAX_CENTER_Y = image_height * 0.30

        if (
            center_x_difference > MAX_CENTER_X
            or center_y_difference > MAX_CENTER_Y
        ):

            return {
                "valid": False,
                "message": "Center your face inside the box.",
                "box": box
            }


        # ====================================================
        # BRIGHTNESS CHECK
        # ====================================================

        gray = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2GRAY
        )

        brightness = float(
            np.mean(gray)
        )


        if brightness < 35:

            return {
                "valid": False,
                "message": "The image is too dark. Improve the lighting.",
                "box": box
            }


        if brightness > 235:

            return {
                "valid": False,
                "message": "The image is too bright. Reduce the lighting.",
                "box": box
            }


        # ====================================================
        # BLUR CHECK
        # ====================================================

        face_crop = gray[
            y1:y2,
            x1:x2
        ]

        if face_crop.size == 0:

            return {
                "valid": False,
                "message": "Unable to evaluate the face.",
                "box": box
            }


        blur_score = float(
            cv2.Laplacian(
                face_crop,
                cv2.CV_64F
            ).var()
        )


        MIN_BLUR_SCORE = 35.0

        if blur_score < MIN_BLUR_SCORE:

            return {
                "valid": False,
                "message": "Face image is too blurry. Hold still.",
                "box": box
            }


        # ====================================================
        # SUCCESS
        # ====================================================

        return {
            "valid": True,
            "message": "Face detected. Good quality.",
            "box": box
        }


    except Exception as e:

        print(
            "❌ ENROLLMENT VALIDATION ERROR:",
            str(e),
            flush=True
        )

        return {
            "valid": False,
            "message": "Face validation unavailable.",
            "box": None
        }