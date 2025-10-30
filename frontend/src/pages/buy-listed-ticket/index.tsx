import React, { useState, useEffect } from 'react';
import { lotteryContract, lotteryNFTContract, myERC20Contract, web3 } from "../../utils/contracts";

const BuyListedTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [listedTickets, setListedTickets] = useState<any[]>([]);
    const [tokenId, setTokenId] = useState<string>('');
    const [accountBalance, setAccountBalance] = useState<string>('0');
    
    const [allActivities, setAllActivities] = useState<any[]>([]);
    const [sortOption, setSortOption] = useState<string>('0');
    const [filterActivityId, setFilterActivityId] = useState<string>('0');
    const [filterChoiceIndex, setFilterChoiceIndex] = useState<string>('all');

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
    
    useEffect(() => {
        const fetchAllActivities = async () => {
            if (!lotteryContract) return;
            try {
                const counter = await lotteryContract.methods.activityCounter().call();
                const n = Number(counter || 0);
                const activities = [];
                if (n > 0) {
                    const ids = Array.from({ length: n }, (_, i) => i + 1);
                    const raws = await Promise.all(ids.map(id => lotteryContract.methods.getActivity(id).call()));
                    for (let i = 0; i < raws.length; i++) {
                        if (raws[i] && raws[i].isOpen) {
                            activities.push({ id: ids[i], ...raws[i] });
                        }
                    }
                }
                setAllActivities(activities);
            } catch (e) {
                console.error("获取活动列表失败:", e);
            }
        };
        fetchAllActivities();
    }, []);

    const fetchListedTickets = async () => {
        try {
            console.log("获取挂单列表");
            if (!lotteryNFTContract || !lotteryContract) return;
            
            const activityIdParam = filterActivityId;
            const choiceIndexParam = filterChoiceIndex === 'all' ? 11 : filterChoiceIndex;
            const sortByParam = sortOption;

            const ids: string[] = await lotteryNFTContract.methods.getSortedAndFilteredTickets(activityIdParam, choiceIndexParam, sortByParam).call();
            
            const ticketDetailsPromises = ids.map(async (idStr) => {
                try {
                    const id = Number(idStr);
                    const listedPriceWei = await lotteryNFTContract.methods.ticketListedPrice(id).call();
                    const listedPrice = web3.utils.fromWei(String(listedPriceWei), 'ether');

                    const ticketInfo = await lotteryNFTContract.methods.getTicketInfo(id).call();
                    const activityId = Number(ticketInfo.activityId);
                    const choiceIndex = Number(ticketInfo.choiceIndex);
                    const faceValue = web3.utils.fromWei(String(ticketInfo.price), 'ether');

                    const activityInfo = await lotteryContract.methods.getActivity(activityId).call();
                    const activityDescription = activityInfo.description;
                    const choiceContent = activityInfo.choices[choiceIndex] || '';
                    const choiceLabel = String.fromCharCode(65 + choiceIndex);

                    return { 
                        id, 
                        listedPrice, 
                        faceValue,
                        activityId,
                        activityDescription,
                        choiceIndex,
                        choiceLabel,
                        choiceContent
                    };
                } catch (e) {
                    console.warn('读取挂单项详情失败', idStr, e);
                    return null;
                }
            });

            const detailedTickets = (await Promise.all(ticketDetailsPromises)).filter(t => t !== null);
            setListedTickets(detailedTickets);
        } catch (e) {
            console.error("获取挂单列表失败:", e);
            setListedTickets([]);
        }
    };
    
    useEffect(() => {
        fetchListedTickets();
    }, [sortOption, filterActivityId, filterChoiceIndex]);


    const buyListedTicket = async () => {
        if (!account) {
            alert('请先连接钱包');
            return;
        }

        if (!tokenId) {
            alert('请输入或选择一个彩票ID');
            return;
        }

        try {
            const selected = listedTickets.find(t => String(t.id) === String(tokenId));
            if (!selected) {
                alert('未在当前列表中找到对应挂单，请刷新列表');
                return;
            }
            
            if (!selected.listedPrice) {
                alert('挂单信息不完整，无法完成购买');
                return;
            }

            if (selected.listedPrice > parseFloat(accountBalance)) {
                alert('ZJU代币余额不足，无法购买');
                return;
            }

            const priceWei = web3.utils.toWei(String(selected.listedPrice), 'ether');

            if (!myERC20Contract || !lotteryNFTContract) {
                alert('合约未加载');
                return;
            }

            const spender = lotteryNFTContract.options.address;
            try {
                await myERC20Contract.methods.approve(spender, priceWei).send({ from: account });
            } catch (e) {
                console.error('approve 失败', e);
                alert('代币授权失败');
                return;
            }

            try {
                await lotteryNFTContract.methods.buyListedTicketWithERC20(myERC20Contract.options.address, tokenId).send({ from: account });
                alert('购买成功，彩票已转入您的账户');
                await fetchListedTickets();
            } catch (e) {
                console.error('购买失败', e);
                alert('购买失败：' + (((e as any)?.message) || String(e)));
            }
        } catch (error) {
            console.error("购买失败:", error);
            alert('购买失败');
        }
    };
    
    const handleActivityFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilterActivityId(e.target.value);
        setFilterChoiceIndex('all');
    };

    const selectedActivityChoices = filterActivityId !== '0' 
        ? allActivities.find(act => String(act.id) === filterActivityId)?.choices || [] 
        : [];

    return (
        <div className="page">
            <h1>购买挂单出售的彩票</h1>
            <div className="account-info">
                <p>当前账户: {account || '未连接'}</p>
                {account && <div>ZJU 余额: {accountBalance}</div>}
            </div>
            
            <div className="form-group">
                <h3>想要购买的彩票ID:</h3>
                <input
                    type="text"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="输入或从下方列表选择彩票ID"
                />
            </div>
            
            <button onClick={buyListedTicket}>购买彩票</button>
            
            <div className="buy-listed-form">
                <h2>购买挂单中的彩票</h2>
                
                <div style={{ display: 'flex', gap: '20px', margin: '20px 0', alignItems: 'center' }}>
                    <div>
                        <label>排序方式: </label>
                        <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                            <option value="0">性价比 (高到低)</option>
                            <option value="1">价格 (低到高)</option>
                        </select>
                    </div>
                    <div>
                        <label>筛选活动: </label>
                        <select value={filterActivityId} onChange={handleActivityFilterChange}>
                            <option value="0">所有活动</option>
                            {allActivities.map(act => (
                                <option key={act.id} value={act.id}>
                                    #{act.id}: {act.description}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>筛选选项: </label>
                        <select 
                            value={filterChoiceIndex} 
                            onChange={(e) => setFilterChoiceIndex(e.target.value)}
                            disabled={filterActivityId === '0'}
                        >
                            <option value="all">所有选项</option>
                            {selectedActivityChoices.map((choice: string, index: number) => (
                                <option key={index} value={index}>
                                    {String.fromCharCode(65 + index)}. {choice}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button onClick={fetchListedTickets}>刷新挂单列表</button>
                </div>
                
                <div className="listed-tickets">
                    <h3>当前挂单</h3>
                    {listedTickets.length > 0 ? (
                        <div>
                            {listedTickets.map((ticket, index) => (
                                <div key={index} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong>彩票 #{ticket.id}</strong>
                                            <span style={{
                                                marginLeft: 12,
                                                color: '#007BFF',
                                                fontWeight: 'bold',
                                                backgroundColor: '#e7f3ff',
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                fontSize: '0.9em'
                                            }}>
                                                挂单出售中: {ticket.listedPrice} ZJU
                                            </span>
                                        </div>
                                        <button onClick={() => setTokenId(String(ticket.id))}>选择购买</button>
                                    </div>
                                    <div style={{ marginTop: 6 }}>
                                        <span style={{ color: 'green', fontWeight: 700 }}>{ticket.faceValue} ZJU</span>
                                    </div>
                                    <div style={{ marginTop: 8 }}><strong>活动 #{ticket.activityId}</strong></div>
                                    {ticket.activityDescription && <div style={{ marginTop: 6 }}>{ticket.activityDescription}</div>}
                                    <div style={{ marginTop: 8 }}>
                                        <strong>已选:</strong> {ticket.choiceLabel}. {ticket.choiceContent}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>暂无符合条件的挂单</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BuyListedTicketPage;