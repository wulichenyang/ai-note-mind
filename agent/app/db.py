"""数据库连接：agent 直连 Neon（与 web 共用同一库）。

职责边界：
  - web(Prisma) 管 documents 元数据；chunks 的 content/embedding 由 agent 写入
  - embedding 是 vector 类型，Prisma 无法读写，这里用 psycopg 原生 SQL 回填
"""
from psycopg import connect
from psycopg.rows import dict_row

from app.config import settings


def db_connect():
    """返回一个同步连接（行以 dict 返回，键名 = 列名）。"""
    return connect(settings.database_url, row_factory=dict_row)
