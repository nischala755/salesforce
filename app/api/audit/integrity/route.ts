import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { buildIntegrityReport, isSealedAudit } from "@/lib/audit/integrity";
import { merkleRoot } from "@/lib/audit/crypto";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const [logs,checkpoints]=await Promise.all([prisma.auditLog.findMany({orderBy:{createdAt:"asc"}}),prisma.auditMerkleCheckpoint.findMany({orderBy:{createdAt:"desc"},take:10})]);
    return NextResponse.json(buildIntegrityReport(logs,checkpoints));
  } catch(error) { return apiError(error); }
}

export async function POST() {
  try {
    const session=await requireSession();
    const checkpoint=await prisma.$transaction(async(tx)=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(618541923)`;
      const logs=(await tx.auditLog.findMany({where:{sequence:{not:null}},orderBy:{sequence:"asc"}})).filter(isSealedAudit);
      if(!logs.length) throw new Error("EMPTY_AUDIT_LEDGER");
      const rootHash=merkleRoot(logs.map(log=>log.entryHash));
      const existing=await tx.auditMerkleCheckpoint.findUnique({where:{rootHash_leafCount:{rootHash,leafCount:logs.length}}});
      const sealed=existing??await tx.auditMerkleCheckpoint.create({data:{rootHash,leafCount:logs.length,firstSequence:logs[0].sequence,lastSequence:logs.at(-1)!.sequence,createdById:session.sub}});
      if(!existing) await writeAudit(tx,{actorId:session.sub,action:"audit.merkle_checkpoint.sealed",entityType:"AuditMerkleCheckpoint",entityId:sealed.id,origin:"deterministic",metadata:{rootHash,leafCount:logs.length,algorithm:"SHA-256"}});
      return {id:sealed.id,rootHash:sealed.rootHash,leafCount:sealed.leafCount,createdAt:sealed.createdAt.toISOString(),existing:Boolean(existing)};
    });
    return NextResponse.json(checkpoint,{status:checkpoint.existing?200:201});
  } catch(error) {
    if(error instanceof Error&&error.message==="EMPTY_AUDIT_LEDGER") return NextResponse.json({error:"Create an audited event before sealing a checkpoint."},{status:409});
    return apiError(error);
  }
}
