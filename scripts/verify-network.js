import { withProvider, verifyDeployment, inspectWallet } from '../server/chain.js';
const checks = await withProvider(async p => verifyDeployment(p, await p.getBlockNumber()));
console.log('Deployment checks:', checks);
const address = process.argv[2] || '0x0000000000000000000000000000000000000000';
console.log('Read-only inspection:',JSON.stringify(await inspectWallet(address),null,2));
