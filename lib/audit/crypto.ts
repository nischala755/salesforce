import { createHash } from "node:crypto";

export const HASH_ALGORITHM = "SHA-256";
export const GENESIS_HASH = sha256("COMPLYLENS_AUDIT_GENESIS_V1");

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON cannot encode a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new TypeError(`Canonical JSON cannot encode ${typeof value}.`);
}

export interface AuditHashInput {
  sequence: bigint | string;
  previousHash: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  origin: string;
  metadata: unknown;
  createdAt: Date | string;
}

export function hashAuditEntry(input: AuditHashInput): string {
  return sha256(`COMPLYLENS_AUDIT_ENTRY_V1:${canonicalJson({
    sequence: input.sequence.toString(),
    previousHash: input.previousHash,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    origin: input.origin,
    metadata: input.metadata,
    createdAt: input.createdAt instanceof Date ? input.createdAt.toISOString() : input.createdAt,
  })}`);
}

function leafHash(entryHash: string) {
  return sha256(`COMPLYLENS_MERKLE_LEAF_V1:${entryHash}`);
}

function nodeHash(left: string, right: string) {
  return sha256(`COMPLYLENS_MERKLE_NODE_V1:${left}:${right}`);
}

export interface MerkleProofStep { direction: "left" | "right"; hash: string }

export function buildMerkleTree(entryHashes: string[]): string[][] {
  if (entryHashes.length === 0) return [[sha256("COMPLYLENS_EMPTY_MERKLE_V1")]];
  const layers = [entryHashes.map(leafHash)];
  while (layers.at(-1)!.length > 1) {
    const current = layers.at(-1)!;
    const next: string[] = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(nodeHash(current[index], current[index + 1] ?? current[index]));
    }
    layers.push(next);
  }
  return layers;
}

export function merkleRoot(entryHashes: string[]): string {
  return buildMerkleTree(entryHashes).at(-1)![0];
}

export function createMerkleProof(entryHashes: string[], leafIndex: number): MerkleProofStep[] {
  if (leafIndex < 0 || leafIndex >= entryHashes.length) throw new RangeError("Merkle leaf index is out of range.");
  const layers = buildMerkleTree(entryHashes); const proof: MerkleProofStep[] = []; let index = leafIndex;
  for (let level = 0; level < layers.length - 1; level += 1) {
    const layer = layers[level]; const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push({ direction: index % 2 === 0 ? "right" : "left", hash: layer[siblingIndex] ?? layer[index] });
    index = Math.floor(index / 2);
  }
  return proof;
}

export function verifyMerkleProof(entryHash: string, proof: MerkleProofStep[], expectedRoot: string): boolean {
  let current = leafHash(entryHash);
  for (const step of proof) current = step.direction === "left" ? nodeHash(step.hash, current) : nodeHash(current, step.hash);
  return current === expectedRoot;
}

export function merkleCanopy(entryHashes: string[], maxNodes = 8): string[][] {
  const layers = buildMerkleTree(entryHashes);
  let base = 0;
  while (base < layers.length - 1 && layers[base].length > maxNodes) base += 1;
  return layers.slice(base).reverse();
}

export function verifyAuditChain(entries: Array<AuditHashInput & { entryHash?: string | null }>): { valid: boolean; verifiedCount: number; brokenAt: string | null } {
  let previousHash = GENESIS_HASH;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const expected = hashAuditEntry({ ...entry, previousHash });
    if (entry.sequence.toString() !== String(index + 1) || entry.previousHash !== previousHash || entry.entryHash !== expected) return { valid: false, verifiedCount: index, brokenAt: entry.sequence.toString() };
    previousHash = expected;
  }
  return { valid: true, verifiedCount: entries.length, brokenAt: null };
}
