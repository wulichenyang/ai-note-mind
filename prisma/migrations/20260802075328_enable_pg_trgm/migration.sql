-- 启用 pg_trgm 扩展：为模糊搜索（ILIKE %keyword%）提供 GIN 索引加速
-- trigram（三元组）匹配的原理：把字符串切成 3 字符的滑动窗口，
-- 例如 "hello" -> "  h", " he", "hel", "ell", "llo", "lo ", "o  "
-- 索引这些 trigram 后，LIKE '%xx%' 就可以走索引而不是全表扫描
CREATE EXTENSION IF NOT EXISTS pg_trgm;
