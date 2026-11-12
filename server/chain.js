import { JsonRpcProvider, FetchRequest, Contract, getAddress, formatUnits } from 'ethers';
import { NETWORK } from '../src/network.js';
import { ABI, verifyDeployment } from '../src/protocol.js';
export { ABI, verifyDeployment } from '../src/protocol.js';

export function describeStatus(status, surplus) {
  const states = [
    ['No loan on record', 'The protocol reports no loan for this address. This does not prove that the wallet has never used another address or another deployment.'],
    ['Loan is active', 'Your MUSD loan is still open. This check does not establish whether a partial redemption happened.'],
    ['Closed by owner', 'The protocol records this loan as closed by its owner, not by redemption or liquidation.'],
    ['Closed by liquidation', 'The protocol records a liquidation. This is different from a redemption; this app cannot reverse it.'],
    ['Closed by redemption', 'The protocol records a full redemption: MUSD was exchanged against the loan, closing it. Any remaining collateral must be checked separately.'],
  ];
  const [title, explanation] = states[status] || ['Unknown loan state', 'This status is not recognized. Do not assume a cause or sign a transaction.'];
  return { title, explanation, hasSurplus: BigInt(surplus) > 0n, recognized: status >= 0 && status <= 4 };
}
export async function withProvider(fn) {
  let last;
  for (const url of [NETWORK.rpcUrl, 'https://mezo-mainnet.boar.network']) {
    const request = new FetchRequest(url); request.timeout = 12000;
    const provider = new JsonRpcProvider(request, NETWORK.chainId, { staticNetwork: true, batchMaxCount: 10, batchStallTime: 20 });
    try { return await fn(provider); } catch (e) { last = e; } finally { provider.destroy(); }
  }
  throw last;
}
export async function inspectWallet(rawAddress) {
  const address = getAddress(rawAddress);
  return withProvider(async provider => {
    const head = await provider.getBlockNumber();
    // A short head offset reduces reorg exposure but does not assert finality.
    const blockNumber = Math.max(0, head - 2);
    const block = await provider.getBlock(blockNumber);
    if (!block) throw new Error('Snapshot block unavailable.');
    if (Date.now()/1000 - block.timestamp > 600) throw new Error('RPC snapshot is stale. Retry later.');
    const checks = await verifyDeployment(provider, blockNumber);
    const tm = new Contract(NETWORK.contracts.troveManager, ABI.tm, provider);
    const pool = new Contract(NETWORK.contracts.collSurplusPool, ABI.pool, provider);
    const token = new Contract(NETWORK.contracts.musd, ABI.token, provider);
    const opts = { blockTag: blockNumber };
    const [statusRaw, surplus, musd, btc] = await Promise.all([tm.getTroveStatus(address,opts),pool.getCollateral(address,opts),token.balanceOf(address,opts),provider.getBalance(address,blockNumber)]);
    const status = Number(statusRaw);
    let debt = null, collateral = null;
    if (status === 1) {
      // Getter's first three values already include pending redistribution.
      const entire = await tm.getEntireDebtAndColl(address,opts);
      collateral = formatUnits(entire[0],18);
      debt = formatUnits(entire[1]+entire[2],18);
    }
    return { mode:'live', address, status, ...describeStatus(status,surplus), surplusWei: surplus.toString(), surplus: formatUnits(surplus,18), musd: formatUnits(musd,18), btc: formatUnits(btc,18), debt, collateral, checks, blockNumber, blockHash:block.hash, blockTimestamp: block.timestamp, checkedAt:new Date().toISOString(), contracts:NETWORK.contracts, transactionEnabled:false, historyAvailable:false };
  });
}
