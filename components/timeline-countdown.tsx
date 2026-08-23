"use client";
import { useEffect, useState } from "react";
export function TimelineCountdown({target}:{target:string}){const[days,setDays]=useState<number|null>(null);useEffect(()=>{const calculate=()=>setDays(Math.ceil((new Date(target).getTime()-Date.now())/86_400_000));calculate();const id=setInterval(calculate,3_600_000);return()=>clearInterval(id);},[target]);if(days===null)return <span>Calculating…</span>;return <strong>{days<=0?"Active":`${days} days remaining`}</strong>}
