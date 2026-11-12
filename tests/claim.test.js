import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAIM_DATA, assertOwner, assertFreshQuote, assertPins, assertClaimTransaction, CLAIM_KEYS } from '../src/claim-core.js';
import { claimConfiguration } from '../server/claims.js';
import { NETWORK } from '../src/network.js';
const address='0x1111111111111111111111111111111111111111';
test('no signing by default, even when enabled without complete implementation pins',()=>{
  assert.equal(claimConfiguration({}).claimsEnabled,false);
  assert.equal(claimConfiguration({ENABLE_MAINNET_CLAIMS:'true'}).claimsEnabled,false);
});
test('signing requires explicit enable plus all three pins',()=>{
  const pins={REVIEWED_BORROWER_CODE_HASH:'0x'+'a'.repeat(64),REVIEWED_TROVE_CODE_HASH:'0x'+'b'.repeat(64),REVIEWED_SURPLUS_CODE_HASH:'0x'+'c'.repeat(64)};
  assert.equal(claimConfiguration({...pins}).claimsEnabled,false);
  assert.equal(claimConfiguration({...pins,ENABLE_MAINNET_CLAIMS:'true'}).claimsEnabled,true);
});
test('owner and quote expiry are enforced',()=>{
  assert.doesNotThrow(()=>assertOwner([address],address));
  assert.throws(()=>assertOwner([],address));assert.throws(()=>assertOwner([NETWORK.contracts.musd],address));
  assert.doesNotThrow(()=>assertFreshQuote({eligible:true,expiresAt:2000},1000));
  assert.throws(()=>assertFreshQuote({eligible:true,expiresAt:1000},1000));
  assert.throws(()=>assertFreshQuote({eligible:false,expiresAt:2000},1000));
});
test('only exact zero-value claim is permitted: no transfers, approvals or extra data',()=>{
  const tx={from:address,to:NETWORK.contracts.borrowerOperations,data:CLAIM_DATA,value:0n,chainId:31612};
  assert.doesNotThrow(()=>assertClaimTransaction(tx,address));
  for(const bad of [{value:1n},{data:'0x095ea7b3'},{data:CLAIM_DATA+'00'},{to:address},{from:NETWORK.contracts.musd},{chainId:1}])assert.throws(()=>assertClaimTransaction({...tx,...bad},address));
});
test('changed, missing or malformed implementation pins fail closed',()=>{
  const pins=Object.fromEntries(CLAIM_KEYS.map(k=>[k,'0x'+'a'.repeat(64)]));
  const ids=Object.fromEntries(CLAIM_KEYS.map(k=>[k,{codeHash:pins[k]}]));
  assert.doesNotThrow(()=>assertPins(ids,pins));assert.throws(()=>assertPins(ids,null));
  assert.throws(()=>assertPins({...ids,borrowerOperations:{codeHash:'0x'+'b'.repeat(64)}},pins));
});
