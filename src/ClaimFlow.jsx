import React,{useState,useEffect,useRef} from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, CircleHelp, Download, LockKeyhole, RefreshCw, ShieldCheck, Wallet, X, AlertTriangle } from 'lucide-react';
import { NETWORK } from './network.js';
import { sendWalletClaim } from './wallet-claim.js';
const DOCS='https://mezo.org/docs/users/borrow/claim-collateral-after-redemption/';
const storageKey=a=>`compass-pending-${NETWORK.chainId}-${a?.toLowerCase()}`;
function readPending(a){try{const p=JSON.parse(localStorage.getItem(storageKey(a)));return p?.address?.toLowerCase()===a?.toLowerCase()&&/^0x[0-9a-f]{64}$/i.test(p.hash)?p:null;}catch{return null;}}
async function jsonFetch(url){const r=await fetch(url);const j=await r.json();if(!r.ok)throw Error(j.error||'The request could not be verified.');return j;}
export default function ClaimFlow({snapshot,onRefresh}){
  const demo=snapshot.mode==='demo';
  const [quote,setQuote]=useState(null),[config,setConfig]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [consent,setConsent]=useState(false),[owns,setOwns]=useState(false),[demoStage,setDemoStage]=useState(0);
  const [pending,setPending]=useState(()=>demo?null:readPending(snapshot.address));
  const [result,setResult]=useState(null),[checking,setChecking]=useState(false),[replacement,setReplacement]=useState('');
  const [clock,setClock]=useState(Date.now()),[walletChanged,setWalletChanged]=useState(false);
  const alive=useRef(true);const pollId=useRef(0);const verifySeq=useRef(0);const latestHash=useRef(pending?.hash);latestHash.current=pending?.hash;const signingAbort=useRef(new AbortController());
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;pollId.current++;verifySeq.current++;signingAbort.current.abort();};},[]);
  useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(demo)return;jsonFetch('/api/config').then(v=>{if(alive.current)setConfig(v);}).catch(()=>{});},[demo]);
  useEffect(()=>{
    if(!window.ethereum?.on)return;
    const changed=()=>{setQuote(null);setConsent(false);setOwns(false);setWalletChanged(true);setError('Wallet account or network changed. Review a fresh simulation before signing.');};
    window.ethereum.on('accountsChanged',changed);window.ethereum.on('chainChanged',changed);
    return()=>{window.ethereum.removeListener?.('accountsChanged',changed);window.ethereum.removeListener?.('chainChanged',changed);};
  },[]);
  async function simulate(){
    if(demo){setDemoStage(1);setConsent(false);setOwns(false);return;}
    setBusy(true);setError('');setQuote(null);setConsent(false);setOwns(false);setWalletChanged(false);
    try{const [q,c]=await Promise.all([jsonFetch(`/api/claim/preview/${snapshot.address}`),jsonFetch('/api/config')]);if(alive.current){setQuote(q);setConfig(c);}}
    catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}
  }
  async function submit(){
    if(demo){if(consent&&owns)setDemoStage(2);return;}
    setBusy(true);setError('');
    try{
      if(!consent||!owns)throw Error('Review and accept both confirmations first.');
      const c=await jsonFetch('/api/config');
      const record=await sendWalletClaim(window.ethereum,snapshot.address,quote,c,{signal:signingAbort.current.signal});
      try{localStorage.setItem(storageKey(snapshot.address),JSON.stringify(record));}catch{/* Wallet/explorer remain authoritative if storage is unavailable. */}
      if(alive.current){setPending(record);setQuote(null);}
    }catch(e){if(alive.current)setError(e.code===4001||e.code==='ACTION_REJECTED'?'Wallet request cancelled. No success is assumed.':`${e.shortMessage||e.message} If your wallet shows a sent transaction, check its hash before trying anything else.`);}
    finally{if(alive.current)setBusy(false);}
  }
  async function verify(hash=pending?.hash){
    if(!hash)return;const id=++verifySeq.current;setChecking(true);setError('');
    try{const j=await jsonFetch(`/api/claim/verify/${snapshot.address}/${hash}`);if(alive.current&&id===verifySeq.current&&hash===latestHash.current){setResult(j);if(j.state==='confirmed'||j.state==='reverted'){try{localStorage.removeItem(storageKey(snapshot.address));}catch{}}}return j;}
    catch(e){if(alive.current&&id===verifySeq.current)setError(e.message);return null;}finally{if(alive.current&&id===verifySeq.current)setChecking(false);}
  }
  useEffect(()=>{
    if(!pending?.hash)return;
    const id=++pollId.current;let t,attempt=0;
    const poll=async()=>{if(id!==pollId.current||!alive.current)return;const state=await verify(pending.hash);attempt++;if(alive.current&&id===pollId.current&&!['confirmed','reverted'].includes(state?.state)&&attempt<20)t=setTimeout(poll,6000);};
    poll();return()=>{pollId.current++;clearTimeout(t);};
  },[pending?.hash]);
  function checkReplacement(e){e.preventDefault();if(!/^0x[0-9a-fA-F]{64}$/.test(replacement)){setError('Enter a valid 0x transaction hash.');return;}
    const record={address:snapshot.address,chainId:NETWORK.chainId,hash:replacement,submittedAt:Date.now()};setPending(record);setResult(null);try{localStorage.setItem(storageKey(snapshot.address),JSON.stringify(record));}catch{}
  }
  function exportReceipt(){const blob=new Blob([JSON.stringify({application:'Mezo Compass',mode:'live',network:NETWORK.name,result,disclaimer:'RPC-verified receipt and payout event; not an audit or finality guarantee.'},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='compass-claim-receipt.json';a.click();URL.revokeObjectURL(url);}
  const stage=demo?(demoStage===2?3:demoStage):result?.state==='confirmed'?3:pending?2:quote?.eligible?1:0;
  const expired=quote&&clock>=quote.expiresAt;
  return <section className="claim-panel">
    <div className="section-heading"><div><h3>Recover remaining collateral</h3><p>Inspect → simulate → approve in your wallet → verify the receipt.</p></div><span className="small-badge">{demo?'FICTIONAL WALKTHROUGH':config?.claimsEnabled?'MAINNET · USER APPROVAL':'MAINNET · SIMULATION ONLY'}</span></div>
    <div className="claim-steps">{['Inspect','Simulate','Confirm','Verify'].map((s,i)=><div key={s} className={i<=stage?'reached':''}><span>{i<stage?<Check size={12}/>:i+1}</span>{s}</div>)}</div>
    {demo?<div className="claim-disclaimer"><CircleHelp size={17}/><p><strong>Demo mode. No real money or transactions.</strong> This walkthrough uses fictional balances. It never opens a wallet or creates a blockchain transaction.</p></div>:<div className="claim-disclaimer"><ShieldCheck size={17}/><p>{config?.reason||'Checking deployment settings. Signing is unavailable until configuration is confirmed.'} This app is unaudited; simulation cannot guarantee execution.</p></div>}
    <div className="claim-summary"><div><span>{demo?'EXAMPLE COLLATERAL':'SNAPSHOT COLLATERAL'}</span><strong>{snapshot.surplus} <small>BTC</small></strong></div><div><span>NETWORK</span><strong>{demo?'Fictional example':'Mezo Mainnet'}<small>{demo?'Not blockchain data':'Chain 31612 · BTC gas'}</small></strong></div></div>
    {demo&&demoStage===2?<div className="claim-success demo-success"><CheckCircle2 size={35}/><h2>Walkthrough complete.</h2><p>In a real claim, your wallet would authorize the transaction. Compass would then check the exact transaction, a matching payout record, and the remaining surplus.</p><div className="demo-receipt"><span>Illustrated collateral</span><strong>{snapshot.surplus} BTC</strong><span>Transaction hash</span><strong>None — this was a demo</strong></div><button className="primary" onClick={()=>{setDemoStage(0);setConsent(false);setOwns(false);}}>Restart walkthrough <RefreshCw size={14}/></button></div>:pending?<div className="claim-tracking">
      <div className={`tracking-status ${result?.state==='confirmed'?'confirmed':''}`}><span>{result?.state==='confirmed'?<CheckCircle2 size={30}/>:<RefreshCw size={26} className={checking?'spin':''}/>}</span><div><h2>{result?.state==='confirmed'?'Claim receipt verified':result?.state==='reverted'?'Transaction reverted':result?.state==='confirming'?'Payout found. Waiting for confirmations.':'Track your claim'}</h2><p>{result?.note||'A transaction hash is recorded. Do not submit a second claim while its status is unknown.'}</p></div></div>
      <a className="pending-hash" href={`${NETWORK.explorer}/tx/${pending.hash}`} target="_blank" rel="noopener noreferrer">{pending.hash}<ArrowUpRight size={16}/></a>
      {result?.payout&&<div className="verified-amounts"><div><span>Payout event</span><strong>{result.payout} BTC</strong></div><div><span>Surplus at receipt block</span><strong>{result.surplusAfter} BTC</strong></div><div><span>Confirmations at check</span><strong>{result.confirmations}</strong></div></div>}
      <div className="tracking-actions"><button className="primary" disabled={checking} onClick={()=>verify()}><RefreshCw size={14} className={checking?'spin':''}/>Check status again</button>{result?.state==='confirmed'&&<><button className="quiet-button" onClick={exportReceipt}><Download size={14}/>Export receipt</button><button className="quiet-button" onClick={onRefresh}>Refresh wallet snapshot <ArrowRight size={14}/></button></>}</div>
      <details className="replacement"><summary>Replaced, cancelled, or sent from another interface?</summary><p>Paste the replacement claim hash. Cancel transactions and unrelated transfers cannot establish a recovery. Unknown status never triggers an automatic resubmission.</p><form className="address-form" onSubmit={checkReplacement}><div className="address-input"><input aria-label="Replacement claim transaction hash" value={replacement} onChange={e=>setReplacement(e.target.value.trim())} placeholder="0x… claim transaction hash"/></div><button className="primary">Track this hash</button></form></details>
    </div>:<>
      <div className="claim-action-heading"><div><h2>{demo?'Preview a safe recovery journey.':'Start with a fresh simulation.'}</h2><p>{demo?'Learn every step without connecting a wallet.':'We check full-redemption status and surplus, simulate the exact claim, and estimate the BTC network fee. No signature is requested for simulation.'}</p></div><button className="primary" disabled={busy||!snapshot.hasSurplus||snapshot.status!==4} onClick={simulate}>{busy?<RefreshCw className="spin" size={15}/>:<ShieldCheck size={15}/>} {busy?'Checking…':demo?'Simulate example claim':'Simulate claim'}</button></div>
      {(!snapshot.hasSurplus||snapshot.status!==4)&&<div className="no-events">{snapshot.hasSurplus?'This flow supports only full-redemption recovery. Use the official guide for other cases.':'No collateral is available in this snapshot. No claim will be prepared.'}</div>}
      {(demo&&demoStage===1||quote)&&<div className="claim-preview">
        {quote&&!quote.eligible?<div className="no-events">{quote.reason}</div>:<><div className="preview-heading"><CheckCircle2 size={19}/><strong>{demo?'Example simulation illustrated':'Simulation passed'}</strong><span>{demo?'FICTIONAL':expired?'EXPIRED':`${Math.max(0,Math.ceil((quote.expiresAt-clock)/1000))}s left`}</span></div><div className="preview-details"><div><span>Collateral to claim</span><strong>{demo?snapshot.surplus:quote.surplus} BTC</strong></div><div><span>{demo?'Illustrative fee budget':'Buffered fee budget · variable'}</span><strong>{demo?'0.000002':quote.feeBudget} BTC</strong></div><div><span>Function</span><code>claimCollateral()</code></div><div><span>BTC sent with transaction</span><strong>0 BTC</strong></div><div><span>Token approvals</span><strong>None</strong></div><div><span>Destination contract</span>{demo?<strong>Illustration only</strong>:<a href={`${NETWORK.explorer}/address/${NETWORK.contracts.borrowerOperations}`} target="_blank" rel="noopener noreferrer">Borrower Operations <ArrowUpRight size={12}/></a>}</div></div>
        {!demo&&<p className="quote-note">{quote.note} The wallet—not this website—shows the final authorization. {quote.hasGas?'':'The inspected wallet does not have enough BTC for the fee budget.'}</p>}
        <label className="claim-consent"><input type="checkbox" checked={owns} onChange={e=>setOwns(e.target.checked)}/><span>{demo?'I understand these are fictional funds.':'I control the inspected wallet and will verify the contract and network in my wallet.'}</span></label><label className="claim-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{demo?'I understand no real transaction will be sent.':'I understand this app is unaudited, BTC fees are real, and simulation is not a guarantee.'}</span></label>
        <button className="primary claim-submit" disabled={busy||!consent||!owns||!demo&&(!config?.claimsEnabled||expired||!quote.hasGas||walletChanged)} onClick={submit}>{busy?<RefreshCw className="spin" size={15}/>:demo?<ArrowRight size={15}/>:config?.claimsEnabled?<Wallet size={15}/>:<LockKeyhole size={15}/>} {busy?'Reviewing wallet state…':demo?'Complete example recovery':config?.claimsEnabled?'Review claim in my wallet':'Signing disabled on this deployment'}</button></>}
      </div>}
      {!demo&&<details className="replacement"><summary>Already sent a claim? Track its transaction hash</summary><form className="address-form" onSubmit={checkReplacement}><div className="address-input"><input aria-label="Existing claim transaction hash" value={replacement} onChange={e=>setReplacement(e.target.value.trim())} placeholder="0x… claim transaction hash"/></div><button className="primary">Track this hash</button></form></details>}
    </>}
    {error&&<div className="error" role="alert"><AlertTriangle size={16}/>{error}</div>}
    <div className="claim-official"><div><LockKeyhole size={17}/><span>No recovery phrase. No unlock payment. No automatic resubmission.</span></div><a href={DOCS} target="_blank" rel="noopener noreferrer">Official Mezo claim guide <ArrowUpRight size={13}/></a></div>
  </section>;
}
