// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// UNSAFE, LOCAL TEST FIXTURES ONLY. Not Mezo contracts and never for deployment.
contract FixtureToken {
    function decimals() external pure returns(uint8){return 18;}
    function balanceOf(address) external pure returns(uint256){return 0;}
}
contract FixtureTroveManager {
    address public borrowerOperations;
    address public collSurplusPool;
    address public musdToken;
    mapping(address=>uint8) public statuses;
    function wire(address bo,address pool,address token) external {borrowerOperations=bo;collSurplusPool=pool;musdToken=token;}
    function setStatus(address account,uint8 status) external {statuses[account]=status;}
    function getTroveStatus(address account) external view returns(uint8){return statuses[account];}
}
contract FixturePool {
    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    mapping(address=>uint256) public balances;
    bool public omitPayoutEvent;
    function setOmitPayoutEvent(bool flag) external {omitPayoutEvent=flag;}
    event CollBalanceUpdated(address indexed _account,uint256 _newBalance);
    event CollateralSent(address _to,uint256 _amount);
    function wire(address bo,address tm) external {borrowerOperationsAddress=bo;troveManagerAddress=tm;}
    function seed(address account) external payable {balances[account]+=msg.value;emit CollBalanceUpdated(account,balances[account]);}
    function getCollateral(address account) external view returns(uint256){return balances[account];}
    function claim(address account) external {
        require(msg.sender==borrowerOperationsAddress,"Only BO");
        uint256 value=balances[account];require(value>0,"No collateral");balances[account]=0;
        emit CollBalanceUpdated(account,0);if(!omitPayoutEvent)emit CollateralSent(account,value);
        (bool sent,)=payable(account).call{value:value}("");require(sent,"Payout failed");
    }
}
contract FixtureBorrowerOperations {
    address public troveManager;
    FixturePool public collSurplusPool;
    function wire(address tm,address pool) external {troveManager=tm;collSurplusPool=FixturePool(pool);}
    function claimCollateral() external {collSurplusPool.claim(msg.sender);}
}
