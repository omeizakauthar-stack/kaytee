import React,{useState,useRef,useEffect} from 'react';
import { ArrowUpRight, RefreshCw, Search, FileCheck2, Download, AlertTriangle, Clock3 } from 'lucide-react';
import { NETWORK } from './network.js';

export default function History({snapshot}) {
  const [pages,setPages]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [hash,setHash]=useState(''),[receipt,setReceipt]=useState(null),[checking,setChecking]=useState(false);
  const seq=useRef(0),txSeq=useRef(0);
  useEffect(()=>()=>{seq.current++;txSeq.current++;},[]);
  const live=snapshot.mode==='live';
  async function scan(older=false){
    const id=++seq.current;setBusy(true);setError('');
    const cursor=older?pages.at(-1)?.nextToBlock:snapshot.blockNumber;
    try{
      const r=await fetch(`/api/history/${snapshot.address}?toBlock=${cursor}`);const body=await r.json();
      if(!r.ok)throw new Error(body.error||'History unavailable.');
      if(id===seq.current)setPages(p=>older?[...p,body]:[body]);
    }catch(e){if(id===seq.current)setError(e.message);}finally{if(id===seq.current)setBusy(false);}
  }
  async function checkTx(e){
    e.preventDefault();setError('');setReceipt(null);
    if(!/^0x[0-9a-fA-F]{64}$/.test(hash)){setError('A transaction hash starts with 0x and has 64 hexadecimal characters.');return;}
    const id=++txSeq.current;setChecking(true);
    try{const r=await fetch(`/api/transaction/${snapshot.address}/${hash}`);const body=await r.json();if(!r.ok)throw new Error(body.error||'Receipt unavailable.');if(id===txSeq.current)setReceipt(body);}
    catch(e){if(id===txSeq.current)setError(e.message);}finally{if(id===txSeq.current)setChecking(false);}
  }
  const unique=[...new Map(pages.flatMap(p=>p.events).map(event=>[event.id,event])).values()];
  function exportRecords(){
    const blob=new Blob([JSON.stringify({application:'Mezo Compass',network:NETWORK.name,address:snapshot.address,coverage:'partial',pages,receipt,disclaimer:'Bounded event search and optional transaction receipt. Not complete history, independent proof, or an audit.'},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='compass-evidence-records.json';a.click();URL.revokeObjectURL(url);
  }
  return <section className="history-panel">
    <div className="section-heading"><div><h3>Transaction-backed records</h3><p>Trace supported loan events to their original mainnet transactions.</p></div><span className="small-badge">{live?'PARTIAL HISTORY':'NO SAMPLE EVIDENCE'}</span></div>
    {!live?<div className="history-intro"><FileCheck2 size={27}/><h2>Real records belong to real checks.</h2><p>The walkthrough has no real transaction evidence. Choose “Live wallet” above and check a public address to search its protocol events.</p></div>:<>
      <div className="history-disclosure"><Clock3 size={18}/><p><strong>A bounded search, not your complete history.</strong> Each page searches up to 5,000 blocks, ending at or before your snapshot. Older activity may be missing. An empty page does not mean nothing happened.</p></div>
      <div className="history-controls"><div><strong>Wallet-specific event search</strong><p>Loan creation, balance updates, redemptions, liquidations and surplus changes.</p></div><button className="primary" disabled={busy} onClick={()=>scan(false)}>{busy?<RefreshCw className="spin" size={14}/>:<Search size={14}/>} {pages.length?'Restart search':'Search recent records'}</button></div>
      {pages.length>0&&<div className="coverage-bar"><span>Blocks {pages.at(-1).fromBlock.toLocaleString()}–{pages[0].toBlock.toLocaleString()} · {unique.length} supported records</span><button onClick={exportRecords}><Download size={13}/> Export evidence</button></div>}
      <div className="event-timeline">{unique.map(event=><Event key={event.id} event={event}/>)}{pages.length>0&&!unique.length&&<div className="no-events">No supported wallet-indexed events were returned in the displayed range. Try an older page or check a known transaction below.</div>}</div>
      {pages.length>0&&pages.at(-1).nextToBlock!==null&&<button className="older-button" disabled={busy} onClick={()=>scan(true)}>{busy?<RefreshCw className="spin" size={14}/>:<Clock3 size={14}/>} Search the previous 5,000 blocks</button>}
      <div className="transaction-check"><h3>Have a transaction hash?</h3><p>Check a known transaction directly, even if it predates the searched range. Only matching protocol events for this wallet are shown.</p><form onSubmit={checkTx} className="address-form"><div className="address-input"><FileCheck2 size={17}/><input aria-label="Transaction hash" value={hash} onChange={e=>setHash(e.target.value.trim())} placeholder="0x… transaction hash" spellCheck="false"/></div><button className="primary" disabled={checking}>{checking?<RefreshCw className="spin" size={14}/>:<Search size={14}/>}Check transaction</button></form>
      {receipt&&<div className="receipt-result"><div className="receipt-summary"><span className={`receipt-state ${receipt.success?'success':''}`}>{receipt.found?(receipt.success?'Successful transaction':'Failed transaction'):'Receipt not found'}</span>{receipt.found&&<a href={`${NETWORK.explorer}/tx/${receipt.hash}`} target="_blank" rel="noopener noreferrer">Open transaction <ArrowUpRight size={13}/></a>}</div><p>{receipt.note}</p>{receipt.confirmations!==undefined&&<small>{receipt.confirmations} block confirmations at check time. This is not a finality guarantee.</small>}<div className="event-timeline">{receipt.events.map(event=><Event key={event.id} event={event}/>)}</div><button className="text-button" onClick={exportRecords}><Download size={13}/>Export these records</button></div>}
      </div>
      {error&&<div className="error" role="alert"><AlertTriangle size={16}/>{error}</div>}
      <div className="history-footnote">Events are decoded using the official repository ABI and operation mappings for the emitting contract. RPC data is a trust dependency; historical implementations are not independently audited. No unsupported cause, loss amount, or recovery is inferred.</div>
    </>}
  </section>;
}
function Event({event}){return <article className={`event-record ${event.kind}`}><span className="event-bullet"/><div className="event-content"><div className="event-title"><h4>{event.title}</h4><span>Block {event.blockNumber.toLocaleString()}</span></div><p>{event.detail}</p><div className="event-proof"><span>{event.contract} · {event.event}</span><a href={`${NETWORK.explorer}/tx/${event.transactionHash}`} target="_blank" rel="noopener noreferrer">View transaction <ArrowUpRight size={12}/></a></div></div></article>;}
