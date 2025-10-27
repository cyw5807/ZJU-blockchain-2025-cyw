import React, { useState } from 'react';
import { lotteryNFTContract, web3 } from "../../utils/contracts";

const BuyListedTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [listedTickets, setListedTickets] = useState<any[]>([]);
    const [tokenId, setTokenId] = useState<string>('');

    // 获取挂单列表
    const fetchListedTickets = async () => {
        try {
            // 调用合约获取挂单列表
            console.log("获取挂单列表");
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
            // 调用合约购买挂单彩票方法
            console.log("购买挂单彩票:", tokenId);
            alert('购买成功');
        } catch (error) {
            console.error("购买失败:", error);
            alert('购买失败');
        }
    };

    return (
        <div className="page">
            <h1>购买挂单出售的彩票</h1>
            <div className="account-info">
                <p>当前账户: {account}</p>
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