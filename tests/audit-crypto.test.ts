import { describe,expect,it } from "vitest";
import { GENESIS_HASH, canonicalJson, createMerkleProof, hashAuditEntry, merkleRoot, verifyAuditChain, verifyMerkleProof } from "@/lib/audit/crypto";

describe("cryptographic audit proofs",()=>{
  it("canonicalizes object keys deterministically",()=>{
    expect(canonicalJson({z:1,a:{d:2,b:3}})).toBe(canonicalJson({a:{b:3,d:2},z:1}));
  });

  it("builds and verifies a Merkle inclusion proof",()=>{
    const leaves=["a".repeat(64),"b".repeat(64),"c".repeat(64),"d".repeat(64),"e".repeat(64)];
    const root=merkleRoot(leaves); const proof=createMerkleProof(leaves,2);
    expect(verifyMerkleProof(leaves[2],proof,root)).toBe(true);
    expect(verifyMerkleProof("f".repeat(64),proof,root)).toBe(false);
  });

  it("detects a changed audit entry",()=>{
    const base={actorId:"user-1",entityType:"Contact",entityId:"contact-1",origin:"user",metadata:{score:70},createdAt:"2026-08-23T00:00:00.000Z"};
    const first={...base,sequence:"1",previousHash:GENESIS_HASH,action:"assessment.completed"};
    const firstHash=hashAuditEntry(first); const second={...base,sequence:"2",previousHash:firstHash,action:"assessment.simulated"}; const secondHash=hashAuditEntry(second);
    expect(verifyAuditChain([{...first,entryHash:firstHash},{...second,entryHash:secondHash}]).valid).toBe(true);
    expect(verifyAuditChain([{...first,entryHash:firstHash},{...second,action:"assessment.deleted",entryHash:secondHash}])).toMatchObject({valid:false,brokenAt:"2"});
  });
});
