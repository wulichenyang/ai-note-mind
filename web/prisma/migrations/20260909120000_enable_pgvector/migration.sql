-- 启用 pgvector 扩展：为 RAG 提供 vector 类型与 HNSW 相似度索引
-- 用途：Document/Chunk 表（Todo 3）中的 embedding 列（text-embedding-v3，1024 维）
-- 注意：与 pg_trgm 一样，Neon 主连接用户可直接执行
CREATE EXTENSION IF NOT EXISTS vector;
