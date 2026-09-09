-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "sources" JSONB;

-- CreateTable
CREATE TABLE "note_chunks" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_chunks_noteId_idx" ON "note_chunks"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "note_chunks_noteId_seq_key" ON "note_chunks"("noteId", "seq");

-- 向量相似度检索索引：HNSW + cosine 距离（与 chunks 一致，由 agent 检索使用）
CREATE INDEX "note_chunks_embedding_hnsw_idx" ON "note_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "note_chunks" ADD CONSTRAINT "note_chunks_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
