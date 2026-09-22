
    try:

        # =====================================================
        # 1. VALIDATE ACTION
        # =====================================================

        action = action.strip().upper()

        if action not in ["TIME IN", "TIME OUT"]:
            return {
                "status": "Error",
                "message": "Invalid attendance action."
            }

        # =====================================================
        # 2. VERIFY KIOSK
        # =====================================================

        kiosk_response = (
            supabase
            .rpc(
                "verify_kiosk",
                {
                    "p_kiosk_code": kiosk_code
                }
            )
            .execute()
        )

        registered_kiosks = (
            kiosk_response.data or []
        )

        print(
            "🏪 KIOSK REGISTRATION RESULT:",
            registered_kiosks,
            flush=True
        )

        if not registered_kiosks:
            return {
                "status": "Error",
                "message": "This kiosk is not registered."
            }

        kiosk = registered_kiosks[0]

        if not kiosk.get("is_active"):
            return {
                "status": "Error",
                "message": "This kiosk is inactive."
            }

        print(
            "✅ REGISTERED KIOSK:",
            kiosk.get("kiosk_code"),
            flush=True
        )

        # =====================================================
        # 3. LOAD CAMERA FRAMES
        # =====================================================

        frames = []

        for file in files[:8]:

            contents = await file.read()

            npimg = np.frombuffer(
                contents,
                np.uint8
            )

            img = cv2.imdecode(
                npimg,
                cv2.IMREAD_COLOR
            )

            if img is None:
                continue

            # Keep the same processing size used
            # by the employee web verification.
            img = cv2.resize(
                img,
                (320, 240)
            )

            frames.append(img)

        print(
            "📸 KIOSK CAPTURED FRAMES:",
            len(frames),
            flush=True
        )

        if len(frames) < 2:
            return {
                "status": "Error",
                "message": "Not enough camera frames were captured."
            }

        # =====================================================
        # 4. MEDIAPIPE BLINK / LIVENESS
        #
        # Required sequence:
        # OPEN → CLOSED → OPEN
        # =====================================================

        ear_values = []

        for index, img in enumerate(frames):

            rgb = cv2.cvtColor(
                img,
                cv2.COLOR_BGR2RGB
            )

            result = face_mesh.process(rgb)

            if result.multi_face_landmarks:

                landmarks = (
                    result.multi_face_landmarks[0].landmark
                )

                h, w, _ = img.shape

                points = [
                    (
                        int(l.x * w),
                        int(l.y * h)
                    )
                    for l in landmarks
                ]

                left_eye = [
                    33,
                    160,
                    158,
                    133,
                    153,
                    144
                ]

                ear = eye_aspect_ratio(
                    points,
                    left_eye
                )

                ear_values.append(ear)

        print(
            "👁️ KIOSK EAR VALUES:",
            [round(e, 3) for e in ear_values],
            flush=True
        )

        if len(ear_values) < 2:
            return {
                "status": "Fake",
                "message": (
                    "Face was not detected properly. "
                    "Please position your face in the camera."
                )
            }

        # =====================================================
        # BLINK SEQUENCE
        # OPEN → CLOSED → OPEN
        # =====================================================

        OPEN_THRESHOLD = 0.23
        CLOSED_THRESHOLD = 0.22

        blink_detected = False
        open_before = False
        closed_during = False

        for ear in ear_values:

            # Eyes start open
            if not open_before:

                if ear > OPEN_THRESHOLD:
                    open_before = True

            # Eyes close
            elif not closed_during:

                if ear < CLOSED_THRESHOLD:
                    closed_during = True

            # Eyes open again
            else:

                if ear > OPEN_THRESHOLD:
                    blink_detected = True
                    break

        print(
            "👁️ KIOSK BLINK CHECK:",
            f"OPEN_BEFORE={open_before}",
            f"CLOSED={closed_during}",
            f"OPEN_AFTER={blink_detected}",
            flush=True
        )

        if not blink_detected:
            return {
                "status": "Fake",
                "message": (
                    "Please blink once naturally "
                    "during scanning."
                )
            }

        print(
            "✅ KIOSK BLINK VERIFIED",
            flush=True
        )

        # =====================================================
        # 5. SEND FRAMES TO INSIGHTFACE
        # =====================================================

        recognition_results = []

        # Keep all 8 frames for MediaPipe blink/liveness,
        # but use the same 4-frame InsightFace optimization
        # as Web Attendance to reduce verification time.
        recognition_indices = (
            [0, 2, 5, 7]
            if len(frames) >= 8
            else list(range(len(frames)))
        )

        recognition_frames = [
            (index, frames[index])
            for index in recognition_indices
        ]

        print(
            "🧠 KIOSK INSIGHTFACE RECOGNITION FRAMES:",
            [index + 1 for index, _ in recognition_frames],
            flush=True
        )

        completed_results = []

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(
                    recognize_insightface_frame,
                    index,
                    img
                )
                for index, img in recognition_frames
            ]

            for future in as_completed(futures):
                index, result, error = future.result()

                if error:
                    print(
                        f"❌ INSIGHTFACE FRAME {index + 1} ERROR:",
                        error,
                        flush=True
                    )
                    continue

                print(
                    f"🔎 INSIGHTFACE FRAME {index + 1}:",
                    result,
                    flush=True
                )

                if result is not None:
                    completed_results.append((index, result))

        completed_results.sort(key=lambda item: item[0])
        recognition_results = [
            {
                "result": result,
                "frame": frames[index]
            }
            for index, result in completed_results
        ]

        # =====================================================
        # 6. MAKE SURE INSIGHTFACE RESPONDED
        # =====================================================

        if not recognition_results:
            return {
                "status": "Error",
                "message": (
                    "Unable to connect to the "
                    "InsightFace recognition service."
                )
            }

        # =====================================================
        # 7. TEMPORAL VOTING
        # =====================================================

        employee_votes = {}

        for item in recognition_results:

            result = item["result"]

            if result.get("status") != "Match":
                continue

            # Current InsightFace response:
            #
            # "employee": {
            #     "id": "...",
            #     "full_name": "...",
            #     "branch_id": "...",
            #     "shift_id": "..."
            # }
            #
            # Also support the older flat response format.

            employee_data = (
                result.get("employee")
                or {}
            )

            employee_id = (
                employee_data.get("id")
                or result.get("employee_id")
            )

            full_name = (
                employee_data.get("full_name")
                or result.get("full_name")
            )

            if not employee_id or not full_name:
                continue

            employee_id = str(employee_id)

            if employee_id not in employee_votes:

                employee_votes[employee_id] = {
                    "employee": {
                        "id": employee_id,
                        "full_name": full_name,
                        "branch_id":
                            employee_data.get("branch_id"),
                        "shift_id":
                            employee_data.get("shift_id")
                    },
                    "votes": 0,
                    "distances": [],
                    "frames": []
                }

            employee_votes[
                employee_id
            ]["votes"] += 1

            distance = result.get("distance")

            if distance is not None:

                employee_votes[
                    employee_id
                ]["distances"].append(
                    float(distance)
                )

            employee_votes[
                employee_id
            ]["frames"].append(
                item["frame"]
            )

        # =====================================================
        # 8. NO RECOGNIZED EMPLOYEE
        # =====================================================

        if not employee_votes:

            print(
                "❌ KIOSK INSIGHTFACE: NO MATCH",
                flush=True
            )

            return {
                "status": "No Match",
                "message": "Face was not recognized."
            }

        # =====================================================
        # 9. RANK EMPLOYEES
        # =====================================================

        ranked_employees = sorted(
            employee_votes.values(),
            key=lambda item: (
                -item["votes"],
                np.median(item["distances"])
                if item["distances"]
                else 1.0
            )
        )

        best_result = ranked_employees[0]

        best_employee = best_result["employee"]
