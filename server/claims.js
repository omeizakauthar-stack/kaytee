import { withProvider } from './chain.js';
import { claimPreview, verifyClaim, CLAIM_KEYS } from '../src/claim-core.js';
const envKeys={borrowerOperations:'REVIEWED_BORROWER_CODE_HASH',troveManager:'REVIEWED_TROVE_CODE_HASH',collSurplusPool:'REVIEWED_SURPLUS_CODE_HASH'};
export function claimConfiguration(env=process.env){
  const pins=Object.fromEntries(CLAIM_KEYS.map(k=>[k,env[envKeys[k]]||'']));
  const pinsPresent=CLAIM_KEYS.every(k=>/^0x[0-9a-fA-F]{64}$/.test(pins[k]));
  const claimsEnabled=env.ENABLE_MAINNET_CLAIMS==='true'&&pinsPresent;
  return {claimsEnabled,pins:claimsEnabled?pins:null,reason:claimsEnabled?'Wallet signing is enabled by this deployment. This does not certify an independent audit.':'Mainnet signing is off. Simulations and receipt verification remain available.'};
}
export async function previewForWallet(address){const config=claimConfiguration();return withProvider(async provider=>({...await claimPreview(provider,address,{pins:config.pins}),deployment:config}));}
export async function verifyForWallet(address,hash){return withProvider(provider=>verifyClaim(provider,address,hash));}
