import { Prisma, type AuditOrigin } from "@prisma/client";
import { GENESIS_HASH, HASH_ALGORITHM, hashAuditEntry } from "./crypto";

export interface AuditEvent {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  origin?: AuditOrigin;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAudit(db: Prisma.TransactionClient, event: AuditEvent) {
  // Serialize writers so every entry has one unambiguous predecessor in the cryptographic chain.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(618541923)`;
  const previous = await db.auditLog.findFirst({ where: { sequence: { not: null } }, orderBy: { sequence: "desc" } });
  const sequence = (previous?.sequence ?? BigInt(0)) + BigInt(1);
  const previousHash = previous?.entryHash ?? GENESIS_HASH;
  const createdAt = new Date();
  const origin = event.origin ?? "user";
  const metadata = event.metadata ?? {};
  const entryHash = hashAuditEntry({ sequence, previousHash, actorId: event.actorId ?? null, action: event.action, entityType: event.entityType, entityId: event.entityId ?? null, origin, metadata, createdAt });
  // Append-only in application code and tamper-evident through SHA-256 chaining. WORM storage remains separate hardening.
  return db.auditLog.create({
    data: {
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      origin,
      metadata,
      createdAt,
      sequence,
      previousHash,
      entryHash,
      hashAlgorithm: HASH_ALGORITHM,
    },
  });
}
