from starlette.responses import JSONResponse


class RequestLimit:
    """Bound request bodies even when a client omits Content-Length."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] in {"GET", "HEAD", "OPTIONS"}:
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > 131072:
                return await JSONResponse({"detail": "Request too large"}, status_code=413)(
                    scope, receive, send
                )
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)

        async def replay():
            nonlocal body
            if body is not None:
                result, body = body, None
                return {"type": "http.request", "body": result, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
