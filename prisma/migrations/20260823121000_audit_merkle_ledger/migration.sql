-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "entryHash" TEXT,
ADD COLUMN "hashAlgorithm" TEXT DEFAULT 'SHA-256',
ADD COLUMN "previousHash" TEXT,
ADD COLUMN "sequence" BIGINT;

-- CreateTable
CREATE TABLE "AuditMerkleCheckpoint" (
    "id" TEXT NOT NULL,
    "rootHash" TEXT NOT NULL,
    "leafCount" INTEGER NOT NULL,
    "firstSequence" BIGINT NOT NULL,
    "lastSequence" BIGINT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "AuditMerkleCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditMerkleCheckpoint_createdAt_idx" ON "AuditMerkleCheckpoint"("createdAt" DESC);
CREATE UNIQUE INDEX "AuditMerkleCheckpoint_rootHash_leafCount_key" ON "AuditMerkleCheckpoint"("rootHash", "leafCount");
CREATE UNIQUE INDEX "AuditLog_sequence_key" ON "AuditLog"("sequence");
CREATE INDEX "AuditLog_sequence_idx" ON "AuditLog"("sequence" ASC);

-- AddForeignKey
ALTER TABLE "AuditMerkleCheckpoint" ADD CONSTRAINT "AuditMerkleCheckpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
