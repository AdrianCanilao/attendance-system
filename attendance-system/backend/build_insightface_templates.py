import os
import cv2
import numpy as np
import requests

from insightface_engine import insightface_app


# ============================================================
# CONFIG
# ============================================================

SUPABASE_URL = "https://gncvkqqmreufoarakjmj.supabase.co"

SUPABASE_SERVICE_KEY = "sb_publishable_o2igaNv9uPIf3iM6nmgN4w_b8DyuYtZ"

EMPLOYEE_ROLE_ID = "e4dbb928-7f0e-4da9-9eff-d7700d37b25a"

MAINTENANCE_ROLE_ID = "b381a7a0-9595-4c69-abf1-5c15a827647a"


# ============================================================
# SUPABASE REQUEST HEADERS
# ============================================================

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
}


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


def normalize_name(name):

    return (
        name
        .strip()
        .lower()
        .replace(" ", "_")
    )


def cosine_distance(a, b):

    a = normalize_embedding(a)
    b = normalize_embedding(b)

    if a is None or b is None:
        return 1.0

    return float(
        1.0 - np.dot(a, b)
    )


# ============================================================
# GET EMPLOYEES FROM SUPABASE
# ============================================================

def get_employees():

    url = (
        f"{SUPABASE_URL}"
        "/rest/v1/employee_profiles"
        "?select=id,full_name,branch_id,shift_id,role_id"
        f"&role_id=in.({EMPLOYEE_ROLE_ID},{MAINTENANCE_ROLE_ID})"
    )

    response = requests.get(
        url,
        headers=headers,
        timeout=10
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# GET FILES FROM SUPABASE STORAGE
# ============================================================

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


# ============================================================
# DOWNLOAD IMAGE
# ============================================================

def download_image(file_path):

    url = (
        f"{SUPABASE_URL}"
        "/storage/v1/object/public/faces/"
        f"{file_path}"
    )

    response = requests.get(
        url,
        timeout=10
    )

    if response.status_code != 200:
        return None

    image_array = np.frombuffer(
        response.content,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    return image


# ============================================================
# CREATE EMPLOYEE TEMPLATE
# ============================================================

def create_employee_template(employee):

    employee_id = str(
        employee["id"]
    )

    employee_name = (
        employee.get("full_name")
        or ""
    )

    safe_name = normalize_name(
        employee_name
    )

    folder_path = (
        f"employees/{safe_name}"
    )

    print()
    print("=" * 60)
    print(f"EMPLOYEE: {employee_name}")
    print(f"ID: {employee_id}")
    print(f"FOLDER: {folder_path}")
    print("=" * 60)

    try:

        files = get_storage_files(
            folder_path
        )

    except Exception as e:

        print(
            f"❌ STORAGE ERROR: {e}"
        )

        return None

    if not files:

        print(
            "⚠️ NO FACE IMAGES FOUND"
        )

        return None

    embeddings = []

    for stored_file in files:

        file_name = stored_file.get(
            "name"
        )

        if not file_name:
            continue

        # Ignore folders.
        if "." not in file_name:
            continue

        file_path = (
            f"{folder_path}/{file_name}"
        )

        print(
            f"\n📷 Processing: {file_name}"
        )

        image = download_image(
            file_path
        )

        if image is None:

            print(
                "❌ Could not download image"
            )

            continue

        # ====================================================
        # INSIGHTFACE DETECTION
        # ====================================================

        try:

            faces = insightface_app.get(
                image
            )

        except Exception as e:

            print(
                f"❌ InsightFace error: {e}"
            )

            continue

        # ====================================================
        # EXACTLY ONE FACE
        # ====================================================

        if len(faces) == 0:

            print(
                "❌ NO FACE DETECTED"
            )

            continue

        if len(faces) > 1:

            print(
                f"❌ MULTIPLE FACES: {len(faces)}"
            )

            continue

        face = faces[0]

        # ====================================================
        # DETECTION CONFIDENCE
        # ====================================================

        detection_score = float(
            face.det_score
        )

        print(
            f"🔍 Detection confidence: "
            f"{detection_score:.4f}"
        )

        if detection_score <= 0:

            print(
                "❌ Invalid detection confidence"
            )

            continue

        # ====================================================
        # EMBEDDING
        # ====================================================

        embedding = face.embedding

        embedding = normalize_embedding(
            embedding
        )

        if embedding is None:

            print(
                "❌ Failed to create embedding"
            )

            continue

        print(
            f"✅ Valid embedding: "
            f"{len(embedding)} dimensions"
        )

        embeddings.append(
            embedding
        )

    # ========================================================
    # TEMPLATE RESULT
    # ========================================================

    print()
    print(
        f"VALID FACE IMAGES: "
        f"{len(embeddings)}"
    )

    if not embeddings:

        print(
            "❌ NO VALID FACE EMBEDDINGS"
        )

        return None

    # ========================================================
    # AVERAGE EMBEDDING
    # ========================================================

    template = np.mean(
        np.stack(embeddings),
        axis=0
    )

    template = normalize_embedding(
        template
    )

    print(
        "✅ EMPLOYEE TEMPLATE CREATED"
    )

    print(
        f"📐 Template dimensions: "
        f"{len(template)}"
    )

    # ========================================================
    # INTERNAL CONSISTENCY
    # ========================================================

    distances = []

    for embedding in embeddings:

        distance = cosine_distance(
            embedding,
            template
        )

        distances.append(
            distance
        )

    print(
        f"📊 Template distances: "
        f"{[round(x, 4) for x in distances]}"
    )

    print(
        f"📊 Average distance: "
        f"{np.mean(distances):.4f}"
    )

    print(
        f"📊 Maximum distance: "
        f"{np.max(distances):.4f}"
    )

    return {
        "employee": employee,
        "template": template,
        "embeddings": embeddings,
    }


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 60)
    print("🚀 INSIGHTFACE EMPLOYEE TEMPLATE BUILDER")
    print("=" * 60)

    try:

        employees = get_employees()

    except Exception as e:

        print(
            f"❌ EMPLOYEE QUERY ERROR: {e}"
        )

        return

    print(
        f"👥 EMPLOYEES FOUND: "
        f"{len(employees)}"
    )

    templates = []

    for employee in employees:

        result = create_employee_template(
            employee
        )

        if result:

            templates.append(
                result
            )

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print()
    print("=" * 60)
    print("FINAL TEMPLATE SUMMARY")
    print("=" * 60)

    print(
        f"Employees with valid templates: "
        f"{len(templates)}/{len(employees)}"
    )

    for result in templates:

        employee = result["employee"]

        print(
            f"✅ {employee['full_name']} | "
            f"{len(result['embeddings'])} valid face images"
        )

    print()
    print("TEST COMPLETE")


if __name__ == "__main__":
    main()