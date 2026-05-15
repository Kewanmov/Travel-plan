# backend/core/ratelimit.py
import time
from collections import defaultdict, deque
from threading import Lock
from fastapi import HTTPException, Request

_buckets: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(key: str, limit: int, window_sec: int):

    def _dep(request: Request):
        ip = _client_ip(request)
        bucket_key = f"{key}:{ip}"
        now = time.monotonic()
        cutoff = now - window_sec
        with _lock:
            bucket = _buckets[bucket_key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry = int(window_sec - (now - bucket[0])) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Слишком много попыток. Попробуйте через {retry} сек.",
                    headers={"Retry-After": str(retry)},
                )
            bucket.append(now)

    return _dep