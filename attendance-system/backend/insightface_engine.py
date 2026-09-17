import cv2
import numpy as np
import requests

from insightface.app import FaceAnalysis


# ============================================================
# INSIGHTFACE MODEL
# ============================================================

print("🔥 Loading InsightFace buffalo_l model...", flush=True)

insightface_app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"]
)

insightface_app.prepare(
    ctx_id=0,
    det_size=(640, 640)
)

print("✅ InsightFace model ready", flush=True)


# ============================================================
# EMBEDDING NORMALIZATION
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
# DETECT + EMBED ONE IMAGE
# ============================================================

def get_face_embedding(image):

    if image is None:
        return None

    faces = insightface_app.get(image)

    if not faces:
        return None

    # We require exactly one face.
    if len(faces) != 1:
        return None

    face = faces[0]

    embedding = face.embedding

    return normalize_embedding(embedding)


# ============================================================
# DETECT FACE INFORMATION
# ============================================================

def detect_faces(image):

    if image is None:
        return []

    return insightface_app.get(image)