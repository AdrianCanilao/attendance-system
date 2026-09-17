import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis

PERSON_A = "test_faces/adrian"
PERSON_B = "test_faces/alwyn"

print("Loading InsightFace...")

app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=0, det_size=(640, 640))

print("InsightFace READY")
print("Building templates...")


def load_embeddings(folder):
    embeddings = []

    files = sorted(
        f for f in os.listdir(folder)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )

    for filename in files:
        path = os.path.join(folder, filename)
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

    return np.array(embeddings)


def create_template(embeddings):
    template = np.mean(embeddings, axis=0)
    template = template / np.linalg.norm(template)
    return template


def cosine_distance(a, b):
    return float(1.0 - np.dot(a, b))


A_embeddings = load_embeddings(PERSON_A)
B_embeddings = load_embeddings(PERSON_B)

print(f"Person A samples: {len(A_embeddings)}")
print(f"Person B samples: {len(B_embeddings)}")

if len(A_embeddings) < 3 or len(B_embeddings) < 3:
    print("ERROR: Not enough valid samples.")
    exit()

A_template = create_template(A_embeddings)
B_template = create_template(B_embeddings)

print("Templates READY")
print()
print("Opening camera...")
print()
print("Person A = ADRIAN")
print("Person B = SECOND PERSON")
print()
print("Have ONE person at a time stand in front of the camera.")
print("Press Q to quit.")


cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("ERROR: Could not open camera.")
    exit()


while True:

    ret, frame = cap.read()

    if not ret:
        print("ERROR: Could not read camera.")
        break

    faces = app.get(frame)

    if len(faces) == 0:

        cv2.putText(
            frame,
            "NO FACE",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 0, 255),
            2
        )

    elif len(faces) > 1:

        cv2.putText(
            frame,
            "MULTIPLE FACES - ONE AT A TIME",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2
        )

    else:

        face = faces[0]

        embedding = face.embedding.astype(np.float32)

        norm = np.linalg.norm(embedding)

        if norm != 0:

            embedding = embedding / norm

            distance_A = cosine_distance(
                embedding,
                A_template
            )

            distance_B = cosine_distance(
                embedding,
                B_template
            )

            if distance_A < distance_B:
                identity = "ADRIAN"
                identity_distance = distance_A
            else:
                identity = "SECOND PERSON"
                identity_distance = distance_B

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
                f"Detected: {identity}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                f"Adrian: {distance_A:.4f}",
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            cv2.putText(
                frame,
                f"Person 2: {distance_B:.4f}",
                (20, 110),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            cv2.putText(
                frame,
                f"Best distance: {identity_distance:.4f}",
                (20, 145),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

    cv2.imshow(
        "InsightFace Two-Person Test",
        frame
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


cap.release()
cv2.destroyAllWindows()

print()
print("Two-person live test finished.")