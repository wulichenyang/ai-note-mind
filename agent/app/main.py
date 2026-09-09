"""NoteMind Agent Service 应用工厂。

Vercel Python 约定：暴露顶层 `app` 变量（ASGI 实例）。
本地运行：uvicorn app.main:app --reload
"""
import time

from fastapi import FastAPI, Request

from app.chat import router as chat_router
from app.config import settings
from app.ingest import router as ingest_router

app = FastAPI(
    title="NoteMind Agent Service",
    version="0.1.0",
    description="多模态读取 / 分片 / 向量化 / 意图路由对话",
)

# 业务路由统一挂 /api 下；前缀与 web BFF 的转发路径对应
app.include_router(ingest_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """跨服务认证：除 /health 外，所有请求必须带 X-Service-Token。

    web BFF 是唯一入口，agent 服务不直接暴露公网。
    """
    if request.url.path == "/health":
        return await call_next(request)

    token = request.headers.get("x-service-token", "")
    if not settings.service_token or token != settings.service_token:
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=401, content={"detail": "无效的服务令牌"})
    return await call_next(request)


@app.get("/health")
async def health():
    """Vercel / 本地的健康检查。"""
    return {
        "status": "ok",
        "env": settings.app_env,
        "time": time.time(),
    }
