import os
import cv2
import numpy as np
import requests

from insightface_engine import insightface_app


SUPABASE_URL = "https://gncvkqqmreufoarakjmj.supabase.co"

EMPLOYEE_FOLDER = "employees/alwyn_villarriez"

FILES = [
    "face_1789266902805.jpg",
    "face_1789266903766.jpg",
    "face_1789266904261.jpg",
]

OUTPUT_FOLDER = "registered_alwyn"


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

    print(
        f"HTTP {response.status_code}: "
        f"{file_path}"
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


os.makedirs(
    OUTPUT_FOLDER,
    exist_ok=True
)


print("=" * 60)
print("CHECKING ALWYN'S ACTUAL REGISTERED IMAGES")
print("=" * 60)


for file_name in FILES:

    file_path = (
        f"{EMPLOYEE_FOLDER}/{file_name}"
    )

    image = download_image(
        file_path
    )

    if image is None:

        print(
            f"❌ FAILED: {file_name}"
        )

        continue

    output_path = os.path.join(
        OUTPUT_FOLDER,
        file_name
    )

    cv2.imwrite(
        output_path,
        image
    )

    print(
        f"✅ SAVED: {output_path}"
    )

    # ========================================================
    # TEST WITH INSIGHTFACE
    # ========================================================

    faces = insightface_app.get(
        image
    )

    print(
        f"   Faces detected: {len(faces)}"
    )

    if len(faces) == 1:

        print(
            f"   Detection confidence: "
            f"{faces[0].det_score:.4f}"
        )

        print(
            "   ✅ InsightFace recognized "
            "one valid face"
        )

    elif len(faces) == 0:

        print(
            "   ❌ No face detected"
        )

    else:

        print(
            f"   ❌ Multiple faces detected: "
            f"{len(faces)}"
        )


print()
print("=" * 60)
print("CHECK COMPLETE")
print("=" * 60)
print()
print(
    f"Open this folder:"
)
print(
    os.path.abspath(OUTPUT_FOLDER)
)