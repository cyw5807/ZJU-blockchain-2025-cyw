// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyERC20 is ERC20 {
    mapping(address => bool) claimedAirdropPlayerList;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        // 构造函数中可以初始化一些参数
    }

    /**
     * @dev 空投代币函数，每个用户只能领取一次
     */
    function airdrop() external {
        require(claimedAirdropPlayerList[msg.sender] == false, "This user has claimed airdrop already");
        _mint(msg.sender, 10000 * 10 ** decimals()); // 发放10000个代币（考虑小数位）
        claimedAirdropPlayerList[msg.sender] = true;
    }

    /**
     * @dev 返回代币的小数位数
     */
    function decimals() public view virtual override returns (uint8) {
        return 18; // 使用标准的18位小数
    }
}