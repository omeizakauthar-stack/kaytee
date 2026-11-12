// Fictional teaching examples. Never pass these to a wallet or present as live chain data.
const base = { mode:'demo', address:null, musd:'0', btc:'0.0042', debt:null, collateral:null, blockNumber:null, transactionEnabled:false, historyAvailable:false };
export const EXAMPLES = {
  redeemed: {...base,status:4,title:'Closed by redemption',explanation:'In this fictional example, another user exchanged MUSD against the loan. The debt was cleared and the loan closed. The remaining BTC is separate from the redeemed collateral.',surplus:'0.01842',surplusWei:'18420000000000000',hasSurplus:true,musd:'230.50'},
  active: {...base,status:1,title:'Loan is active',explanation:'In this fictional example, the MUSD loan is still open. An active loan alone cannot tell us whether a partial redemption occurred.',surplus:'0',surplusWei:'0',hasSurplus:false,debt:'2500',collateral:'0.05',musd:'1200'},
  liquidated: {...base,status:3,title:'Closed by liquidation',explanation:'In this fictional example, the protocol records a liquidation, not a redemption. Compass cannot reverse a liquidation or restore collateral that is no longer owed.',surplus:'0',surplusWei:'0',hasSurplus:false,musd:'82.00'},
};
