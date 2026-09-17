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


headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
}


# ============================================================
# NORMALIZE
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


# ============================================================
# COSINE DISTANCE
# ============================================================

def cosine_distance(a, b):

    a = normalize_embedding(a)
    b = normalize_embedding(b)

    if a is None or b is None:
        return 1.0

    return float(
        1.0 - np.dot(a, b)
    )


# ============================================================
# GET EMPLOYEES
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
# GET STORAGE FILES
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

    return cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )


# ============================================================
# BUILD TEMPLATE
# ============================================================

def build_template(employee):

    name = employee["full_name"]

    folder = (
        "employees/"
        + name.strip().lower().replace(" ", "_")
    )

    files = get_storage_files(folder)

    embeddings = []

    for stored_file in files:

        file_name = stored_file.get("name")

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

        except Exception:
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

    return normalize_embedding(
        template
    )


# ============================================================
# LOAD TEMPLATES
# ============================================================

print()
print("=" * 60)
print("🚀 LOADING LIVE INSIGHTFACE TEMPLATES")
print("=" * 60)

employees = get_employees()

templates = []

for employee in employees:

    template = build_template(
        employee
    )

    if template is None:
        print(
            f"❌ No template: "
            f"{employee['full_name']}"
        )
        continue

    templates.append({
        "employee": employee,
        "template": template
    })

    print(
        f"✅ Template ready: "
        f"{employee['full_name']}"
    )


print()
print(
    f"🎯 TEMPLATES READY: "
    f"{len(templates)}"
)


# ============================================================
# OPEN WEBCAM
# ============================================================

camera = cv2.VideoCapture(0)

if not camera.isOpened():

    print(
        "❌ Unable to open webcam."
    )

    raise SystemExit


print()
print("=" * 60)
print("📷 LIVE INSIGHTFACE RECOGNITION")
print("=" * 60)
print("Press Q to quit.")
print()


# ============================================================
# LIVE LOOP
# ============================================================

while True:

    success, frame = camera.read()

    if not success:
        print(
            "❌ Unable to read camera."
        )
        break

    faces = insightface_app.get(
        frame
    )

    display_frame = frame.copy()

    if len(faces) == 0:

        cv2.putText(
            display_frame,
            "No face detected",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

    elif len(faces) > 1:

        cv2.putText(
            display_frame,
            "Multiple faces detected",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

    else:

        face = faces[0]

        embedding = normalize_embedding(
            face.embedding
        )

        best_employee = None
        best_distance = 1.0

        second_distance = 1.0

        # ====================================================
        # COMPARE AGAINST TEMPLATES
        # ====================================================

        distances = []

        for item in templates:

            distance = cosine_distance(
                embedding,
                item["template"]
            )

            distances.append({
                "employee": item["employee"],
                "distance": distance
            })

        distances.sort(
            key=lambda x: x["distance"]
        )

        if distances:

            best_employee = (
                distances[0]["employee"]
            )

            best_distance = (
                distances[0]["distance"]
            )

            if len(distances) > 1:

                second_distance = (
                    distances[1]["distance"]
                )

        # ====================================================
        # DISPLAY
        # ====================================================

        box = face.bbox.astype(int)

        x1, y1, x2, y2 = box

        cv2.rectangle(
            display_frame,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

        print("\n--- LIVE DISTANCES ---")

        for item in distances:
            print(
                f"{item['employee']['full_name']}: "
                f"{item['distance']:.4f}"
            )

        print("----------------------")

        RECOGNITION_THRESHOLD = 0.45

        if best_employee and best_distance <= RECOGNITION_THRESHOLD:

            name = best_employee[
                "full_name"
            ]

            cv2.putText(
                display_frame,
                f"Detected: {name}",
                (x1, max(30, y1 - 35)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

            cv2.putText(
                display_frame,
                f"Distance: {best_distance:.4f}",
                (x1, max(55, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

            print(
                f"\rDetected: {name} | "
                f"Distance: {best_distance:.4f} | "
                f"Second: {second_distance:.4f}",
                end="",
                flush=True
            )

        else:

            cv2.putText(
                display_frame,
                "Unknown Face",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
                2
            )

            print(
                f"\rUnknown Face | "
                f"Best Distance: {best_distance:.4f}",
                end="",
                flush=True
            )
            

    cv2.imshow(
        "CIBO - InsightFace Live Recognition",
        display_frame
    )

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):
        break
    else:

        cv2.putText(
            display_frame,
            "Unknown Face",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )


camera.release()

cv2.destroyAllWindows()

print()
print()
print("TEST COMPLETE")