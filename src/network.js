// Mainnet addresses from mezo-org/musd deployment artifacts.
// Runtime code, contract relationships and claim simulation must be checked
// before enabling any wallet transaction. This configuration alone is not a verification.
export const NETWORK = Object.freeze({
  name: 'Mezo Mainnet',
  chainId: 31612,
  chainIdHex: '0x7b7c',
  rpcUrl: 'https://mezo.drpc.org',
  explorer: 'https://explorer.mezo.org',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  contracts: {
    borrowerOperations: '0x44b1bac67dDA612a41a58AAf779143B181dEe031',
    troveManager: '0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193',
    collSurplusPool: '0xBF51807ACb3394B8550f0554FB9098856Ef5F491',
    musd: '0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186',
  },
});
// Safe default. Actual signing additionally requires server configuration, all
// reviewed implementation-code pins, fresh simulation and explicit wallet approval.
export const CLAIM_TRANSACTIONS_ENABLED = false;
