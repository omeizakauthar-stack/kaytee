import { BrowserProvider } from 'ethers';
import { NETWORK } from './network.js';
import { claimPreview, assertFreshQuote, assertOwner, assertPins, assertClaimTransaction, CLAIM_DATA } from './claim-core.js';

// The only signing entry point. No API route can call it; the browser wallet
// owns authorization and broadcasts. It never receives a private key.
export async function sendWalletClaim(ethereum,address,quote,configuration,{network=NETWORK,signal}={}){
  if(signal?.aborted)throw new Error('Recovery view closed. No wallet request will be started.');
  if(!configuration?.claimsEnabled)throw new Error('Mainnet signing is disabled by this deployment.');
  if(!ethereum?.request)throw new Error('No browser wallet detected.');
  assertFreshQuote(quote);assertOwner([quote.address],address);
  assertOwner(await ethereum.request({method:'eth_accounts'}),address);
  if(Number(BigInt(await ethereum.request({method:'eth_chainId'})))!==network.chainId)throw new Error('Switch your wallet to Mezo Mainnet before signing.');
  const provider=new BrowserProvider(ethereum,'any');
  try{
    // Re-simulate on the user's own wallet provider, independently of API quote.
    const current=await claimPreview(provider,address,{network,pins:configuration.pins});
    assertFreshQuote(current);assertPins(current.identities,configuration.pins);
    if(!current.hasGas)throw new Error('Not enough native BTC for the buffered fee budget.');
    if(current.surplusWei!==quote.surplusWei||current.gasLimit!==quote.gasLimit||BigInt(current.gasPrice)!==BigInt(quote.gasPrice))throw new Error('Collateral or network fee changed. Generate and review a new preview.');
    assertPins(quote.identities,configuration.pins);
    for(const key of Object.keys(current.identities))if(current.identities[key].codeHash!==quote.identities[key]?.codeHash)throw new Error('Deployment changed after preview. Do not sign.');
    assertFreshQuote(quote);
    assertOwner(await ethereum.request({method:'eth_accounts'}),address);
    if(Number(BigInt(await ethereum.request({method:'eth_chainId'})))!==network.chainId)throw new Error('Wallet network changed. Simulate again.');
    const tx={from:address,to:network.contracts.borrowerOperations,data:CLAIM_DATA,value:0n,chainId:network.chainId,gasLimit:BigInt(quote.gasLimit),gasPrice:BigInt(quote.gasPrice)};
    assertClaimTransaction(tx,address,network);
    const signer=await provider.getSigner(address);
    if(signal?.aborted)throw new Error('Recovery view closed. No wallet request will be started.');
    const response=await signer.sendTransaction(tx);
    return {hash:response.hash,address,submittedAt:Date.now(),chainId:network.chainId};
  }finally{provider.destroy();}
}
