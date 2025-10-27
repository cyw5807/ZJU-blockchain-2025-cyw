import React, { useState } from 'react';
import { lotteryNFTContract, web3 } from "../../utils/contracts";

const SellTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [tokenId, setTokenId] = useState<string>('');
    const [price, setPrice] = useState<string>('');

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
            // 调用合约挂单方法
            console.log("挂单出售彩票:", { tokenId, price });
            alert('挂单成功');
        } catch (error) {
            console.error("挂单失败:", error);
            alert('挂单失败');
        }
    };

    return (
        <div className="page">
            <h1>挂单出售彩票</h1>
            <div className="account-info">
                <p>当前账户: {account}</p>
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