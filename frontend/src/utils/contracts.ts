import Addresses from './contract-addresses.json'
import EasyBet from './abis/EasyBet.json'
import MyERC20 from './abis/MyERC20.json'

const Web3 = require('web3');

// @ts-ignore
// 创建web3实例
// 可以阅读获取更多信息https://docs.metamask.io/guide/provider-migration.html#replacing-window-web3
let web3 = new Web3(window.web3.currentProvider)

// 修改地址为部署的合约地址
const easyBetAddress = Addresses.EasyBet
const easyBetABI = EasyBet.abi
const myERC20Address = Addresses.MyERC20
const myERC20ABI = MyERC20.abi

// 获取合约实例
const lotteryContract = new web3.eth.Contract(easyBetABI, easyBetAddress);
const myERC20Contract = new web3.eth.Contract(myERC20ABI, myERC20Address);

// 导出web3实例和其它部署的合约
export {web3, lotteryContract, myERC20Contract}