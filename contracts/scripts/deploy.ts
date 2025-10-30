import { ethers } from "hardhat";

async function main() {
  // 获取合约工厂
  const [deployer] = await ethers.getSigners();
  const LotteryNFT = await ethers.getContractFactory("LotteryNFT");
  const MyERC20 = await ethers.getContractFactory("MyERC20");
  const EasyBet = await ethers.getContractFactory("EasyBet");
  
  // 部署彩票NFT合约
  // console.log("Deploying LotteryNFT contract...");
  const lotteryNFT = await LotteryNFT.deploy(deployer.address);
  await lotteryNFT.deployed();
  console.log(`LotteryNFT deployed to: ${lotteryNFT.address}`);

  // 部署代币合约
  // console.log("Deploying MyERC20 contract...");
  const myERC20 = await MyERC20.deploy("ZJU Token", "ZJU");
  await myERC20.deployed();
  console.log(`MyERC20 deployed to: ${myERC20.address}`);

  // 部署主合约，传入彩票NFT合约地址和 ZJU 代币合约地址（EasyBet 构造函数需要两个地址）
  // console.log("Deploying EasyBet contract...");
  const easyBet = await EasyBet.deploy(lotteryNFT.address, myERC20.address);
  await easyBet.deployed();
  console.log(`EasyBet deployed to: ${easyBet.address}`);

  // 授权 EasyBet 合约在 LotteryNFT 上进行操作（铸造和强制下架）
  // console.log(`Authorizing EasyBet on LotteryNFT...`);
  const tx = await lotteryNFT.authorizeEasyBet(easyBet.address);
  await tx.wait();
  // console.log(`EasyBet has been authorized on LotteryNFT`);
  
  console.log("Deployment completed successfully!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});