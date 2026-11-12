import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ganache from 'ganache';
import solc from 'solc';
import { BrowserProvider, ContractFactory, parseEther } from 'ethers';
import { claimPreview, verifyClaim, CLAIM_KEYS } from '../src/claim-core.js';
import { sendWalletClaim } from '../src/wallet-claim.js';

test('LOCAL EVM: simulate, user-wallet send, payout receipt, zero surplus, and failure guards', {timeout:90000},async t=>{
  const source=readFileSync(new URL('./fixtures/RecoveryFixture.sol',import.meta.url),'utf8');
  const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Fixture.sol':{content:source}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
  const fatal=output.errors?.filter(e=>e.severity==='error')||[];assert.equal(fatal.length,0,JSON.stringify(fatal));
  const ethereum=ganache.provider({logging:{quiet:true},chain:{chainId:31612,hardfork:'shanghai'},wallet:{totalAccounts:3}});
  const provider=new BrowserProvider(ethereum);
  try{
    const signer=await provider.getSigner(0),other=await provider.getSigner(1),address=await signer.getAddress();
    const deploy=async name=>{const c=output.contracts['Fixture.sol'][name];const deployed=await new ContractFactory(c.abi,c.evm.bytecode.object,signer).deploy();await deployed.waitForDeployment();return deployed;};
    const token=await deploy('FixtureToken'),tm=await deploy('FixtureTroveManager'),pool=await deploy('FixturePool'),bo=await deploy('FixtureBorrowerOperations');
    const contracts={borrowerOperations:await bo.getAddress(),troveManager:await tm.getAddress(),collSurplusPool:await pool.getAddress(),musd:await token.getAddress()};
    const network={name:'LOCAL FIXTURE — NOT MAINNET',chainId:31612,contracts};
    await (await tm.wire(contracts.borrowerOperations,contracts.collSurplusPool,contracts.musd)).wait();
    await (await pool.wire(contracts.borrowerOperations,contracts.troveManager)).wait();
    await (await bo.wire(contracts.troveManager,contracts.collSurplusPool)).wait();
    await (await tm.setStatus(address,4)).wait();
    const noSurplus=await claimPreview(provider,address,{network});assert.equal(noSurplus.eligible,false);
    await (await pool.seed(address,{value:parseEther('0.01')})).wait();
    const quote=await claimPreview(provider,address,{network});
    assert.equal(quote.eligible,true);assert.equal(quote.simulation,'passed');assert.equal(quote.surplusWei,parseEther('0.01').toString());assert.equal(quote.hasGas,true);
    const pins=Object.fromEntries(CLAIM_KEYS.map(k=>[k,quote.identities[k].codeHash]));
    await assert.rejects(()=>sendWalletClaim(ethereum,address,quote,{claimsEnabled:false,pins},{network}),/disabled/);
    await assert.rejects(()=>sendWalletClaim(ethereum,'0x2222222222222222222222222222222222222222',quote,{claimsEnabled:true,pins},{network}));
    await assert.rejects(()=>sendWalletClaim(ethereum,address,quote,{claimsEnabled:true,pins:{...pins,borrowerOperations:'0x'+'0'.repeat(64)}},{network}),/pin|changed/);
    const rejectedWallet={request:async req=>{if(req.method==='eth_sendTransaction'){const error=Error('User rejected');error.code=4001;throw error;}return ethereum.request(req);}};
    await assert.rejects(()=>sendWalletClaim(rejectedWallet,address,quote,{claimsEnabled:true,pins},{network}));
    assert.equal((await pool.getCollateral(address)).toString(),parseEther('0.01').toString());
    const submitted=await sendWalletClaim(ethereum,address,quote,{claimsEnabled:true,pins},{network});
    const tx=await provider.getTransaction(submitted.hash);assert.ok(tx);await tx.wait();
    const confirming=await verifyClaim(provider,address,submitted.hash,{network});
    assert.equal(confirming.state,'confirming');assert.equal(confirming.payout,'0.01');assert.equal(confirming.surplusAfterWei,'0');
    await provider.send('evm_mine',[]);
    const verified=await verifyClaim(provider,address,submitted.hash,{network});assert.equal(verified.state,'confirmed');assert.equal(verified.payoutWei,parseEther('0.01').toString());
    // A normal transfer cannot be called a collateral recovery.
    const unrelated=await signer.sendTransaction({to:await other.getAddress(),value:1n});await unrelated.wait();
    await assert.rejects(()=>verifyClaim(provider,address,unrelated.hash,{network}),/exact supported/);
    // Empty collateral and a non-redemption status both stop a second claim.
    const after=await claimPreview(provider,address,{network});assert.equal(after.eligible,false);
    await (await tm.setStatus(address,3)).wait();const liquidated=await claimPreview(provider,address,{network});assert.equal(liquidated.eligible,false);
    // Receipt success without payout must not become a recovery.
    const otherAddress=await other.getAddress();await (await tm.setStatus(otherAddress,4)).wait();
    const wrongNetwork={...network,chainId:1};await assert.rejects(()=>claimPreview(provider,address,{network:wrongNetwork}),/Wrong chain/);
    // A successful transaction without a pool payout event is not enough.
    await (await tm.setStatus(address,4)).wait();
    await (await pool.seed(address,{value:parseEther('0.001')})).wait();
    await (await pool.setOmitPayoutEvent(true)).wait();
    const noEventTx=await bo.claimCollateral();await noEventTx.wait();
    await assert.rejects(()=>verifyClaim(provider,address,noEventTx.hash,{network}),/no matching collateral payout/);
    // A reverted exact claim cannot establish a recovery, even with the right selector.
    const failed=await bo.claimCollateral({gasLimit:200000});
    try{await failed.wait();}catch{}
    const failureResult=await verifyClaim(provider,address,failed.hash,{network});assert.equal(failureResult.state,'reverted');
    console.log('LOCAL FIXTURE ONLY: successful claim, exact wallet send, two-confirmation receipt, payout and surplus verified. No mainnet transaction.');
  }finally{provider.destroy();await ethereum.disconnect();}
});
