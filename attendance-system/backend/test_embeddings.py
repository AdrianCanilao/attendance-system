import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis

FOLDER = "test_faces/adrian"

print("Loading InsightFace...")
app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=0, det_size=(640, 640))

print("InsightFace READY")
print()

embeddings = []
names = []

files = sorted(
    f for f in os.listdir(FOLDER)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
)

for filename in files:
    path = os.path.join(FOLDER, filename)
    image = cv2.imread(path)

    if image is None:
        print(f"{filename}: ERROR - could not read image")
        continue

    faces = app.get(image)

    if len(faces) == 0:
        print(f"{filename}: NO FACE")
        continue

    if len(faces) > 1:
        print(f"{filename}: MULTIPLE FACES")
        continue

    face = faces[0]

    embedding = face.embedding.astype(np.float32)

    # Normalize
    norm = np.linalg.norm(embedding)

    if norm == 0:
        print(f"{filename}: INVALID EMBEDDING")
        continue

    embedding = embedding / norm

    embeddings.append(embedding)
    names.append(filename)

    print(
        f"{filename}: "
        f"detector confidence={face.det_score:.3f}"
    )

print()
print(f"Valid embeddings: {len(embeddings)}/{len(files)}")

if len(embeddings) < 3:
    print("Not enough valid embeddings.")
    exit()

embeddings = np.array(embeddings)

print()
print("CREATING ADRIAN TEMPLATE")
print("-" * 40)

# Average all normalized embeddings
template = np.mean(embeddings, axis=0)

# Normalize template
template = template / np.linalg.norm(template)

print("Template created.")
print()

print("DISTANCE FROM ADRIAN TEMPLATE")
print("-" * 40)

distances = []

for name, embedding in zip(names, embeddings):
    similarity = np.dot(embedding, template)
    distance = float(1.0 - similarity)

    distances.append(distance)

    print(
        f"{name}: "
        f"distance={distance:.4f}"
    )

print()
print("SUMMARY")
print("-" * 40)

print(f"Best sample:    {min(distances):.4f}")
print(f"Worst sample:   {max(distances):.4f}")
print(f"Average:        {np.mean(distances):.4f}")
print(f"Median:         {np.median(distances):.4f}")
print()

# Rank samples from best to worst
ranking = sorted(
    zip(names, distances),
    key=lambda x: x[1]
)

print("SAMPLE RANKING")
print("-" * 40)

for position, (name, distance) in enumerate(ranking, 1):
    print(
        f"{position:2}. {name} -> {distance:.4f}"
    )