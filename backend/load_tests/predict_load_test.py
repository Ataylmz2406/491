#!/usr/bin/env python3
"""Small stdlib load test for the SUDerm /predict endpoint.

Example:
    python3 backend/load_tests/predict_load_test.py \
      --url http://127.0.0.1:8000/predict \
      --image "Mil10K images/IL_0009339/ISIC_8325963.jpg" \
      --requests 50 --concurrency 10 --images-per-request 4 --server-pid 12345
"""

from __future__ import annotations

import argparse
import concurrent.futures
import http.client
import mimetypes
import statistics
import subprocess
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse


def build_multipart(image_path: Path, images_per_request: int) -> tuple[bytes, str]:
    image_bytes = image_path.read_bytes()
    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
    boundary = f"----suderm-{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    field_names = ["dermoscopic_image", "dermoscopic_image_2", "dermoscopic_image_3", "dermoscopic_image_4"]
    for index, field_name in enumerate(field_names[:images_per_request], start=1):
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                (
                    f'Content-Disposition: form-data; name="{field_name}"; '
                    f'filename="load-{index}-{image_path.name}"\r\n'
                ).encode(),
                f"Content-Type: {mime_type}\r\n\r\n".encode(),
                image_bytes,
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), boundary


def sample_rss_kb(pid: int | None, stop_event: threading.Event, samples: list[int]) -> None:
    if not pid:
        return

    while not stop_event.is_set():
        try:
            output = subprocess.check_output(["ps", "-o", "rss=", "-p", str(pid)], text=True).strip()
            if output:
                samples.append(int(output))
        except (subprocess.SubprocessError, ValueError):
            pass
        stop_event.wait(1.0)


def send_request(url: str, body: bytes, boundary: str, timeout: float) -> dict[str, float | int | str]:
    parsed = urlparse(url)
    conn_cls = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    started = time.perf_counter()
    conn = conn_cls(parsed.hostname, parsed.port, timeout=timeout)
    try:
        conn.request(
            "POST",
            path,
            body=body,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Content-Length": str(len(body)),
            },
        )
        response = conn.getresponse()
        response.read()
        latency = time.perf_counter() - started
        return {"ok": 200 <= response.status < 300, "status": response.status, "latency": latency}
    except Exception as exc:
        latency = time.perf_counter() - started
        return {"ok": False, "status": "error", "latency": latency, "error": str(exc)}
    finally:
        conn.close()


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((pct / 100) * (len(ordered) - 1)))
    return ordered[index]


def main() -> int:
    parser = argparse.ArgumentParser(description="Load test SUDerm /predict with repeated dermoscopic images.")
    parser.add_argument("--url", default="http://127.0.0.1:8000/predict")
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--requests", type=int, default=10)
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--images-per-request", type=int, default=1, choices=[1, 2, 3, 4])
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--server-pid", type=int, default=None)
    args = parser.parse_args()

    if not args.image.exists():
        raise SystemExit(f"Image not found: {args.image}")

    body, boundary = build_multipart(args.image, args.images_per_request)
    rss_samples: list[int] = []
    stop_event = threading.Event()
    sampler = threading.Thread(target=sample_rss_kb, args=(args.server_pid, stop_event, rss_samples), daemon=True)
    sampler.start()

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(send_request, args.url, body, boundary, args.timeout)
            for _ in range(args.requests)
        ]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]
    elapsed = time.perf_counter() - started

    stop_event.set()
    sampler.join(timeout=2)

    latencies = [float(result["latency"]) for result in results]
    successes = sum(1 for result in results if result["ok"])
    status_counts: dict[str, int] = {}
    for result in results:
        status = str(result["status"])
        status_counts[status] = status_counts.get(status, 0) + 1

    print("SUDerm /predict load test")
    print(f"Requests: {args.requests}, concurrency: {args.concurrency}, images/request: {args.images_per_request}")
    print(f"Success: {successes}, failed: {args.requests - successes}, status counts: {status_counts}")
    print(f"Elapsed: {elapsed:.2f}s, throughput: {args.requests / elapsed:.2f} req/s")
    print(
        "Latency: "
        f"avg {statistics.mean(latencies):.2f}s, "
        f"p50 {percentile(latencies, 50):.2f}s, "
        f"p95 {percentile(latencies, 95):.2f}s, "
        f"max {max(latencies):.2f}s"
    )

    if rss_samples:
        print(
            "Backend RSS: "
            f"min {min(rss_samples) / 1024:.1f} MB, "
            f"max {max(rss_samples) / 1024:.1f} MB, "
            f"delta {(max(rss_samples) - min(rss_samples)) / 1024:.1f} MB"
        )

    return 0 if successes == args.requests else 1


if __name__ == "__main__":
    raise SystemExit(main())
