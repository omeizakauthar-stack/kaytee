import { Contract } from 'ethers';
import { NETWORK } from './network.js';
export const ABI = {
  tm: ['function borrowerOperations() view returns(address)', 'function collSurplusPool() view returns(address)', 'function musdToken() view returns(address)', 'function getTroveStatus(address) view returns(uint8)', 'function getEntireDebtAndColl(address) view returns(uint256 coll,uint256 principal,uint256 interest,uint256 pendingCollateral,uint256 pendingPrincipal,uint256 pendingInterest)'],
  bo: ['function troveManager() view returns(address)', 'function collSurplusPool() view returns(address)', 'function claimCollateral()'],
  pool: ['function borrowerOperationsAddress() view returns(address)', 'function troveManagerAddress() view returns(address)', 'function getCollateral(address) view returns(uint256)'],
  token: ['function balanceOf(address) view returns(uint256)', 'function decimals() view returns(uint8)'],
};
const same = (a,b) => a.toLowerCase() === b.toLowerCase();
export async function verifyDeployment(provider, blockTag, network = NETWORK) {
  if (Number(BigInt(await provider.send('eth_chainId', []))) !== network.chainId) throw new Error('Wrong chain returned by RPC.');
  const c = network.contracts;
  const codes = await Promise.all(Object.values(c).map(a => provider.getCode(a, blockTag)));
  if (codes.some(code => code === '0x')) throw new Error('Expected contract code was not found.');
  const tm = new Contract(c.troveManager, ABI.tm, provider);
  const bo = new Contract(c.borrowerOperations, ABI.bo, provider);
  const pool = new Contract(c.collSurplusPool, ABI.pool, provider);
  const opts = { blockTag };
  const actual = await Promise.all([tm.borrowerOperations(opts), tm.collSurplusPool(opts), tm.musdToken(opts), bo.troveManager(opts), bo.collSurplusPool(opts), pool.borrowerOperationsAddress(opts), pool.troveManagerAddress(opts)]);
  const expected = [c.borrowerOperations,c.collSurplusPool,c.musd,c.troveManager,c.collSurplusPool,c.borrowerOperations,c.troveManager];
  if (!actual.every((a,i) => same(a,expected[i]))) throw new Error('Contract relationships do not match the configured deployment.');
  const token = new Contract(c.musd, ABI.token, provider);
  if (Number(await token.decimals(opts)) !== 18) throw new Error('Unexpected MUSD decimals.');
  return { chainId: network.chainId, codePresent: true, relationshipsMatch: true, note: 'Checks confirm chain, contract code presence and cross-references, not an audit or a guarantee of safety.' };
}
