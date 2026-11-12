import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, decodeWalletLog, decodeSuccessfulReceipt, historyRange } from '../server/history.js';
const wallet='0x1111111111111111111111111111111111111111';
const other='0x2222222222222222222222222222222222222222';
function log(source,event,args,extra={}){
  const s=SOURCES.find(s=>s.name===source);const {topics,data}=s.iface.encodeEventLog(s.iface.getEvent(event),args);
  return {address:s.address,topics,data,index:7,transactionHash:'0x'+'a'.repeat(64),blockHash:'0x'+'b'.repeat(64),blockNumber:12345,removed:false,...extra};
}
const update=(source,op,zero=false)=>log(source,'TroveUpdated',[wallet,zero?0n:100n,0n,zero?0n:50n,0n,100,1234n,op]);
test('operation 2 is source-specific: adjust vs redemption',()=>{
  assert.equal(decodeWalletLog(update('BorrowerOperations',2),wallet).kind,'adjusted');
  assert.equal(decodeWalletLog(update('TroveManager',2),wallet).kind,'redemption-update');
});
test('redemption zero balances produce full-redemption record, not a claim amount',()=>{
  const e=decodeWalletLog(update('TroveManager',2,true),wallet);
  assert.equal(e.kind,'redeemed');assert.match(e.detail,/checked separately/);
});
test('unknown operations never get a known cause',()=>{assert.equal(decodeWalletLog(update('TroveManager',99),wallet).kind,'unknown')});
test('ignore removed, unrelated-wallet, unrecognized-emitter, and malformed logs',()=>{
  const l=update('TroveManager',2);
  assert.equal(decodeWalletLog({...l,removed:true},wallet),null);
  assert.equal(decodeWalletLog(l,other),null);
  assert.equal(decodeWalletLog({...l,address:other},wallet),null);
  assert.equal(decodeWalletLog({...l,data:'0x1234'},wallet),null);
});
test('zero surplus event does not claim proof of payout',()=>{
  const e=decodeWalletLog(log('CollSurplusPool','CollBalanceUpdated',[wallet,0n]),wallet);
  assert.equal(e.kind,'surplus');assert.match(e.detail,/not proof of a payout/);
});
test('payout decoded only for account and configured pool',()=>{
  const l=log('CollSurplusPool','CollateralSent',[wallet,42n]);
  assert.equal(decodeWalletLog(l,wallet).kind,'payout');assert.equal(decodeWalletLog(l,other),null);
});
test('failed transaction cannot establish successful protocol events',()=>{
  assert.deepEqual(decodeSuccessfulReceipt({status:0,logs:[update('TroveManager',2)]},wallet),[]);
  assert.equal(decodeSuccessfulReceipt({status:1,logs:[update('TroveManager',2)]},wallet).length,1);
});
test('history pages are bounded with contiguous nonoverlapping cursors',()=>{
  const a=historyRange(10000);const b=historyRange(a.nextToBlock);
  assert.equal(a.toBlock-a.fromBlock+1,5000);assert.equal(b.toBlock,a.fromBlock-1);
  assert.deepEqual(historyRange(10),{fromBlock:0,toBlock:10,nextToBlock:null});
  for(const input of [-1,NaN,1.5,Infinity,'1'])assert.throws(()=>historyRange(input));
});
