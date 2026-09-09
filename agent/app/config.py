"""NoteMind Agent Service —— 应用配置。

环境变量统一从这里读取（不直接散落 process.env）：
- 本地：.env / shell 导出
- Vercel：面板 Environment Variables（同名即可）
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 运行环境：development / production（Vercel 注入）
    app_env: str = "development"

    # 跨服务认证：web BFF 调用 agent 时带的内部 token（必填）
    service_token: str = ""

    # ---------- 向量 / 视觉：SiliconFlow（免费 BAAI/bge-m3 embedding） ----------
    # 注册：https://cloud.siliconflow.cn/account/ak（免费模型见 https://siliconflow.cn/pricing）
    # key 申请页面创建后填入，embedding 与视觉共用同一把 key
    siliconflow_api_key: str = ""
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    # 免费 embedding：输出 1024 维，与 DB 的 vector(1024) 对齐
    embedding_model: str = "BAAI/bge-m3"
    # 免费视觉模型：图片文档 → 描述 + 转录文字（8B，9B 以下永久免费；实测可用）
    vision_model: str = "Qwen/Qwen3-VL-8B-Instruct"

    # ---------- 对话生成兜底（正常走 web 端 BYOK 传入的 llm.api_key） ----------
    ai_base_url: str = "https://api.deepseek.com"
    ai_model: str = "deepseek-chat"

    # 数据库（与 web 共用 Neon）
    database_url: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
