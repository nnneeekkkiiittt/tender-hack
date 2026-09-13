"""Session-protected gateway to the internal analytics service."""

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from .db import CurrentUser, require_admin

router = APIRouter()


@router.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False)
async def analytics(path: str, request: Request, user: CurrentUser):
    require_admin(user)
    # Fixed upstream; never forward session cookies or arbitrary client headers.
    url = httpx.URL("http://analytics:8080").copy_with(
        path="/api/v1/" + path, query=request.url.query.encode())
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
            result = await client.request(
                request.method, url, content=await request.body(),
                headers={"Content-Type": "application/json"})
    except httpx.HTTPError:
        raise HTTPException(503, "Analytics service unavailable") from None
    return Response(result.content, status_code=result.status_code,
                    media_type=result.headers.get("content-type", "application/json"))
