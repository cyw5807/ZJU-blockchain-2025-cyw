import Addresses from './contract-addresses.json'
import EasyBet from './abis/EasyBet.json'
import MyERC20 from './abis/MyERC20.json'
import LotteryNFT from './abis/LotteryNFT.json'

const Web3 = require('web3');

// 创建web3实例，优先使用 window.ethereum（现代 MetaMask 注入），其次回退到 window.web3.currentProvider
// 若都不存在，则回退到本地 RPC（仅作开发备用）
// 可以阅读获取更多信息 https://docs.metamask.io/guide/provider-migration.html#replacing-window-web3
// @ts-ignore
const _provider = (window as any).ethereum || (window as any).web3?.currentProvider;
let web3: any;
if (_provider) {
	web3 = new Web3(_provider);
} else {
	// 回退到本地节点，避免运行时报错；部署环境中应保证 provider 可用
	web3 = new Web3('http://localhost:8545');
}

// 修改地址为部署的合约地址
const easyBetAddress = Addresses.EasyBet
const easyBetABI = EasyBet.abi
const myERC20Address = Addresses.MyERC20
const myERC20ABI = MyERC20.abi

const lotteryNFTAddress = Addresses.LotteryNFT
const lotteryNFTABI = LotteryNFT.abi

// 获取合约实例
const lotteryContract = new web3.eth.Contract(easyBetABI, easyBetAddress);
const myERC20Contract = new web3.eth.Contract(myERC20ABI, myERC20Address);
const lotteryNFTContract = new web3.eth.Contract(lotteryNFTABI, lotteryNFTAddress);

// 导出web3实例和其它部署的合约
// 导出web3实例和其它部署的合约
export {web3, lotteryContract, myERC20Contract, lotteryNFTContract}