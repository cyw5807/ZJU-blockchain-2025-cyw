import React, { useState, useEffect } from 'react';
import { lotteryNFTContract, myERC20Contract, web3 } from "../../utils/contracts";

const BuyListedTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [listedTickets, setListedTickets] = useState<any[]>([]);
    const [tokenId, setTokenId] = useState<string>('');
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
        };
        if (account) getBalance();
    }, [account]);

    // 获取挂单列表
    const fetchListedTickets = async () => {
        try {
            // 调用合约获取挂单列表
            console.log("获取挂单列表");
            if (!lotteryNFTContract) return;

            // getAllListedTickets 返回 uint256[]
            const ids: string[] = await lotteryNFTContract.methods.getAllListedTickets().call();
            const listed: any[] = [];
            for (const idStr of ids) {
                try {
                    const id = Number(idStr);
                    // 获取挂单价格（wei）
                    const priceWei = await lotteryNFTContract.methods.getTicketListedPrice(id).call();
                    const price = web3.utils.fromWei(String(priceWei), 'ether');
                    // 获取卖家地址
                    const seller = await lotteryNFTContract.methods.ownerOf(id).call();
                    listed.push({ id, price, seller });
                } catch (e) {
                    console.warn('读取挂单项失败', idStr, e);
                }
            }
            setListedTickets(listed);
        } catch (e) {
            console.error("获取挂单列表失败:", e);
        }
    };

    // 购买挂单的彩票
    const buyListedTicket = async () => {
        if (!account) {
            alert('请先连接钱包');
            return;
        }

        if (!tokenId) {
            alert('请输入彩票ID');
            return;
        }

        try {
            // 购买使用 ZJU 代币：首先找到选中的挂单信息（seller, price）
            const selected = listedTickets.find(t => String(t.id) === String(tokenId));
            if (!selected) {
                alert('未找到对应挂单，请刷新列表');
                return;
            }

            if (!selected.seller || !selected.price) {
                alert('挂单信息不完整，无法完成购买');
                return;
            }

            const priceWei = web3.utils.toWei(String(selected.price), 'ether');

            // 使用合约原子的 ERC20 购买流程：先 approve 本合约（lotteryNFTContract）花费 priceWei，然后调用 buyListedTicketWithERC20
            if (!myERC20Contract || !lotteryNFTContract) {
                alert('合约未加载');
                return;
            }

            const spender = lotteryNFTContract.options.address;
            try {
                // approve 本合约从买家转账给卖家
                await myERC20Contract.methods.approve(spender, priceWei).send({ from: account });
            } catch (e) {
                console.error('approve 失败', e);
                alert('代币授权失败');
                return;
            }

            try {
                await lotteryNFTContract.methods.buyListedTicketWithERC20(myERC20Contract.options.address, tokenId).send({ from: account });
                alert('购买成功，NFT 已转入您的账户（若链上交易成功）');
                // 刷新挂单列表
                await fetchListedTickets();
            } catch (e) {
                console.error('购买失败', e);
                // e 可能是任意类型，使用 any 以安全访问 message，或转为字符串
                alert('购买失败：' + (((e as any)?.message) || String(e)));
            }
        } catch (error) {
            console.error("购买失败:", error);
            alert('购买失败');
        }
    };

    return (
        <div className="page">
            <h1>购买挂单出售的彩票</h1>
                <div className="account-info">
                <p>当前账户: {account || '未连接'}</p>
                {account && <div>ZJU 余额: {accountBalance}</div>}
            </div>
            
            <div className="buy-listed-form">
                <h2>购买挂单中的彩票</h2>
                
                <button onClick={fetchListedTickets}>刷新挂单列表</button>
                
                <div className="listed-tickets">
                    <h3>当前挂单</h3>
                    {listedTickets.length > 0 ? (
                        <ul>
                            {listedTickets.map((ticket, index) => (
                                <li key={index}>
                                    <p>彩票ID: {ticket.id}</p>
                                    <p>价格: {ticket.price}</p>
                                    <button onClick={() => setTokenId(ticket.id)}>选择购买</button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>暂无挂单</p>
                    )}
                </div>
                
                <div className="form-group">
                    <label>彩票ID:</label>
                    <input
                        type="text"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value)}
                        placeholder="输入要购买的彩票ID"
                    />
                </div>
                
                <button onClick={buyListedTicket}>购买彩票</button>
            </div>
        </div>
    );
};

export default BuyListedTicketPage;