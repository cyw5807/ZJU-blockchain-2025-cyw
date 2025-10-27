import React, { useState, useEffect } from 'react';
import { lotteryNFTContract, lotteryContract, myERC20Contract, web3 } from "../../utils/contracts";

const SellTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [tokenId, setTokenId] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [accountBalance, setAccountBalance] = useState<string>('0');

    useEffect(() => {
        const initCheckAccounts = async () => {
            // @ts-ignore
            const { ethereum } = window;
            if (Boolean(ethereum && ethereum.isMetaMask)) {
                const accounts = await web3.eth.getAccounts();
                if (accounts && accounts.length) {
                    setAccount(accounts[0]);
                }
            }
        };

        initCheckAccounts();
    }, []);

    useEffect(() => {
        const getBalance = async () => {
            if (myERC20Contract && account) {
                try {
                    const ab = await myERC20Contract.methods.balanceOf(account).call();
                    setAccountBalance(web3.utils.fromWei(ab, 'ether'));
                } catch (e) {
                    console.error('获取余额失败', e);
                }
            }
        }
        if (account) getBalance();
    }, [account]);

    // 挂单出售彩票
    const listTicket = async () => {
        if (!account) {
            alert('请先连接钱包');
            return;
        }

        if (!tokenId) {
            alert('请输入彩票ID');
            return;
        }

        if (!price || parseFloat(price) <= 0) {
            alert('请输入有效价格');
            return;
        }

        try {
            // 将价格视为 ZJU 代币数量（小数部分按代币18位精度处理）
            const priceWei = web3.utils.toWei(String(price), 'ether');

            // 授权市场/合约可以管理该 NFT（将NFT授权给 lotteryContract 合约地址）
            if (lotteryNFTContract && lotteryContract) {
                const marketplace = lotteryContract.options.address;
                await lotteryNFTContract.methods.approve(marketplace, tokenId).send({ from: account });
                // 如果后端/合约实现了挂单方法，可以在此调用，例如 lotteryContract.methods.listTicketForSale(tokenId, priceWei).send({ from: account })
            }

            alert('已授权 NFT 给市场合约，请在后端/合约中完成挂单流程（价格以 ZJU 计价）');
        } catch (error) {
            console.error("挂单失败:", error);
            alert('挂单失败');
        }
    };

    return (
        <div className="page">
            <h1>挂单出售彩票</h1>
            <div className="account-info">
                <p>当前账户: {account || '未连接'}</p>
                {account && <div>ZJU 余额: {accountBalance}</div>}
            </div>
            
            <div className="sell-ticket-form">
                <h2>挂单出售持有的彩票</h2>
                
                <div className="form-group">
                    <label>彩票ID:</label>
                    <input
                        type="text"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value)}
                        placeholder="输入彩票ID"
                    />
                </div>
                
                <div className="form-group">
                    <label>出售价格:</label>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="输入出售价格"
                    />
                </div>
                
                <button onClick={listTicket}>挂单出售</button>
            </div>
        </div>
    );
};

export default SellTicketPage;