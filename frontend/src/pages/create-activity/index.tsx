import React, { useState, useEffect } from 'react';
import { lotteryContract, web3 } from "../../utils/contracts";

const CreateActivityPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [newActivity, setNewActivity] = useState({
        choices: ['',''] as string[],
        prizeAmount: '' as string,
        deadline: null as any,
        description: '' as string
    });

    // 初始化钱包账户并监听 accountsChanged
    useEffect(() => {
        // @ts-ignore
        const { ethereum } = window;
        if (!ethereum) return;

        const init = async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length) setAccount(accounts[0]);
            } catch (e) {
                console.error('get eth_accounts failed', e);
            }
        }

        init();

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts && accounts.length) setAccount(accounts[0]);
            else setAccount('');
        }

        try {
            ethereum.on('accountsChanged', handleAccountsChanged);
        } catch (e) {
            // 某些 provider 不支持 on/removeListener
        }

        return () => {
            try { ethereum.removeListener('accountsChanged', handleAccountsChanged); } catch (e) {}
        }
    }, []);

    // 活动列表和管理员相关状态
    const [activities, setActivities] = useState<any[]>([]);
    const [contractOwner, setContractOwner] = useState<string>('');
    const [selectedChoices, setSelectedChoices] = useState<Record<number, number>>({});

    const loadActivities = async () => {
        if (!lotteryContract) return;
        try {
            const counter = await lotteryContract.methods.activityCounter().call();
            const n = Number(counter || 0);
            if (n === 0) { setActivities([]); return; }

            // 对每个活动获取详细信息并计算每个选项的总投注（与 buy-ticket 页面一致）
            const ids = Array.from({ length: n }, (_, i) => i + 1);
            const raws = await Promise.all(ids.map(id => lotteryContract.methods.getActivity(id).call().catch((e: any) => { console.warn('getActivity error', id, e); return null; })));

            const items = await Promise.all(
                raws.map(async (raw: any, idx: number) => {
                    if (!raw) return null;
                    const id = ids[idx];
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
                        totalPool: web3.utils.fromWei(raw.totalPool || '0', 'ether'),
                        isOpen: raw.isOpen,
                        cancelled: raw.cancelled,
                        winningChoice: raw.winningChoice
                    };
                })
            );

            setActivities(items.filter(Boolean) as any[]);

            try {
                const owner = await lotteryContract.methods.owner().call();
                setContractOwner(owner);
            } catch (e) {
                // ignore if not available
            }
        } catch (e) {
            console.error('加载活动失败', e);
        }
    };

    useEffect(() => {
        loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account]);

    // 处理选项变化
    const handleChoiceChange = (index: number, value: string) => {
        const newChoices = [...newActivity.choices];
        newChoices[index] = value;
        setNewActivity({
            ...newActivity,
            choices: newChoices
        });
    };

    // 添加选项
    const addChoice = () => {
        if (newActivity.choices.length >= 10) {
            alert('选项上限为10个');
            return;
        }

        setNewActivity({
            ...newActivity,
            choices: [...newActivity.choices, '']
        });
    };

    // 删除选项
    const removeChoice = (index: number) => {
        if (newActivity.choices.length <= 2) {
            alert('至少需要2个选项');
            return;
        }

        const newChoices = [...newActivity.choices];
        newChoices.splice(index, 1);
        setNewActivity({
            ...newActivity,
            choices: newChoices
        });
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewActivity({ ...newActivity, description: e.target.value });
    }

    // 处理奖金金额变化
    const handlePrizeAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewActivity({
            ...newActivity,
            prizeAmount: e.target.value
        });
    };

    // 处理截止时间变化
    const handleDeadlineChange = (dateString: string) => {
        if (!dateString) {
            setNewActivity({
                ...newActivity,
                deadline: null
            });
            return;
        }

        const date = new Date(dateString);
        const unixTimestamp = Math.floor(date.getTime() / 1000);

        setNewActivity({
            ...newActivity,
            deadline: unixTimestamp
        });
    };

    // 创建活动
    const onCreateActivity = async () => {
        if (account === '') {
            alert('请先连接钱包');
            return;
        }

        if (!lotteryContract) {
            alert('合约不存在');
            return;
        }

        // 验证输入
        if (!newActivity.description || newActivity.description.trim() === '') {
            alert('请输入活动描述');
            return;
        }

        if (newActivity.choices.length < 2) {
            alert('至少需要2个选项');
            return;
        }

        const validChoices = newActivity.choices.filter(choice => choice.trim() !== '');
        if (validChoices.length < 2) {
            alert('至少需要2个非空选项');
            return;
        }

        if (!newActivity.prizeAmount || parseFloat(newActivity.prizeAmount) <= 0) {
            alert('请输入有效的奖金金额');
            return;
        }

        if (!newActivity.deadline) {
            alert('请选择截止时间');
            return;
        }

        try {
                // 调用合约创建活动（将活动写入链上）
                const validChoices = newActivity.choices.filter(c => c.trim() !== '');
                const deadlineTimestamp = Number(newActivity.deadline);

                // prizeAmount 使用 ERC20（ZJU），前端以常见的 18 位小数为准，使用 toWei 转换
                const prizeWei = web3.utils.toWei(String(newActivity.prizeAmount), 'ether');

                console.log('调用合约 createActivity', { validChoices, description: newActivity.description, prizeWei, deadlineTimestamp });

                await lotteryContract.methods.createActivity(
                    validChoices,
                    newActivity.description,
                    prizeWei,
                    deadlineTimestamp
                ).send({ from: account });

                alert('活动创建成功');
                // 刷新活动列表
                await loadActivities();
        } catch (error: any) {
            console.error("创建活动失败:", error);
            alert(error?.message || '创建活动失败');
        }
    };

    // 管理员操作：开奖（结算）
    const handleSettle = async (activityId: number) => {
        if (!account) { alert('请先连接钱包'); return; }
        if (!lotteryContract) { alert('合约不存在'); return; }

        const selected = selectedChoices[activityId];
        if (selected === undefined || selected === null) {
            alert('请选择一个获胜选项索引');
            return;
        }

        try {
            await lotteryContract.methods.settleActivity(activityId, Number(selected)).send({ from: account });
            alert('已开奖');
            await loadActivities();
        } catch (e: any) {
            console.error('开奖失败', e);
            alert(e?.message || '开奖失败');
        }
    };

    // 管理员操作：退奖（取消活动）
    const handleCancel = async (activityId: number) => {
        if (!account) { alert('请先连接钱包'); return; }
        if (!lotteryContract) { alert('合约不存在'); return; }

        try {
            await lotteryContract.methods.cancelActivity(activityId).send({ from: account });
            alert('已取消活动（退奖）');
            await loadActivities();
        } catch (e: any) {
            console.error('退奖失败', e);
            alert(e?.message || '退奖失败');
        }
    };

    // 将活动分成当前活跃与已结束（已开奖/已取消）两部分，便于在渲染时分区显示
    const activeActivities = activities.filter(a => a.isOpen);
    const endedActivities = activities.filter(a => !a.isOpen);

    const formatTimestamp = (ts: string | number) => {
        if (!ts) return '-';
        const t = Number(ts) * 1000;
        const d = new Date(t);
        return d.toLocaleString();
    };

    return (
        <div className="page">
            <h1>创建竞彩项目</h1>
            <div className="account-info">
                <p>当前账户: {account}</p>
            </div>
            
            <div className="create-form">
                <h2>创建新的竞猜活动</h2>
                
                <div className="form-group">
                    <label>活动描述（必填）：</label>
                    <textarea value={newActivity.description} onChange={handleDescriptionChange} placeholder="请输入活动描述" style={{ width: '100%', minHeight: 80 }} />
                </div>

                <div className="form-group">
                    <label>选项（至少2，最多10）：</label>
                    {newActivity.choices.map((choice, index) => (
                        <div key={index} className="choice-input" style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ width: 28, fontWeight: 600, marginRight: 8 }}>{"ABCDEFGHIJ"[index] || index + 1}.</div>
                            <input
                                type="text"
                                value={choice}
                                onChange={(e) => handleChoiceChange(index, e.target.value)}
                                placeholder={`选项 ${index + 1}`}
                                style={{ flex: 1 }}
                            />
                            {newActivity.choices.length > 2 && (
                                <button type="button" onClick={() => removeChoice(index)} style={{ marginLeft: 8 }}>
                                    删除
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={addChoice}>添加选项</button>
                </div>
                
                <div className="form-group">
                    <label>奖金金额:</label>
                    <input
                        type="number"
                        value={newActivity.prizeAmount}
                        onChange={handlePrizeAmountChange}
                        placeholder="输入奖金金额"
                    />
                </div>
                
                <div className="form-group">
                    <label>截止时间:</label>
                    <input
                        type="datetime-local"
                        onChange={(e) => handleDeadlineChange(e.target.value)}
                    />
                </div>
                
                <button onClick={onCreateActivity}>创建活动</button>
            </div>
            
            <div className="activity-list" style={{ marginTop: 24 }}>
                <h2>当前活跃活动</h2>
                {activeActivities.length === 0 && <div>暂无活跃活动</div>}
                {activeActivities.map((act: any) => (
                    <div key={act.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700 }}>活动 #{act.id}（发布者: {act.owner}）</div>
                        {act.description && <div style={{ marginTop: 6 }}>{act.description}</div>}
                        <div style={{ marginTop: 6 }}>奖金上限: {act.prizeAmount} ZJU，剩余: {act.remainingAmount} ZJU，总奖池: {act.totalPool} ZJU</div>
                        <div>截止时间: {new Date(act.deadline * 1000).toLocaleString()}</div>
                        <div style={{ marginTop: 8 }}>
                            {act.choices.map((ch: string, idx: number) => (
                                <div key={idx}>{"ABCDEFGHIJ"[idx] || idx + 1}. {ch} — 已投注: {act.choiceTotals?.[idx] ?? '0'} ZJU</div>
                            ))}
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <label>选择开奖项: </label>
                            <select value={selectedChoices[act.id] ?? ''} onChange={(e) => setSelectedChoices({ ...selectedChoices, [act.id]: Number(e.target.value) })}>
                                <option value="">-- 选择 --</option>
                                {act.choices && act.choices.map((c: string, idx: number) => (
                                    <option key={idx} value={idx}>{"ABCDEFGHIJ"[idx] || idx + 1}. {c}</option>
                                ))}
                            </select>
                            {/* 仅当当前账号是合约 owner 或活动 owner 时可以操作，前端仅作提示，合约会再次校验 */}
                            <button style={{ marginLeft: 8 }} onClick={() => handleSettle(act.id)}>开奖</button>
                            <button style={{ marginLeft: 8 }} onClick={() => handleCancel(act.id)}>退奖</button>
                        </div>
                    </div>
                ))}

                <h2 style={{ marginTop: 16 }}>已结束活动</h2>
                {endedActivities.length === 0 && <div>暂无已结束活动</div>}
                {endedActivities.map((act: any) => (
                    <div key={act.id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 12, background: '#fafafa' }}>
                        <div style={{ fontWeight: 700 }}>活动 #{act.id}（发布者: {act.owner}）</div>
                        {act.description && <div style={{ marginTop: 6 }}>{act.description}</div>}
                        <div style={{ marginTop: 6 }}>奖金上限: {act.prizeAmount} ZJU，已分配/剩余: {act.remainingAmount} ZJU，总奖池: {act.totalPool} ZJU</div>
                        <div>截止时间: {new Date(act.deadline * 1000).toLocaleString()}</div>
                        <div style={{ marginTop: 8 }}>
                            {act.choices.map((ch: string, idx: number) => (
                                <div key={idx}>{"ABCDEFGHIJ"[idx] || idx + 1}. {ch} — 已投注: {act.choiceTotals?.[idx] ?? '0'} ZJU</div>
                            ))}
                        </div>
                        <div style={{ marginTop: 8, fontStyle: 'italic' }}>
                            {act.cancelled ? (
                                <span>状态: 已取消（已退奖）</span>
                            ) : (
                                <span>已开奖: { (act.winningChoice === undefined || act.winningChoice === null || act.winningChoice === '') ? '—' : ("ABCDEFGHIJ"[Number(act.winningChoice)] || Number(act.winningChoice) + 1) }</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CreateActivityPage;