import type { AuditLog, AuditMerkleCheckpoint } from "@prisma/client";
import { createMerkleProof, merkleCanopy, merkleRoot, verifyAuditChain, verifyMerkleProof } from "./crypto";

type SealedAudit = AuditLog & { sequence: bigint; previousHash: string; entryHash: string };

export function isSealedAudit(log: AuditLog): log is SealedAudit {
  return log.sequence !== null && log.previousHash !== null && log.entryHash !== null;
}

function hashInput(log: SealedAudit) {
  return {
    sequence: log.sequence,
    previousHash: log.previousHash,
    actorId: log.actorId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    origin: log.origin,
    metadata: log.metadata,
    createdAt: log.createdAt,
    entryHash: log.entryHash,
  };
}

export function buildIntegrityReport(allLogs: AuditLog[], checkpoints: AuditMerkleCheckpoint[]) {
  const logs = allLogs.filter(isSealedAudit).sort((a,b)=>Number(a.sequence-b.sequence));
  const hashes = logs.map((log)=>log.entryHash);
  const rootHash = merkleRoot(hashes);
  const chain = verifyAuditChain(logs.map(hashInput));
  const latestIndex = hashes.length-1;
  const proof = latestIndex>=0?createMerkleProof(hashes,latestIndex):[];
  const checkpointReports = checkpoints.map((checkpoint)=>{
    const prefix=hashes.slice(0,checkpoint.leafCount);
    return { id:checkpoint.id,rootHash:checkpoint.rootHash,leafCount:checkpoint.leafCount,firstSequence:checkpoint.firstSequence.toString(),lastSequence:checkpoint.lastSequence.toString(),createdAt:checkpoint.createdAt.toISOString(),valid:prefix.length===checkpoint.leafCount&&merkleRoot(prefix)===checkpoint.rootHash };
  });
  return {
    status: chain.valid && checkpoints.every((_,index)=>checkpointReports[index].valid) ? "verified" as const : "attention" as const,
    chain,
    rootHash,
    leafCount: hashes.length,
    unsealedCount: allLogs.length-logs.length,
    canopy: merkleCanopy(hashes).map((layer,level)=>({level,nodes:layer.map((hash,index)=>({index,hash,label:`${hash.slice(0,8)}…${hash.slice(-6)}`}))})),
    latestProof: latestIndex>=0?{sequence:logs[latestIndex].sequence.toString(),entryHash:hashes[latestIndex],steps:proof,valid:verifyMerkleProof(hashes[latestIndex],proof,rootHash)}:null,
    checkpoints: checkpointReports,
  };
}
