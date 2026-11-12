import { readFileSync } from 'node:fs';
import { Interface, getAddress, zeroPadValue, formatUnits } from 'ethers';
import { NETWORK } from '../src/network.js';
import { withProvider, verifyDeployment } from './chain.js';

const names = ['BorrowerOperations','TroveManager','CollSurplusPool'];
const keys = ['borrowerOperations','troveManager','collSurplusPool'];
export const SOURCES = names.map((name,i)=>({name,address:NETWORK.contracts[keys[i]],iface:new Interface(JSON.parse(readFileSync(new URL(`../docs/mainnet-${name}.json`,import.meta.url))).abi)}));
const indexedNames = ['TroveCreated','TroveUpdated','TroveLiquidated','CollBalanceUpdated'];
export const HISTORY_WINDOW = 5000;
const same=(a,b)=>a?.toLowerCase()===b?.toLowerCase();

// Interpret operation codes only in the emitter's own namespace. BorrowerOperations
// code 2 means adjustTrove, whereas TroveManager code 2 means redeemCollateral.
export function decodeWalletLog(log, wallet) {
  if (log.removed) return null;
  const source=SOURCES.find(s=>same(s.address,log.address));
  if(!source)return null;
  let parsed;try{parsed=source.iface.parseLog(log);}catch{return null;}
  if(!parsed)return null;
  const a=parsed.args;
  const subject=a._borrower ?? a._account ?? (parsed.name==='CollateralSent'?a._to:null);
  if(!same(subject,wallet))return null;
  let title,detail,kind='update';
  if(parsed.name==='TroveCreated'){
    title='Loan created';detail='Borrower Operations emitted a loan-creation record.';kind='opened';
  }else if(parsed.name==='TroveLiquidated'){
    title='Liquidation recorded';detail='Trove Manager emitted a liquidation for this wallet. This is not a redemption.';kind='liquidated';
  }else if(parsed.name==='TroveUpdated'){
    const op=Number(a._operation);
    const zero=a._principal===0n && a._interest===0n && a._coll===0n;
    if(source.name==='TroveManager' && op===2){
      title=zero?'Full redemption recorded':'Redemption update recorded';kind=zero?'redeemed':'redemption-update';
      detail=zero?'The redemption operation emitted zero principal, interest, and loan collateral. Remaining collateral is checked separately.':'The redemption operation updated this loan. This is a post-event balance, not the amount of BTC redeemed.';
    }else if(source.name==='TroveManager' && op===1){title='Liquidation state updated';detail='Loan balances were updated by the liquidation operation.';kind='liquidated';}
    else if(source.name==='TroveManager' && op===0){title='Pending rewards applied';detail='The protocol applied pending redistribution to this loan.';}
    else if(source.name==='BorrowerOperations' && op>=0 && op<=3){
      title=['Loan opened','Owner closure recorded','Loan adjusted','Loan refinanced'][op];kind=['opened','owner-closed','adjusted','refinanced'][op];
      detail='Borrower Operations emitted this loan update. Operation codes are interpreted using this contract’s ABI and source.';
    }else{title='Unrecognized loan operation';detail=`Raw operation ${op}. No cause is inferred.`;kind='unknown';}
    detail+=` Post-event loan collateral: ${formatUnits(a._coll,18)} BTC; principal plus recorded interest: ${formatUnits(a._principal+a._interest,18)} MUSD.`;
  }else if(parsed.name==='CollBalanceUpdated'){
    title=a._newBalance>0n?'Surplus balance recorded':'Surplus balance set to zero';kind='surplus';
    detail=`The surplus pool recorded ${formatUnits(a._newBalance,18)} BTC for this account. A zero-balance event alone is not proof of a payout.`;
  }else if(parsed.name==='CollateralSent' && source.name==='CollSurplusPool'){
    title='Collateral payout recorded';kind='payout';detail=`The surplus pool emitted a ${formatUnits(a._amount,18)} BTC payout record for this account. This event does not independently establish the final recipient balance.`;
  }else return null;
  return {id:`${log.transactionHash}:${log.index}`,title,detail,kind,event:parsed.name,contract:source.name,contractAddress:source.address,blockNumber:log.blockNumber,blockHash:log.blockHash,transactionHash:log.transactionHash,logIndex:log.index};
}
export function historyRange(toBlock) {
  if(!Number.isSafeInteger(toBlock)||toBlock<0)throw new Error('Invalid history cursor.');
  const fromBlock=Math.max(0,toBlock-HISTORY_WINDOW+1);
  return {fromBlock,toBlock,nextToBlock:fromBlock>0?fromBlock-1:null};
}
export async function scanHistory(rawAddress,cursor) {
  const address=getAddress(rawAddress);
  return withProvider(async provider=>{
    const head=await provider.getBlockNumber();
    const toBlock=cursor===undefined?Math.max(0,head-2):cursor;
    if(toBlock>Math.max(0,head-2))throw new Error('History cursor is ahead of the snapshot head.');
    const range=historyRange(toBlock);
    await verifyDeployment(provider,toBlock);
    const end=await provider.getBlock(toBlock);
    const signatures=[...new Set(SOURCES.flatMap(s=>indexedNames.flatMap(n=>{try{const e=s.iface.getEvent(n);return e?[e.topicHash]:[];}catch{return [];}})))];
    const logs=await provider.getLogs({address:SOURCES.map(s=>s.address),fromBlock:range.fromBlock,toBlock,topics:[signatures,zeroPadValue(address,32)]});
    if(logs.length>2000)throw new Error('Too many records in this history window.');
    const events=logs.map(l=>decodeWalletLog(l,address)).filter(Boolean).sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex);
    const endAfter=await provider.getBlock(toBlock);
    if(!end || !endAfter || end.hash!==endAfter.hash)throw new Error('History boundary block changed; retry.');
    return {mode:'live',address,...range,boundaryHash:end.hash,events,coverage:'partial',source:'Mainnet RPC logs',note:'Only the displayed block range and supported wallet-indexed events were searched. Empty results do not prove no past activity. Payout records can be checked by transaction hash. Historical ABI compatibility is not independently audited.'};
  });
}
export function decodeSuccessfulReceipt(receipt,address) {
  if(receipt.status!==1)return [];
  return receipt.logs.map(log=>decodeWalletLog(log,address)).filter(Boolean);
}
export async function inspectTransaction(rawAddress,hash) {
  const address=getAddress(rawAddress);
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction hash.');
  return withProvider(async provider=>{
    const head=await provider.getBlockNumber();
    await verifyDeployment(provider,Math.max(0,head-2));
    const receipt=await provider.getTransactionReceipt(hash);
    if(!receipt)return {address,hash,found:false,events:[],note:'Receipt not found. The transaction may be pending, on another network, or unknown to this provider.'};
    const block=await provider.getBlock(receipt.blockNumber);
    if(!block || block.hash!==receipt.blockHash)throw new Error('Receipt is not in the current canonical chain.');
    if(receipt.status!==1)return {address,hash,found:true,success:false,events:[],note:'The transaction failed. No successful protocol event is attributed to this wallet.'};
    const events=decodeSuccessfulReceipt(receipt,address);
    return {address,hash,found:true,success:true,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,timestamp:block.timestamp,confirmations:head-receipt.blockNumber+1,events,note:events.length?'Decoded only supported events from the configured protocol contracts for this wallet. This is not a complete trace or security audit.':'No supported wallet-specific protocol events found in this successful transaction. Do not infer a recovery.'};
  });
}
