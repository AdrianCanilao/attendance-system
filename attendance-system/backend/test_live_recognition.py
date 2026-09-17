import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis

FOLDER = "test_faces/adrian"

print("Loading InsightFace...")

app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=0, det_size=(640, 640))

print("InsightFace READY")
print("Building Adrian template...")

# --------------------------------------------------
# LOAD ADRIAN ENROLLMENT IMAGES
# --------------------------------------------------

embeddings = []

files = sorted(
    f for f in os.listdir(FOLDER)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
)

for filename in files:

    path = os.path.join(FOLDER, filename)

    image = cv2.imread(path)

    if image is None:
        continue

    faces = app.get(image)

    if len(faces) != 1:
        continue

    embedding = faces[0].embedding.astype(np.float32)

    norm = np.linalg.norm(embedding)

    if norm == 0:
        continue

    embedding = embedding / norm

    embeddings.append(embedding)


if len(embeddings) < 3:
    print("ERROR: Not enough valid Adrian samples.")
    exit()


# --------------------------------------------------
# CREATE TEMPLATE
# --------------------------------------------------

embeddings = np.array(embeddings)

template = np.mean(embeddings, axis=0)

template = template / np.linalg.norm(template)

print(f"Adrian samples used: {len(embeddings)}")
print("Adrian template READY")
print()
print("Opening camera...")
print("Press Q to quit.")
print()


# --------------------------------------------------
# CAMERA
# --------------------------------------------------

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print("ERROR: Could not open camera.")
    exit()


while True:

    ret, frame = cap.read()

    if not ret:
        break


    faces = app.get(frame)


    if len(faces) == 0:

        cv2.putText(
            frame,
            "NO FACE",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )


    elif len(faces) > 1:

        cv2.putText(
            frame,
            "MULTIPLE FACES",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )


    else:

        face = faces[0]

        embedding = face.embedding.astype(np.float32)

        norm = np.linalg.norm(embedding)

        if norm != 0:

            embedding = embedding / norm

            similarity = np.dot(
                embedding,
                template
            )

            distance = float(1.0 - similarity)

            x1, y1, x2, y2 = map(
                int,
                face.bbox
            )

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                f"Distance: {distance:.4f}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                "Detected: ADRIAN",
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )


    cv2.imshow(
        "InsightFace Live Recognition Test",
        frame
    )


    if cv2.waitKey(1) & 0xFF == ord("q"):

        break


cap.release()

cv2.destroyAllWindows()

print()
print("Live recognition test finished.")