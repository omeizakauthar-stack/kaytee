import { Contract, Interface, getAddress, keccak256, toUtf8Bytes, toBeHex, formatUnits, ZeroAddress } from 'ethers';
import { NETWORK } from './network.js';
import { ABI, verifyDeployment } from './protocol.js';

export const CLAIM_DATA = new Interface(ABI.bo).encodeFunctionData('claimCollateral');
export const IMPLEMENTATION_SLOT = toBeHex(BigInt(keccak256(toUtf8Bytes('eip1967.proxy.implementation'))) - 1n,32);
export const CLAIM_KEYS=['borrowerOperations','troveManager','collSurplusPool'];
const poolEvents=new Interface(['event CollateralSent(address _to,uint256 _amount)']);
export const sameAddress=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export function assertOwner(accounts,address){if(!accounts?.[0]||!sameAddress(accounts[0],address))throw new Error('Connect the same wallet as the inspected loan owner.');}
export function assertFreshQuote(quote,now=Date.now()){if(!quote?.eligible||!Number.isFinite(quote.expiresAt)||now>=quote.expiresAt)throw new Error('Preview expired or is not eligible. Simulate again before signing.');}
export function assertClaimTransaction(tx,address,network=NETWORK){
  if(!sameAddress(tx.from,address)||!sameAddress(tx.to,network.contracts.borrowerOperations)||BigInt(tx.value??0)!==0n||(tx.data||'').toLowerCase()!==CLAIM_DATA.toLowerCase()||(tx.chainId!=null&&Number(tx.chainId)!==network.chainId))throw new Error('Transaction is not the exact supported zero-value collateral claim.');
}
export function assertPins(identities,pins){
  if(!pins||!CLAIM_KEYS.every(k=>/^0x[0-9a-fA-F]{64}$/.test(pins[k]||'')))throw new Error('Reviewed implementation pins are not configured. Mainnet signing is disabled.');
  for(const k of CLAIM_KEYS)if(identities[k]?.codeHash?.toLowerCase()!==pins[k].toLowerCase())throw new Error('Implementation code changed or does not match the configured pin. Do not sign.');
}
export async function deploymentIdentities(provider,blockTag,network=NETWORK){
  const entries=await Promise.all(CLAIM_KEYS.map(async key=>{
    const address=network.contracts[key];const slot=await provider.getStorage(address,IMPLEMENTATION_SLOT,blockTag);
    const implementation=getAddress('0x'+slot.replace(/^0x/,'').padStart(64,'0').slice(-40));
    const codeAddress=implementation===ZeroAddress?address:implementation;
    const code=await provider.getCode(codeAddress,blockTag);
    if(code==='0x')throw new Error('Implementation code is unavailable.');
    return [key,{proxy:address,implementation:codeAddress,codeHash:keccak256(code)}];
  }));return Object.fromEntries(entries);
}
export async function claimPreview(provider,rawAddress,{network=NETWORK,pins=null}={}){
  const address=getAddress(rawAddress);
  const blockNumber=Number(BigInt(await provider.send('eth_blockNumber',[])));
  await verifyDeployment(provider,blockNumber,network);
  const block=await provider.getBlock(blockNumber);
  if(!block||Date.now()/1000-block.timestamp>600||block.timestamp-Date.now()/1000>120)throw new Error('RPC block is unavailable or stale.');
  const pool=new Contract(network.contracts.collSurplusPool,ABI.pool,provider),tm=new Contract(network.contracts.troveManager,ABI.tm,provider);
  const [status,balance]=await Promise.all([tm.getTroveStatus(address,{blockTag:blockNumber}),pool.getCollateral(address,{blockTag:blockNumber})]);
  const base={address,chainId:network.chainId,blockNumber,blockHash:block.hash,surplusWei:balance.toString(),surplus:formatUnits(balance,18),status:Number(status),createdAt:Date.now(),expiresAt:Date.now()+60000};
  if(status!==4n)return {...base,eligible:false,reason:'This recovery flow supports only loans closed by full redemption. No transaction is prepared.'};
  if(balance<=0n)return {...base,eligible:false,reason:'The protocol reports no collateral available to claim. No transaction is prepared.'};
  const identities=await deploymentIdentities(provider,blockNumber,network);
  if(pins)assertPins(identities,pins);
  const tx={from:address,to:network.contracts.borrowerOperations,data:CLAIM_DATA,value:0n};
  await provider.call({...tx,blockTag:blockNumber});
  const [estimate,priceHex,nativeBalance]=await Promise.all([provider.estimateGas(tx),provider.send('eth_gasPrice',[]),provider.getBalance(address,blockNumber)]);
  const gasLimit=(estimate*130n+99n)/100n,gasPrice=BigInt(priceHex);
  if(gasPrice<=0n)throw new Error('A valid network fee could not be estimated.');
  const feeBudget=gasLimit*gasPrice;
  return {...base,eligible:true,simulation:'passed',identities,gasEstimate:estimate.toString(),gasLimit:gasLimit.toString(),gasPrice:gasPrice.toString(),feeBudgetWei:feeBudget.toString(),feeBudget:formatUnits(feeBudget,18),nativeBalanceWei:nativeBalance.toString(),hasGas:nativeBalance>=feeBudget,transaction:{to:tx.to,data:tx.data,value:'0'},note:'Simulation is not a guarantee. The fee uses the current gas price and a 30% gas-limit buffer; your wallet shows the final fee.'};
}
export async function verifyClaim(provider,rawAddress,hash,{network=NETWORK}={}){
  const address=getAddress(rawAddress);
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction hash.');
  if(Number(BigInt(await provider.send('eth_chainId',[])))!==network.chainId)throw new Error('Wrong network.');
  const [receipt,tx]=await Promise.all([provider.getTransactionReceipt(hash),provider.getTransaction(hash)]);
  if(!receipt)return {state:'pending',hash,address,note:'No receipt found yet. Do not submit a second claim.'};
  if(!tx)throw new Error('Transaction details unavailable; cannot establish this is a claim.');
  assertClaimTransaction(tx,address,network);
  const block=await provider.getBlock(receipt.blockNumber);
  if(!block||block.hash!==receipt.blockHash)throw new Error('Receipt is not in the current canonical chain.');
  if(receipt.status!==1)return {state:'reverted',hash,address,note:'The transaction reverted. This is not a recovery. A network fee may still have been charged.'};
  const head=Number(BigInt(await provider.send('eth_blockNumber',[])));
  const confirmations=head-receipt.blockNumber+1;
  let payout=0n;
  for(const log of receipt.logs){
    if(log.removed||!sameAddress(log.address,network.contracts.collSurplusPool))continue;
    let parsed;try{parsed=poolEvents.parseLog(log);}catch{continue;}
    if(parsed&&sameAddress(parsed.args._to,address))payout+=parsed.args._amount;
  }
  if(payout<=0n)throw new Error('Successful receipt has no matching collateral payout record. Recovery is unverified.');
  const pool=new Contract(network.contracts.collSurplusPool,ABI.pool,provider);
  const [surplusAfter,walletBalance]=await Promise.all([pool.getCollateral(address,{blockTag:receipt.blockNumber}),provider.getBalance(address,receipt.blockNumber)]);
  const state=confirmations>=2?'confirmed':'confirming';
  return {state,address,hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,confirmations,payoutWei:payout.toString(),payout:formatUnits(payout,18),surplusAfterWei:surplusAfter.toString(),surplusAfter:formatUnits(surplusAfter,18),walletBalance:formatUnits(walletBalance,18),note:state==='confirmed'?'Exact claim transaction succeeded and emitted a matching payout record. Two block confirmations are not a finality guarantee.':'Payout record found. Wait for a second block confirmation and check again.'};
}
