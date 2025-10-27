import React, { useState, useEffect } from 'react';
import { lotteryContract, web3, myERC20Contract } from "../../utils/contracts";

const BuyTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [activities, setActivities] = useState<any[]>([]);
    const [selectedActivity, setSelectedActivity] = useState<string>('');
    const [selectedChoice, setSelectedChoice] = useState<string>('');
    const [price, setPrice] = useState<string>('');

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

    // 获取所有活动
    const fetchActivities = async () => {
        if (lotteryContract) {
            try {
                // 根据实际合约接口获取活动列表
                console.log("获取活动列表");
            } catch (e) {
                console.error("获取活动列表失败:", e);
            }
        }
    };

    // 购买彩票
    const buyTicket = async () => {
        if (!account) {
            alert('请先连接钱包');
            return;
        }

        if (!selectedActivity || !selectedChoice) {
            alert('请选择活动和选项');
            return;
        }

        if (!price || parseFloat(price) <= 0) {
            alert('请输入有效价格');
            return;
        }

        try {
            // 调用合约购买彩票
            console.log("购买彩票:", { selectedActivity, selectedChoice, price });
            alert('购买成功');
        } catch (error) {
            console.error("购买失败:", error);
            alert('购买失败');
        }
    };

    return (
        <div className="page">
            <h1>购买彩票</h1>
            <div className="account-info">
                <p>当前账户: {account}</p>
            </div>
            
            <div className="buy-ticket-form">
                <h2>选择活动并购买彩票</h2>
                
                <div className="form-group">
                    <label>选择活动:</label>
                    <select 
                        value={selectedActivity} 
                        onChange={(e) => setSelectedActivity(e.target.value)}
                    >
                        <option value="">请选择活动</option>
                        {activities.map(activity => (
                            <option key={activity.id} value={activity.id}>
                                {activity.name}
                            </option>
                        ))}
                    </select>
                </div>
                
                {selectedActivity && (
                    <div className="form-group">
                        <label>选择选项:</label>
                        <select 
                            value={selectedChoice} 
                            onChange={(e) => setSelectedChoice(e.target.value)}
                        >
                            <option value="">请选择选项</option>
                            {/* 根据选中的活动动态生成选项 */}
                            <option value="1">选项 1</option>
                            <option value="2">选项 2</option>
                        </select>
                    </div>
                )}
                
                <div className="form-group">
                    <label>价格:</label>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="输入价格"
                    />
                </div>
                
                <button onClick={buyTicket}>购买彩票</button>
            </div>
        </div>
    );
};

export default BuyTicketPage;