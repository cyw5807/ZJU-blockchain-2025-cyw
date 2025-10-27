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
        } catch (error: any) {
            console.error("创建活动失败:", error);
            alert(error?.message || '创建活动失败');
        }
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
        </div>
    );
};

export default CreateActivityPage;