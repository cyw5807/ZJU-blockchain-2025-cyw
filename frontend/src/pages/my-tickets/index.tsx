import React, { useState, useEffect } from 'react';
import { lotteryContract, lotteryNFTContract, web3 } from "../../utils/contracts";

const MyTicketsPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [myTickets, setMyTickets] = useState<any[]>([]);

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
                <p>当前账户: {account}</p>
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
