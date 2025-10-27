import React, { useState, useEffect } from 'react';
import { lotteryContract, web3, myERC20Contract } from "../../utils/contracts";

const BuyTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [activities, setActivities] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
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
                try {
                    ethereum.on('accountsChanged', (accounts: string[]) => {
                        if (accounts && accounts.length) setAccount(accounts[0]); else setAccount('');
                    });
                } catch (e) {}
            }
        };

        initCheckAccounts();
    }, []);

    useEffect(() => {
        // 初始加载活动
        fetchActivities();
    }, []);

    // 获取所有活动
    const fetchActivities = async () => {
        if (!lotteryContract) return;
        setIsLoading(true);
        try {
            const countStr = await lotteryContract.methods.activityCounter().call();
            const count = Number(countStr || 0);
            if (count <= 0) {
                setActivities([]);
                setIsLoading(false);
                return;
            }

            const ids = Array.from({ length: count }, (_, i) => i + 1);

            // 并行获取每个活动的 raw data
            const raws = await Promise.all(
                ids.map(id => lotteryContract.methods.getActivity(id).call().catch((e: any) => { console.warn('getActivity error', id, e); return null; }))
            );

            // 过滤有效且开放的活动
            const openList = raws.map((raw: any, idx: number) => ({ raw, id: ids[idx] })).filter(x => x.raw && (x.raw.isOpen === true || x.raw.isOpen === 'true' || x.raw.isOpen === 1 || x.raw.isOpen === '1'));

            // 并行为每个活动获取每个选项的投注总额
            const items = await Promise.all(openList.map(async ({ raw, id }) => {
                const choices: string[] = raw.choices || [];
                const choiceTotals = await Promise.all(choices.map((_: any, ci: number) =>
                    lotteryContract.methods.getChoiceTotalBets(id, ci).call().then((t: any) => web3.utils.fromWei(t, 'ether')).catch((e: any) => { console.warn('getChoiceTotalBets failed', id, ci, e); return '0'; })
                ));

                return {
                    id,
                    owner: raw.owner,
                    listedTimestamp: Number(raw.listedTimestamp),
                    description: raw.description || '',
                    choices,
                    choiceTotals,
                    prizeAmount: web3.utils.fromWei(raw.prizeAmount || '0', 'ether'),
                    deadline: Number(raw.deadline),
                    remainingAmount: web3.utils.fromWei(raw.remainingAmount || '0', 'ether'),
                    totalPool: web3.utils.fromWei(raw.totalPool || '0', 'ether')
                };
            }));

            setActivities(items);
        } catch (e) {
            console.error('获取活动列表失败:', e);
        } finally {
            setIsLoading(false);
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
            const activityId = Number(selectedActivity);
            const choiceIndex = Number(selectedChoice);
            const priceWei = web3.utils.toWei(String(price), 'ether');

            // 检查并执行 ERC20 授权（approve）
            const marketplace = lotteryContract?.options?.address;
            if (!marketplace) {
                alert('市场合约地址不可用');
                return;
            }

            try {
                const allowance = await myERC20Contract.methods.allowance(account, marketplace).call();
                if (BigInt(allowance) < BigInt(priceWei)) {
                    // 需要先授权
                    await myERC20Contract.methods.approve(marketplace, priceWei).send({ from: account });
                }
            } catch (e) {
                console.error('检查/授权 ZJU 失败', e);
                alert('授权 ZJU 失败');
                return;
            }

            // 调用合约购买彩票（合约会从用户账户 transferFrom 到合约）
            await lotteryContract.methods.buyTicket(activityId, choiceIndex, priceWei).send({ from: account });
            alert('购买成功');
            // 刷新活动数据
            fetchActivities();
        } catch (error) {
            console.error("购买失败:", error);
            // 尝试解析 RPC 返回的详细错误信息
            // 有时 error 对象里包含 data 或 message 字段
            const detail = (error as any)?.data?.message || (error as any)?.message || JSON.stringify(error);
            alert('购买失败: ' + detail);
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
                            <option key={activity.id} value={String(activity.id)}>
                                活动 #{activity.id} - 奖金: {activity.prizeAmount} ZJU - 剩余: {activity.remainingAmount} ZJU
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
                            {(() => {
                                const act = activities.find(a => String(a.id) === String(selectedActivity));
                                if (!act) return null;
                                return act.choices.map((c: string, idx: number) => (
                                    <option key={idx} value={String(idx)}>{"ABCDEFGHIJ"[idx] || idx + 1}. {c} (已投注: {act.choiceTotals[idx]} ZJU)</option>
                                ));
                            })()}
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
                
                {/* 将购买彩票按钮置于活动列表之前，便于快速下单 */}
                <div style={{ marginTop: 24, marginBottom: 12 }}>
                    <button onClick={buyTicket} style={{ padding: '10px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>购买彩票</button>
                </div>

                <div style={{ marginTop: 8 }}>
                    <h2>当前活跃活动</h2>
                    <button onClick={fetchActivities} style={{ marginBottom: 12 }} disabled={isLoading}>{isLoading ? '加载中...' : '刷新活动'}</button>
                    {isLoading ? (
                        <p>正在加载活动，请稍候…</p>
                    ) : activities.length === 0 ? (
                        <p>当前没有活跃活动</p>
                    ) : (
                        <ul>
                            {activities.map(act => (
                                <li key={act.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 8 }}>
                                    <div><strong>活动 #{act.id}</strong>（发布者: {act.owner}）</div>
                                    {act.description && <div style={{ marginTop: 6 }}>{act.description}</div>}
                                    <div style={{ marginTop: 6 }}>奖金上限: {act.prizeAmount} ZJU，剩余: {act.remainingAmount} ZJU，总奖池: {act.totalPool} ZJU</div>
                                    <div>截止时间: {new Date(act.deadline * 1000).toLocaleString()}</div>
                                    <div style={{ marginTop: 8 }}>
                                        {act.choices.map((ch: string, idx: number) => (
                                            <div key={idx}>{"ABCDEFGHIJ"[idx] || idx + 1}. {ch} — 已投注: {act.choiceTotals[idx]} ZJU</div>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BuyTicketPage;