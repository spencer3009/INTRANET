"""
OMR Scanner Service — OpenCV-based bubble sheet reader.
Detects filled bubbles from a photographed OMR sheet using alignment markers
and the bubble_map coordinate system generated in Phase 2.
"""
import io
import math
import logging
import numpy as np
import cv2

logger = logging.getLogger(__name__)

# Processing constants
PIXELS_PER_MM = 8  # Target resolution for warped image
BUBBLE_RADIUS_MM = 2.5
FILL_THRESHOLD = 0.35  # Minimum dark-pixel ratio to consider a bubble "filled"
MULTI_THRESHOLD = 0.35  # If 2+ bubbles exceed this, it's "multiple"
IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


def _order_corners(pts):
    """Order 4 points as: top-left, top-right, bottom-left, bottom-right."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]      # top-left has smallest sum
    rect[3] = pts[np.argmax(s)]      # bottom-right has largest sum
    rect[1] = pts[np.argmin(diff)]   # top-right has smallest difference
    rect[2] = pts[np.argmax(diff)]   # bottom-left has largest difference
    return rect


def _find_alignment_markers(gray):
    """
    Detect the 4 alignment marker squares in the image.
    Returns ordered corners (TL, TR, BL, BR) as float32 array, or None.
    """
    h, w = gray.shape[:2]

    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = max(200, (h * w) * 0.0002)
    max_area = (h * w) * 0.02

    candidates = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        x, y, cw, ch = cv2.boundingRect(cnt)
        aspect = cw / ch if ch > 0 else 0
        if 0.6 < aspect < 1.6:
            cx = x + cw / 2
            cy = y + ch / 2
            candidates.append((cx, cy, area))

    if len(candidates) < 4:
        return None

    corners_img = np.array([[0, 0], [w, 0], [0, h], [w, h]], dtype="float32")
    selected = []
    for corner in corners_img:
        best = None
        best_dist = float("inf")
        for c in candidates:
            dist = math.hypot(c[0] - corner[0], c[1] - corner[1])
            if dist < best_dist:
                best_dist = dist
                best = c
        if best and best_dist < max(h, w) * 0.3:
            selected.append([best[0], best[1]])

    if len(selected) != 4:
        return None

    return _order_corners(np.array(selected, dtype="float32"))


def _warp_perspective(gray, src_corners, bubble_map_markers):
    """
    Apply perspective correction using detected markers and known marker positions.
    Returns the warped grayscale image.
    """
    mk = bubble_map_markers
    tl = mk["top_left"]
    tr = mk["top_right"]
    bl = mk["bottom_left"]
    br = mk["bottom_right"]

    half_size_mm = tl["size"] / 2

    dst_points = np.array([
        [(tl["x"] + half_size_mm) * PIXELS_PER_MM, (tl["y"] + half_size_mm) * PIXELS_PER_MM],
        [(tr["x"] + half_size_mm) * PIXELS_PER_MM, (tr["y"] + half_size_mm) * PIXELS_PER_MM],
        [(bl["x"] + half_size_mm) * PIXELS_PER_MM, (bl["y"] + half_size_mm) * PIXELS_PER_MM],
        [(br["x"] + half_size_mm) * PIXELS_PER_MM, (br["y"] + half_size_mm) * PIXELS_PER_MM],
    ], dtype="float32")

    dst_w = int(bubble_map_markers.get("page_width_mm", 210) if "page_width_mm" in bubble_map_markers else 210)
    dst_h = int(bubble_map_markers.get("page_height_mm", 297) if "page_height_mm" in bubble_map_markers else 297)

    out_w = 210 * PIXELS_PER_MM
    out_h = 297 * PIXELS_PER_MM

    M = cv2.getPerspectiveTransform(src_corners, dst_points)
    warped = cv2.warpPerspective(gray, M, (out_w, out_h))
    return warped


def _read_bubbles(warped, bubble_map_bubbles, options_per_question):
    """
    Read each bubble's fill ratio from the warped (perspective-corrected) image.
    Returns dict of question -> {letter: fill_ratio}.
    """
    _, thresh = cv2.threshold(warped, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    radius_px = int(BUBBLE_RADIUS_MM * PIXELS_PER_MM)
    roi_size = radius_px * 2

    mask_circle = np.zeros((roi_size * 2, roi_size * 2), dtype="uint8")
    cv2.circle(mask_circle, (roi_size, roi_size), radius_px, 255, -1)

    results = {}
    for q_num_str, options in bubble_map_bubbles.items():
        q_fills = {}
        for letter, coords in options.items():
            cx = int(coords["x"] * PIXELS_PER_MM)
            cy = int(coords["y"] * PIXELS_PER_MM)

            y1 = max(0, cy - roi_size)
            y2 = min(thresh.shape[0], cy + roi_size)
            x1 = max(0, cx - roi_size)
            x2 = min(thresh.shape[1], cx + roi_size)

            roi = thresh[y1:y2, x1:x2]

            if roi.shape[0] != roi_size * 2 or roi.shape[1] != roi_size * 2:
                roi_resized = cv2.resize(roi, (roi_size * 2, roi_size * 2))
            else:
                roi_resized = roi

            masked = cv2.bitwise_and(roi_resized, roi_resized, mask=mask_circle)
            circle_pixels = cv2.countNonZero(mask_circle)
            filled_pixels = cv2.countNonZero(masked)
            fill_ratio = filled_pixels / circle_pixels if circle_pixels > 0 else 0

            q_fills[letter] = round(fill_ratio, 4)

        results[q_num_str] = q_fills

    return results


def _decide_answers(fill_ratios, answer_key, options_per_question):
    """
    Decide detected answers from fill ratios, compare with answer_key, compute score.
    """
    detected_answers = {}
    details = []
    score = 0
    total = len(answer_key)
    confidences = []

    for idx, correct_answer in enumerate(answer_key):
        q_num = str(idx + 1)
        fills = fill_ratios.get(q_num, {})

        sorted_opts = sorted(fills.items(), key=lambda x: x[1], reverse=True)

        if not sorted_opts:
            detected_answers[q_num] = None
            details.append({
                "question": idx + 1,
                "detected": None,
                "correct": correct_answer,
                "is_correct": False,
                "status": "blank",
            })
            continue

        top_letter, top_fill = sorted_opts[0]
        second_fill = sorted_opts[1][1] if len(sorted_opts) > 1 else 0

        if top_fill > FILL_THRESHOLD:
            above_threshold = [l for l, f in sorted_opts if f > MULTI_THRESHOLD]
            if len(above_threshold) > 1:
                detected = "MULTIPLE"
                status = "multiple"
                is_correct = False
            else:
                detected = top_letter
                is_correct = detected == correct_answer
                status = "correct" if is_correct else "incorrect"
                if is_correct:
                    score += 1

            confidences.append(top_fill - second_fill)
        else:
            detected = None
            status = "blank"
            is_correct = False

        detected_answers[q_num] = detected
        details.append({
            "question": idx + 1,
            "detected": detected,
            "correct": correct_answer,
            "is_correct": is_correct,
            "status": status,
        })

    percentage = round((score / total) * 100, 2) if total > 0 else 0
    confidence = round(sum(confidences) / len(confidences), 4) if confidences else 0

    return detected_answers, details, score, total, percentage, confidence


def process_omr_scan(image_bytes: bytes, bubble_map: dict, answer_key: list, options_per_question: int) -> dict:
    """
    Process an OMR sheet image and detect marked answers.
    """
    if len(image_bytes) > IMAGE_MAX_BYTES:
        return {"error": "La imagen excede el limite de 10MB."}

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"error": "No se pudo leer la imagen. Intente tomar la foto nuevamente."}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape[:2]
    mean_brightness = np.mean(gray)
    if mean_brightness < 40:
        return {"error": "La imagen esta muy oscura. Intente con mejor iluminacion."}
    if mean_brightness > 250:
        return {"error": "La imagen esta muy clara/sobreexpuesta. Intente con menos luz directa."}

    markers = bubble_map.get("markers", {})

    corners = _find_alignment_markers(gray)
    if corners is None:
        return {
            "error": "No se detectaron los 4 marcadores de alineacion. "
                     "Asegurese de que los 4 cuadrados negros de las esquinas sean visibles y la hoja este bien iluminada."
        }

    page_markers = {
        "top_left": markers.get("top_left", {"x": 10, "y": 10, "size": 8}),
        "top_right": markers.get("top_right", {"x": 192, "y": 10, "size": 8}),
        "bottom_left": markers.get("bottom_left", {"x": 10, "y": 279, "size": 8}),
        "bottom_right": markers.get("bottom_right", {"x": 192, "y": 279, "size": 8}),
    }

    try:
        warped = _warp_perspective(gray, corners, page_markers)
    except Exception as e:
        logger.error(f"Perspective warp failed: {e}")
        return {"error": "Error al corregir la perspectiva de la imagen. Intente tomar la foto mas de frente."}

    bubble_map_bubbles = bubble_map.get("bubbles", {})
    fill_ratios = _read_bubbles(warped, bubble_map_bubbles, options_per_question)

    detected_answers, details, score, total, percentage, confidence = _decide_answers(
        fill_ratios, answer_key, options_per_question
    )

    warnings = []
    if confidence < 0.15 and confidence > 0:
        warnings.append("La imagen puede tener baja calidad. Verifique los resultados.")

    return {
        "detected_answers": detected_answers,
        "score": score,
        "total": total,
        "percentage": percentage,
        "details": details,
        "confidence": confidence,
        "warnings": warnings,
    }
