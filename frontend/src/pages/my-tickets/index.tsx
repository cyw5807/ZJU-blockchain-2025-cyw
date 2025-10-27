import React, { useState, useEffect } from 'react';
import { lotteryContract, lotteryNFTContract, myERC20Contract, web3 } from "../../utils/contracts";

const MyTicketsPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [myTickets, setMyTickets] = useState<any[]>([]);
    const [accountBalance, setAccountBalance] = useState<string>('0');
    const [airdropClaimed, setAirdropClaimed] = useState<boolean>(false);

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
        const getAccountInfo = async () => {
            if (myERC20Contract && account) {
                try {
                    const ab = await myERC20Contract.methods.balanceOf(account).call();
                    setAccountBalance(web3.utils.fromWei(ab, 'ether'));
                    // 如果代币合约有记录空投领取状态，请替换方法名
                    try {
                        const claimed = await myERC20Contract.methods.claimedAirdropPlayerList(account).call();
                        setAirdropClaimed(claimed);
                    } catch (e) {
                        // 合约可能没有该映射，忽略
                    }
                } catch (e) {
                    console.error('Error getting account token info:', e);
                }
            }
        };

        if (account) {
            getAccountInfo();
        }
    }, [account]);

    const onClaimAirdrop = async () => {
        if (!account) {
            alert('请先连接钱包');
            return;
        }

        if (!myERC20Contract) {
            alert('代币合约不存在');
            return;
        }

        try {
            await myERC20Contract.methods.airdrop().send({ from: account });
            alert('成功领取空投代币!');
            const ab = await myERC20Contract.methods.balanceOf(account).call();
            setAccountBalance(web3.utils.fromWei(ab, 'ether'));
            setAirdropClaimed(true);
        } catch (error: any) {
            alert(error.message || '领取空投失败');
        }
    };

    useEffect(() => {
        const fetchMyTickets = async () => {
            if (lotteryNFTContract && account) {
                try {
                    // 这里需要根据实际合约方法获取用户持有的彩票
                    // 示例代码，需要根据实际合约接口进行调整
                    console.log("获取用户持有的彩票");
                } catch (e) {
                    console.error("获取彩票信息失败:", e);
                }
            }
        };

        fetchMyTickets();
    }, [account]);

    return (
        <div className="page">
            <h1>我的彩票</h1>
            <div className="account-info">
                <p>当前账户: {account || '未连接'}</p>
                {account && (
                    <div style={{ marginTop: 8 }}>
                        <div>ZJU 代币余额: {accountBalance}</div>
                        {!airdropClaimed ? (
                            <button
                                onClick={onClaimAirdrop}
                                style={{ marginTop: 8, padding: '6px 12px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: 4 }}
                            >
                                领取空投 (ZJU)
                            </button>
                        ) : (
                            <div style={{ color: 'green', marginTop: 8 }}>您已领取过空投</div>
                        )}
                    </div>
                )}
            </div>
            
            <div className="tickets-list">
                <h2>我持有的彩票</h2>
                {myTickets.length > 0 ? (
                    <ul>
                        {myTickets.map((ticket, index) => (
                            <li key={index}>
                                <p>彩票ID: {ticket.id}</p>
                                <p>活动ID: {ticket.activityId}</p>
                                <p>选择项: {ticket.choice}</p>
                                <p>价格: {ticket.price}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>暂无彩票</p>
                )}
            </div>
        </div>
    );
};

export default MyTicketsPage;
