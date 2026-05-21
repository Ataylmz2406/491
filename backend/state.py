import asyncio
from typing import Any

model: Any = None
transform: Any = None
inference_semaphore: asyncio.Semaphore | None = None
