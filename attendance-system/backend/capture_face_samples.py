import cv2
import os
import time

PERSON = input("Enter person name (adrian or alwyn): ").strip().lower()

if PERSON not in ["adrian", "alwyn"]:
    print("ERROR: Enter only 'adrian' or 'alwyn'.")
    exit()

folder = os.path.join("test_faces", PERSON)
os.makedirs(folder, exist_ok=True)

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("ERROR: Could not open camera.")
    exit()

print()
print(f"Capturing samples for: {PERSON.upper()}")
print("Look directly at the camera.")
print("Keep your face inside the box.")
print("Press SPACE to capture a sample.")
print("Press Q to quit.")
print()

count = len(os.listdir(folder))

while True:
    ret, frame = cap.read()

    if not ret:
        print("ERROR: Could not read camera.")
        break

    cv2.putText(
        frame,
        f"{PERSON.upper()} - Samples: {count}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 255, 0),
        2
    )

    cv2.putText(
        frame,
        "SPACE = Capture | Q = Quit",
        (20, 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    cv2.imshow("Face Sample Capture", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):
        break

    if key == 32:
        filename = os.path.join(folder, f"{count + 1:02d}.jpg")
        cv2.imwrite(filename, frame)
        count += 1

        print(f"Saved: {filename}")

        time.sleep(0.5)

cap.release()
cv2.destroyAllWindows()

print(f"\nFinished. {count} samples saved for {PERSON.upper()}.")