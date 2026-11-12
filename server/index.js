import express from 'express';
import { isAddress } from 'ethers';
import { inspectWallet, withProvider } from './chain.js';
import { NETWORK } from '../src/network.js';
import { scanHistory, inspectTransaction } from './history.js';
import path from 'node:path';
import { claimConfiguration, previewForWallet, verifyForWallet } from './claims.js';

const app = express();
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','strict-origin-when-cross-origin');next();});
app.use('/api', (_req,res,next) => {res.set('Cache-Control','no-store'); next();});
const cache = new Map();
let concurrent = 0;
app.get('/api/network', async (_req,res) => {
  try { const block = await withProvider(async p=>{if(Number(BigInt(await p.send('eth_chainId',[])))!==NETWORK.chainId)throw Error('Wrong chain');return p.getBlockNumber();}); res.json({name:NETWORK.name,chainId:NETWORK.chainId,block,transactionsEnabled:claimConfiguration().claimsEnabled}); }
  catch {res.status(503).json({error:'Mainnet RPC is unavailable. No cached or sample data is substituted.'});}
});
app.get('/api/inspect/:address', async (req,res) => {
  const address = req.params.address;
  if (!isAddress(address)) return res.status(400).json({error:'Enter a valid 0x wallet address (42 characters).'});
  const key = address.toLowerCase();
  const entry = cache.get(key);
  if (entry && Date.now()-entry.time < 15000) return res.json({...entry.value,cached:true});
  if (concurrent >= 5) return res.status(429).json({error:'Too many checks in progress. Please try again shortly.'});
  concurrent++;
  try {
    const value = await inspectWallet(address);
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key,{time:Date.now(),value});res.json(value);
  } catch(e) {
    console.error('Mainnet inspection failed:',e.shortMessage || e.message);
    res.status(503).json({error:'Could not verify mainnet data. No recovery amount can be confirmed. Please retry later.'});
  } finally {concurrent--;}
});
async function boundedRead(res, fn) {
  if(concurrent>=5)return res.status(429).json({error:'Too many checks in progress. Try again shortly.'});
  concurrent++;
  try{res.json(await fn());}
  catch(e){console.error('Evidence read failed:',e.shortMessage||e.message);res.status(503).json({error:'Could not verify these records. No events or recovery are assumed. Please retry.'});}
  finally{concurrent--;}
}
app.get('/api/history/:address',async(req,res)=>{
  if(!isAddress(req.params.address))return res.status(400).json({error:'Invalid wallet address.'});
  const raw=req.query.toBlock;
  if(raw!==undefined && (typeof raw!=='string'||!/^\d{1,10}$/.test(raw)))return res.status(400).json({error:'Invalid history cursor.'});
  await boundedRead(res,()=>scanHistory(req.params.address,raw===undefined?undefined:Number(raw)));
});
app.get('/api/transaction/:address/:hash',async(req,res)=>{
  if(!isAddress(req.params.address)||!/^0x[0-9a-fA-F]{64}$/.test(req.params.hash))return res.status(400).json({error:'Enter a valid wallet address and transaction hash.'});
  await boundedRead(res,()=>inspectTransaction(req.params.address,req.params.hash));
});
app.get('/api/config',(_req,res)=>res.json({version:'1.0.0',network:NETWORK.name,chainId:NETWORK.chainId,...claimConfiguration()}));
app.get('/api/claim/preview/:address',async(req,res)=>{
  if(!isAddress(req.params.address))return res.status(400).json({error:'Invalid wallet address.'});
  await boundedRead(res,()=>previewForWallet(req.params.address));
});
app.get('/api/claim/verify/:address/:hash',async(req,res)=>{
  if(!isAddress(req.params.address)||!/^0x[0-9a-fA-F]{64}$/.test(req.params.hash))return res.status(400).json({error:'Invalid wallet or transaction hash.'});
  await boundedRead(res,()=>verifyForWallet(req.params.address,req.params.hash));
});
app.get('/healthz',(_req,res)=>res.json({status:'ok',app:'Mezo Compass',version:'1.0.0'}));
app.use('/api',(_req,res)=>res.status(404).json({error:'Not found'}));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist')));
  app.get('*',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server:{ middlewareMode:true, allowedHosts:true }, appType:'spa' });
  app.use(vite.middlewares);
}
const port=Number(process.env.PORT)||3000;
app.listen(port,'0.0.0.0',()=>console.log(`Mezo Compass available on port ${port} — mainnet signing ${claimConfiguration().claimsEnabled?'enabled by deployment':'disabled; preview and verification available'}.`));
