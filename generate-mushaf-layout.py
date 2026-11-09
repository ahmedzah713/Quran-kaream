#!/usr/bin/env python3
"""Build precise per-ayah pixel regions from the Madinah Mushaf scans shown by the app.

Requires Python, NumPy and OpenCV. Scans are cached temporarily under /tmp; only compact
geometry is written into the app bundle. Run all pages from the repository root:

    python3 scripts/generate-mushaf-layout.py

A subset may be generated for calibration diagnostics with --pages 2,3,604.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://quran.islam-db.com/data/pages/quranpages_1024/images/page{page:03d}.png"
CACHE = Path("/tmp/quran-mushaf-calibration")
INPUT = ROOT / "data/mushaf-pages.json"
OUTPUT = ROOT / "data/mushaf-verse-layout.json"
WIDTH, HEIGHT = 1024, 1656
PAGE_1_CENTERS = [60, 576, 664, 751, 839, 926, 1023, 1101]
PAGE_2_CENTERS = [60, 480, 669, 756, 844, 931, 1028, 1106]
ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def local_source(page: int) -> Path | None:
    return ROOT / f"assets/images/mushaf-page-{page:03d}-centered.png" if page in (1, 2) else None


def download_page(page: int) -> Path:
    local = local_source(page)
    if local is not None:
        return local
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"page-{page:03d}.png"
    if path.exists() and path.stat().st_size > 1000:
        return path
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            request = Request(SOURCE.format(page=page), headers={"User-Agent": "QuranMushafCalibration/1.0"})
            with urlopen(request, timeout=30) as response:
                data = response.read()
            if len(data) < 1000:
                raise ValueError(f"page {page}: unexpectedly small scan ({len(data)} bytes)")
            path.write_bytes(data)
            return path
        except Exception as error:
            last_error = error
            time.sleep(0.25 * (attempt + 1))
    raise RuntimeError(f"page {page}: scan download failed: {last_error}")


def verse_numbers(text: str) -> list[int]:
    return [int(value.translate(ARABIC_DIGITS)) for value in re.findall(r"[٠-٩۰-۹0-9]+", text)]


def verse_range(line: dict) -> tuple[int, int, int, int] | None:
    match = re.fullmatch(r"(\d+):(\d+)-(\d+):(\d+)", line.get("verseRange") or "")
    if not match:
        return None
    return tuple(map(int, match.groups()))  # type: ignore[return-value]


def detect_verse_markers(
    alpha: np.ndarray,
    use_component_fallback: bool = False,
    expected_count: int | None = None,
) -> tuple[np.ndarray, list[dict[str, int]]]:
    binary = (alpha > 0).astype(np.uint8)
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    markers: list[dict[str, int]] = []
    weak_candidates: list[tuple[float, dict[str, int]]] = []
    if hierarchy is None:
        return binary, markers

    for contour_index, contour in enumerate(contours):
        parent_index = int(hierarchy[0][contour_index][3])
        if parent_index < 0:
            continue
        depth = 0
        parent = parent_index
        while parent >= 0:
            depth += 1
            parent = int(hierarchy[0][parent][3])
        if depth % 2 != 1:
            continue
        x, y, width, height = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)
        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * np.pi * area / (perimeter * perimeter + 1e-9)
        if not (44 <= width <= 60 and 44 <= height <= 60 and 0.90 <= width / height <= 1.12 and 1200 <= area <= 2800):
            continue
        candidate = {"x": int(round(x + width / 2)), "y": int(round(y + height / 2)), "radiusX": 41}
        if circularity >= 0.78:
            markers.append(candidate)
        elif circularity >= 0.22:
            parent_contour = contours[parent_index]
            parent_x, parent_y, parent_width, parent_height = cv2.boundingRect(parent_contour)
            parent_area = cv2.contourArea(parent_contour)
            if (
                65 <= parent_width <= 90 and 55 <= parent_height <= 90 and
                500 <= parent_area <= 5000
            ):
                weak_candidates.append((circularity, candidate))

    if expected_count is not None and len(markers) < expected_count:
        for _, candidate in sorted(weak_candidates, key=lambda item: item[0], reverse=True):
            if any(abs(candidate["x"] - item["x"]) < 12 and abs(candidate["y"] - item["y"]) < 12 for item in markers):
                continue
            markers.append(candidate)
            if len(markers) >= expected_count:
                break
    markers.sort(key=lambda marker: (marker["y"], -marker["x"]))
    text_mask = binary.copy()
    for marker in markers:
        cv2.circle(text_mask, (marker["x"], marker["y"]), 42, 0, thickness=-1)

    # The two bundled opening-page scans use a different decorative artwork, so
    # their rings may not have closed inner contours at the lower local resolution.
    if use_component_fallback:
        count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        for component_id in range(1, count):
            if expected_count is not None and len(markers) >= expected_count:
                break
            x, y, width, height, area = (int(value) for value in stats[component_id])
            if not (54 <= width <= 108 and 54 <= height <= 108 and 0.76 <= width / height <= 1.30 and 550 <= area <= 2600):
                continue
            local_y, local_x = np.where(labels[y : y + height, x : x + width] == component_id)
            if len(local_x) < 300:
                continue
            pixel_x, pixel_y = local_x + x, local_y + y
            center_x, center_y = x + width / 2, y + height / 2
            radius = min(width, height) * 0.45
            distance = np.hypot(pixel_x - center_x, pixel_y - center_y)
            angle = np.arctan2(pixel_y - center_y, pixel_x - center_x)
            ring = (distance >= radius - 3.2) & (distance <= radius + 3.2)
            sectors = np.unique(((angle[ring] + np.pi) * 36 / (2 * np.pi)).astype(np.int32) % 36).size
            if sectors < 25:
                continue
            center = (int(round(center_x)), int(round(center_y)))
            if any(abs(center[0] - item["x"]) < 12 and abs(center[1] - item["y"]) < 12 for item in markers):
                continue
            markers.append({"x": center[0], "y": center[1], "radiusX": int(round(width / 2 + 1))})
    markers.sort(key=lambda marker: (marker["y"], -marker["x"]))
    text_mask = binary.copy()
    for marker in markers:
        cv2.circle(text_mask, (marker["x"], marker["y"]), marker["radiusX"] + 1, 0, thickness=-1)
    return text_mask, markers


def line_centers(page: int, lines: list[dict], markers: list[dict[str, int]]) -> list[float]:
    if page == 1:
        return PAGE_1_CENTERS[: len(lines)]
    if page == 2:
        return PAGE_2_CENTERS[: len(lines)]
    centers = [65.0 + index * 106.6 for index in range(len(lines))]
    if len(lines) < 2 or len(markers) < 2:
        return centers

    default_matches = sum(
        min(abs(centers[index] - marker["y"]) for index in range(len(centers))) <= 38
        for marker in markers
    )

    # Some pages include an unlisted surah title and basmala above the first
    # verse row. Fit a 15-line grid against the marker clusters instead of
    # assuming every page starts at the same vertical offset.
    best: tuple[int, int, float, float, float] | None = None
    best_intercept = 65.0
    best_slope = 106.6
    for slope in np.arange(103.0, 110.1, 0.5):
        for intercept in np.arange(0.0, 401.0, 2.0):
            assigned: dict[int, list[float]] = {}
            residual = 0.0
            for marker in markers:
                index = int(round((marker["y"] - intercept) / slope))
                difference = abs(marker["y"] - (intercept + slope * index))
                if 0 <= index < len(lines) and difference <= 38:
                    assigned.setdefault(index, []).append(float(marker["y"]))
                    residual += difference
            score = (sum(len(values) for values in assigned.values()), len(assigned), -residual, -abs(intercept - 65.0), slope)
            if best is None or score > best:
                best = score
                best_intercept = float(intercept)
                best_slope = float(slope)

    anchors: list[tuple[int, float]] = []
    if best is not None:
        if best[0] <= default_matches:
            return centers
        for index in range(len(lines)):
            row = [marker["y"] for marker in markers if abs(marker["y"] - (best_intercept + best_slope * index)) <= 38]
            if row:
                anchors.append((index, float(np.mean(row))))
    if len(anchors) >= 2:
        indices = np.array([point[0] for point in anchors], dtype=np.float64)
        positions = np.array([point[1] for point in anchors], dtype=np.float64)
        slope, intercept = np.polyfit(indices, positions, 1)
        if 100 <= slope <= 112 and -10 <= intercept <= 410:
            centers = [float(intercept + slope * index) for index in range(len(lines))]
        for index, position in anchors:
            centers[index] = position
    return centers


def row_box(mask: np.ndarray, top: float, bottom: float) -> dict[str, int] | None:
    y0 = max(0, min(HEIGHT - 1, int(np.floor(top))))
    y1 = max(y0 + 1, min(HEIGHT, int(np.ceil(bottom))))
    crop = mask[y0:y1]
    active_rows = np.flatnonzero(crop.sum(axis=1) > 0)
    if not active_rows.size:
        return None
    top_ink = y0 + int(active_rows[0])
    bottom_ink = y0 + int(active_rows[-1]) + 1
    active_columns = np.flatnonzero(mask[top_ink:bottom_ink].sum(axis=0) > 0)
    if not active_columns.size:
        return None
    left, right = int(active_columns[0]), int(active_columns[-1]) + 1
    return {"x": left, "y": top_ink, "width": right - left, "height": bottom_ink - top_ink}


def basmala_box(mask: np.ndarray, top: float, bottom: float) -> dict[str, int] | None:
    """Tight pixel bounds for the centered basmala, excluding the frame rules."""
    y0 = max(0, min(HEIGHT - 1, int(np.floor(top))))
    y1 = max(y0 + 1, min(HEIGHT, int(np.ceil(bottom))))
    x0, x1 = 200, 824
    crop = mask[y0:y1, x0:x1]
    count, _, stats, _ = cv2.connectedComponentsWithStats(crop, connectivity=8)
    components = [
        (int(x), int(y), int(width), int(height))
        for x, y, width, height, area in stats[1:count]
        if area >= 5 and 4 <= height <= 80 and width <= 400
    ]
    if not components:
        return None
    left = min(item[0] for item in components)
    top_ink = min(item[1] for item in components)
    right = max(item[0] + item[2] for item in components)
    bottom_ink = max(item[1] + item[3] for item in components)
    # A full-width box usually means the scan supplied only an ornament/rule, not Basmala ink.
    if right - left > 650 or bottom_ink - top_ink > 90:
        return None
    return {"x": x0 + left, "y": y0 + top_ink, "width": right - left, "height": bottom_ink - top_ink}


def add_segment(areas: dict[str, list[dict[str, int]]], sura: int, ayah: int, left: int, right: int, y: int, height: int) -> None:
    if right <= left or height <= 0:
        return
    key = f"{sura}:{ayah}"
    areas.setdefault(key, []).append({"x": left, "y": y, "width": right - left, "height": height})


def calibrate_page(page: int, record: dict, basmala_suras: dict[int, int]) -> tuple[dict, list[str]]:
    image = cv2.imread(str(download_page(page)), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[:2] != (HEIGHT, WIDTH) or image.shape[2] != 4:
        raise ValueError(f"page {page}: expected a {WIDTH}x{HEIGHT} transparent PNG scan")
    lines = record["lines"]
    metadata_numerals = [number for line in lines for number in verse_numbers(line.get("text", ""))]
    text_mask, markers = detect_verse_markers(
        image[:, :, 3],
        use_component_fallback=page in (1, 2),
        expected_count=len(metadata_numerals),
    )
    centers = line_centers(page, lines, markers)
    errors: list[str] = []

    # The text metadata can wrap a verse across two adjacent records. Build a
    # unique in-reading-order verse list from those ranges, then pair it with
    # the physically detected circles (top-to-bottom, then right-to-left).
    verse_sequence: list[tuple[int, int]] = []
    seen_verses: set[tuple[int, int]] = set()
    for line in lines:
        bounds = verse_range(line)
        if bounds is None:
            continue
        start_sura, start_ayah, end_sura, end_ayah = bounds
        if start_sura != end_sura or start_ayah > end_ayah or end_ayah - start_ayah > 8:
            errors.append(f"page {page}: unsupported range {line.get('verseRange')}")
            continue
        for ayah_number in range(start_ayah, end_ayah + 1):
            ref = (start_sura, ayah_number)
            if ref not in seen_verses:
                seen_verses.add(ref)
                verse_sequence.append(ref)

    if len(metadata_numerals) != len(markers):
        errors.append(f"page {page}: {len(metadata_numerals)} verse numerals in page data but {len(markers)} printed number rings detected")
    if len(verse_sequence) != len(markers):
        errors.append(f"page {page}: {len(verse_sequence)} distinct verse references but {len(markers)} printed number rings detected")
    if len(verse_sequence) == len(markers):
        for marker, (sura_id, ayah_number) in zip(markers, verse_sequence):
            marker["suraId"] = sura_id
            marker["ayahNumber"] = ayah_number

    row_markers: dict[int, list[dict[str, int]]] = {index: [] for index in range(len(lines))}
    for marker in markers:
        nearest = min(range(len(centers)), key=lambda index: abs(centers[index] - marker["y"]))
        if abs(centers[nearest] - marker["y"]) > 50:
            errors.append(f"page {page}: a printed number ring at y={marker['y']} is not aligned to a printed row")
            continue
        marker["rowIndex"] = nearest
        row_markers[nearest].append(marker)

    areas: dict[str, list[dict[str, int]]] = {}
    basmala_areas: dict[str, dict[str, int]] = {}
    for line_index, line in enumerate(lines):
        top = (centers[line_index - 1] + centers[line_index]) / 2 if line_index else 0
        bottom = (centers[line_index] + centers[line_index + 1]) / 2 if line_index + 1 < len(centers) else HEIGHT
        if line.get("type") == "basmala" and line_index in basmala_suras:
            if page == 2:
                top = max(0, centers[line_index] + 40)
                bottom = min(HEIGHT, centers[line_index] + 110)
            elif line_index == 0:
                top = max(0, centers[line_index] - 45)
                bottom = min(HEIGHT, centers[line_index] + 50)
            else:
                top = max(0, centers[line_index] - 35)
                bottom = min(HEIGHT, centers[line_index] + 50)
            box = basmala_box(text_mask, top, bottom)
            if box is None:
                errors.append(f"page {page}: printed basmala for surah {basmala_suras[line_index]} was not detected")
            else:
                basmala_areas[str(basmala_suras[line_index])] = box
            continue
        if verse_range(line) is None:
            continue
        box = row_box(text_mask, top, bottom)
        if box is None:
            continue

        left_edge = box["x"]
        right_edge = left_edge + box["width"]
        row = row_markers.get(line_index, [])
        if not row:
            next_marker = next((marker for marker in markers if marker.get("rowIndex", -1) > line_index), None)
            if next_marker and "suraId" in next_marker and "ayahNumber" in next_marker:
                add_segment(areas, next_marker["suraId"], next_marker["ayahNumber"], left_edge, right_edge, box["y"], box["height"])
            continue

        row.sort(key=lambda marker: marker["x"], reverse=True)
        for marker in row:
            if "suraId" not in marker or "ayahNumber" not in marker:
                continue
            number = marker["ayahNumber"]
            # A verse-number medallion closes the text immediately to its right.
            # The next verse continues to its left; RTL rows may begin with a
            # medallion whose corresponding words ended on the preceding row.
            marker_right = min(right_edge, marker["x"] + marker["radiusX"])
            marker_left = max(left_edge, marker["x"] - marker["radiusX"])
            add_segment(areas, marker["suraId"], number, marker_right, right_edge, box["y"], box["height"])
            right_edge = min(right_edge, marker_left)

        last_marker = row[-1]
        try:
            verse_index = verse_sequence.index((last_marker["suraId"], last_marker["ayahNumber"]))
            trailing_ref = verse_sequence[verse_index + 1] if verse_index + 1 < len(verse_sequence) else None
        except (KeyError, ValueError):
            trailing_ref = None
        if trailing_ref and right_edge - left_edge > 24:
            add_segment(areas, trailing_ref[0], trailing_ref[1], left_edge, right_edge, box["y"], box["height"])

    result = {"areas": areas}
    if basmala_areas:
        result["basmalaAreas"] = basmala_areas
    return result, errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", help="comma-separated page numbers for diagnostic calibration")
    args = parser.parse_args()
    all_pages = json.loads(INPUT.read_text(encoding="utf-8"))
    basmala_suras_by_page: dict[int, dict[int, int]] = {}
    for page_number, record in enumerate(all_pages, start=1):
        lines = record["lines"]
        for line_index, line in enumerate(lines):
            if line.get("type") != "basmala":
                continue
            next_verse = next((verse_range(candidate) for candidate in lines[line_index + 1 :] if verse_range(candidate)), None)
            if next_verse and next_verse[1] == 1:
                basmala_suras_by_page.setdefault(page_number, {})[line_index] = next_verse[0]
    if args.pages:
        requested = {int(value) for value in args.pages.split(",")}
        if not requested or min(requested) < 1 or max(requested) > len(all_pages):
            raise SystemExit("--pages must contain page numbers between 1 and 604")
        selected = [(index + 1, record) for index, record in enumerate(all_pages) if index + 1 in requested]
    else:
        selected = list(enumerate(all_pages, start=1))

    missing = [page for page, _ in selected if local_source(page) is None and not (CACHE / f"page-{page:03d}.png").exists()]
    if missing:
        done = 0
        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = {pool.submit(download_page, page): page for page in missing}
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as error:
                    print(f"ERROR {error}", flush=True)
                    raise
                done += 1
                if done % 60 == 0 or done == len(futures):
                    print(f"Downloaded {done}/{len(futures)} scans", flush=True)

    layouts: dict[str, dict] = {}
    errors: list[str] = []
    for index, (page, record) in enumerate(selected, start=1):
        try:
            layout, page_errors = calibrate_page(page, record, basmala_suras_by_page.get(page, {}))
            layouts[str(page)] = layout
            errors.extend(page_errors)
        except Exception as error:
            errors.append(f"page {page}: {error}")
        if index % 60 == 0 or index == len(selected):
            print(f"Calibrated {index}/{len(selected)} pages", flush=True)

    if errors:
        raise RuntimeError("Calibration validation failed:\n" + "\n".join(errors[:100]))
    if args.pages:
        print(f"Validated {len(layouts)} diagnostic page(s); no app data was overwritten.")
        return

    payload = {
        "schemaVersion": 1,
        "imageWidth": WIDTH,
        "imageHeight": HEIGHT,
        "source": "Madinah Mushaf page scans used by the reader; opening pages use the bundled scans",
        "pages": layouts,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} for {len(layouts)} pages ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
