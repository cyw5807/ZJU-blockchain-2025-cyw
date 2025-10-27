import React, { useState } from 'react';
import { lotteryContract, web3 } from "../../utils/contracts";

const CreateActivityPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [newActivity, setNewActivity] = useState({
        choices: [''] as string[],
        prizeAmount: '' as string,
        deadline: null as any
    });

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
            // 调用合约创建活动
            // 注意：这需要根据实际合约接口进行调整
            console.log("创建活动:", newActivity);
            alert('活动创建成功');
        } catch (error) {
            console.error("创建活动失败:", error);
            alert('创建活动失败');
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
                    <label>选项:</label>
                    {newActivity.choices.map((choice, index) => (
                        <div key={index} className="choice-input">
                            <input
                                type="text"
                                value={choice}
                                onChange={(e) => handleChoiceChange(index, e.target.value)}
                                placeholder={`选项 ${index + 1}`}
                            />
                            {newActivity.choices.length > 2 && (
                                <button type="button" onClick={() => removeChoice(index)}>
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