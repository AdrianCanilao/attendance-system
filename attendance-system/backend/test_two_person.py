import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis


# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

PERSON_A = "test_faces/adrian"
PERSON_B = "test_faces/alwyn"


# --------------------------------------------------
# INSIGHTFACE
# --------------------------------------------------

print("Loading InsightFace...")

app = FaceAnalysis(
    name="buffalo_l"
)

app.prepare(
    ctx_id=0,
    det_size=(640, 640)
)

print("InsightFace READY")
print()


# --------------------------------------------------
# LOAD EMBEDDINGS
# --------------------------------------------------

def load_embeddings(folder):

    embeddings = []
    names = []

    files = sorted(
        f for f in os.listdir(folder)
        if f.lower().endswith(
            (".jpg", ".jpeg", ".png")
        )
    )

    for filename in files:

        path = os.path.join(
            folder,
            filename
        )

        image = cv2.imread(path)

        if image is None:
            print(
                f"{filename}: ERROR reading image"
            )
            continue

        faces = app.get(image)

        if len(faces) == 0:
            print(
                f"{filename}: NO FACE"
            )
            continue

        if len(faces) > 1:
            print(
                f"{filename}: MULTIPLE FACES"
            )
            continue

        embedding = faces[0].embedding.astype(
            np.float32
        )

        norm = np.linalg.norm(embedding)

        if norm == 0:
            print(
                f"{filename}: INVALID EMBEDDING"
            )
            continue

        embedding = embedding / norm

        embeddings.append(embedding)
        names.append(filename)

    return np.array(embeddings), names


print("Loading PERSON A...")
A_embeddings, A_names = load_embeddings(PERSON_A)

print()

print("Loading PERSON B...")
B_embeddings, B_names = load_embeddings(PERSON_B)

print()

print(
    f"Person A valid samples: "
    f"{len(A_embeddings)}/10"
)

print(
    f"Person B valid samples: "
    f"{len(B_embeddings)}/10"
)


if len(A_embeddings) < 3:
    print("ERROR: Not enough Person A samples.")
    exit()

if len(B_embeddings) < 3:
    print("ERROR: Not enough Person B samples.")
    exit()


# --------------------------------------------------
# CREATE TEMPLATES
# --------------------------------------------------

def create_template(embeddings):

    template = np.mean(
        embeddings,
        axis=0
    )

    template = template / np.linalg.norm(
        template
    )

    return template


A_template = create_template(
    A_embeddings
)

B_template = create_template(
    B_embeddings
)


# --------------------------------------------------
# COSINE DISTANCE
# --------------------------------------------------

def cosine_distance(a, b):

    similarity = np.dot(a, b)

    return float(
        1.0 - similarity
    )


# --------------------------------------------------
# PERSON A TEST
# --------------------------------------------------

print()
print("=" * 60)
print("PERSON A SAMPLES")
print("=" * 60)

A_results = []

for name, embedding in zip(
    A_names,
    A_embeddings
):

    distance_A = cosine_distance(
        embedding,
        A_template
    )

    distance_B = cosine_distance(
        embedding,
        B_template
    )

    if distance_A < distance_B:
        result = "PERSON A"
    else:
        result = "PERSON B"

    A_results.append(
        result == "PERSON A"
    )

    print(
        f"{name}: "
        f"A={distance_A:.4f} | "
        f"B={distance_B:.4f} | "
        f"RESULT={result}"
    )


# --------------------------------------------------
# PERSON B TEST
# --------------------------------------------------

print()
print("=" * 60)
print("PERSON B SAMPLES")
print("=" * 60)

B_results = []

for name, embedding in zip(
    B_names,
    B_embeddings
):

    distance_A = cosine_distance(
        embedding,
        A_template
    )

    distance_B = cosine_distance(
        embedding,
        B_template
    )

    if distance_A < distance_B:
        result = "PERSON A"
    else:
        result = "PERSON B"

    B_results.append(
        result == "PERSON B"
    )

    print(
        f"{name}: "
        f"A={distance_A:.4f} | "
        f"B={distance_B:.4f} | "
        f"RESULT={result}"
    )


# --------------------------------------------------
# TEMPLATE-TO-TEMPLATE DISTANCE
# --------------------------------------------------

template_distance = cosine_distance(
    A_template,
    B_template
)


# --------------------------------------------------
# ACCURACY
# --------------------------------------------------

A_correct = sum(A_results)
B_correct = sum(B_results)

total_correct = A_correct + B_correct
total_samples = len(A_results) + len(B_results)

accuracy = (
    total_correct / total_samples
) * 100


# --------------------------------------------------
# SUMMARY
# --------------------------------------------------

print()
print("=" * 60)
print("FINAL SUMMARY")
print("=" * 60)

print(
    f"Person A correct: "
    f"{A_correct}/{len(A_results)}"
)

print(
    f"Person B correct: "
    f"{B_correct}/{len(B_results)}"
)

print(
    f"Overall classification: "
    f"{total_correct}/{total_samples} "
    f"({accuracy:.1f}%)"
)

print()

print(
    f"Template-to-template distance: "
    f"{template_distance:.4f}"
)

print()
print("TEST COMPLETE")