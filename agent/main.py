"""Vercel Python 入口 —— FastAPI 实例暴露点。

Vercel 检测到 requirements.txt 中的 fastapi 后，会加载本文件顶层的 `app`。
本地开发不受此文件影响，直接运行 uvicorn app.main:app 即可。
"""
from app.main import app
