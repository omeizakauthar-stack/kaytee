import { withProvider, verifyDeployment } from '../server/chain.js';
import { deploymentIdentities } from '../src/claim-core.js';
console.log('READ-ONLY DISCOVERY, NOT A REVIEW. Do not auto-copy these into a signing deployment.');
console.log(JSON.stringify(await withProvider(async p=>{const n=await p.getBlockNumber();await verifyDeployment(p,n);return {blockNumber:n,identities:await deploymentIdentities(p,n)};}),null,2));
