import { useState, useEffect } from 'react';
import { lotteryContract, web3, myERC20Contract } from "../../utils/contracts";
import './index.css';

const LotteryPage = () => {

    const [account, setAccount] = useState('')
    const [accountBalance, setAccountBalance] = useState(0)
    const [activities, setActivities] = useState<any[]>([])
    const [airdropClaimed, setAirdropClaimed] = useState(false)
    
    // 创建活动的表单状态
    const [newActivity, setNewActivity] = useState({
        choices: ['',''] as string[],
        prizeAmount: '' as string,
        deadline: null as any,
        description: '' as string
    })

    useEffect(() => {
        // 初始化检查用户是否已经连接钱包
        // 查看window对象里是否存在ethereum（metamask安装后注入的）对象
        const initCheckAccounts = async () => {
            // @ts-ignore
            const {ethereum} = window;
            if (Boolean(ethereum && ethereum.isMetaMask)) {
                // 尝试获取连接的用户账户
                const accounts = await web3.eth.getAccounts()
                if(accounts && accounts.length) {
                    setAccount(accounts[0])
                }
            }
        }

        initCheckAccounts()
    }, [])

    useEffect(() => {
        const getAccountInfo = async () => {
            if (myERC20Contract && account) {
                try {
                    const ab = await myERC20Contract.methods.balanceOf(account).call()
                    // ZJU token assumed to have 18 decimals; format for display
                    setAccountBalance(web3.utils.fromWei(ab, 'ether'))
                    
                    // 检查用户是否已经领取过空投
                        const claimed = await myERC20Contract.methods.claimedAirdropPlayerList(account).call()
                        setAirdropClaimed(claimed)
                } catch (e) {
                    console.error("Error getting account info:", e)
                }
            }
        }

        if(account !== '') {
            getAccountInfo()
        }
    }, [account])

    // 处理创建活动表单的输入变化
    const handleChoiceChange = (index: number, value: string) => {
        const newChoices = [...newActivity.choices]
        newChoices[index] = value
        setNewActivity({
            ...newActivity,
            choices: newChoices
        })
    }

    // 添加新的选项输入框
    const addChoice = () => {
        if (newActivity.choices.length >= 10) {
            alert('选项上限为10个')
            return
        }

        setNewActivity({
            ...newActivity,
            choices: [...newActivity.choices, '']
        })
    }

    // 移除选项输入框
    const removeChoice = (index: number) => {
        if (newActivity.choices.length <= 2) {
            alert('至少需要2个选项')
            return
        }
        
        const newChoices = [...newActivity.choices]
        newChoices.splice(index, 1)
        setNewActivity({
            ...newActivity,
            choices: newChoices
        })
    }

    // 处理奖金金额输入变化
    const handlePrizeAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewActivity({
            ...newActivity,
            prizeAmount: e.target.value
        })
    }

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewActivity({
            ...newActivity,
            description: e.target.value
        })
    }

    // 处理截止时间选择变化
    const handleDeadlineChange = (dateString: string) => {
        if (!dateString) {
            setNewActivity({
                ...newActivity,
                deadline: null
            });
            return;
        }

        // 将 datetime-local 字符串转换为 Date 对象
        const date = new Date(dateString);
        // 获取 Unix 时间戳（毫秒）
        const unixTimestamp = Math.floor(date.getTime() / 1000); // 转换为秒级时间戳

        setNewActivity({
            ...newActivity,
            deadline: unixTimestamp
        });
    };

    // 创建新的竞猜活动
    const onCreateActivity = async () => {
        if(account === '') {
            alert('请先连接钱包')
            return
        }

        if (!lotteryContract) {
            alert('合约不存在')
            return
        }

        // 验证输入
        if (newActivity.choices.length < 2) {
            alert('至少需要2个选项')
            return
        }

        const validChoices = newActivity.choices.filter(choice => choice.trim() !== '')
        if (validChoices.length < 2) {
            alert('至少需要2个非空选项')
            return
        }

        if (!newActivity.prizeAmount || parseFloat(newActivity.prizeAmount) <= 0) {
            alert('请输入有效的奖金金额')
            return
        }

        if (!newActivity.deadline) {
            alert('请选择截止时间')
            return
        }

        // 确保 deadline 是数字类型
        const deadlineTimestamp = Number(newActivity.deadline);
        if (isNaN(deadlineTimestamp)) {
            alert('截止时间格式无效');
            return;
        }

        try {
            // 调用合约创建活动
            await lotteryContract.methods.createActivity(
                validChoices,
                newActivity.description,
                web3.utils.toWei(newActivity.prizeAmount, 'ether'),
                deadlineTimestamp // 使用显式转换后的数字
            ).send({
                from: account
            })

            alert('成功创建竞猜活动')
            
            // 重置表单
            setNewActivity({
                choices: ['',''],
                prizeAmount: '',
                deadline: null,
                description: ''
            })
        } catch (error: any) {
            alert(error.message)
        }
    }

    // 领取空投
    const onClaimAirdrop = async () => {
        if(account === '') {
            alert('请先连接钱包')
            return
        }

        if (!myERC20Contract) {
            alert('代币合约不存在')
            return
        }

        try {
            await myERC20Contract.methods.airdrop().send({
                from: account
            })
            
            alert('成功领取空投代币!')
            
            // 更新账户余额和空投状态
            const ab = await myERC20Contract.methods.balanceOf(account).call()
            setAccountBalance(ab)
            setAirdropClaimed(true)
        } catch (error: any) {
            alert(error.message)
        }
    }

    const onClickConnectWallet = async () => {
        // 查看window对象里是否存在ethereum（metamask安装后注入的）对象
        // @ts-ignore
        const {ethereum} = window;
        if (!Boolean(ethereum && ethereum.isMetaMask)) {
            alert('MetaMask is not installed!');
            return
        }

        try {
            // 小狐狸成功切换网络了，接下来让小狐狸请求用户的授权
            await ethereum.request({method: 'eth_requestAccounts'});
            // 获取小狐狸拿到的授权用户列表
            const accounts = await ethereum.request({method: 'eth_accounts'});
            // 如果用户存在，展示其account，否则显示错误信息
            setAccount(accounts[0] || 'Not able to get accounts');
        } catch (error: any) {
            alert(error.message)
        }
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>竞猜项目创建测试</h1>
            <div style={{ marginBottom: '16px' }}>
                {account === '' && 
                    <button 
                        onClick={onClickConnectWallet}
                        style={{ 
                            padding: '8px 16px', 
                            backgroundColor: '#4CAF50', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer' 
                        }}
                    >
                        连接钱包
                    </button>
                }
                <div>当前用户地址：{account === '' ? '无用户连接' : account}</div>
                {account && (
                    <div>
                        <div>ZJU代币余额: {accountBalance}</div>
                        {!airdropClaimed ? (
                            <button 
                                onClick={onClaimAirdrop}
                                style={{ 
                                    padding: '8px 16px', 
                                    backgroundColor: '#FF9800', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer',
                                    marginTop: '8px'
                                }}
                            >
                                领取空投代币
                            </button>
                        ) : (
                            <div style={{ color: 'green', marginTop: '8px' }}>您已领取过空投</div>
                        )}
                    </div>
                )}
            </div>
            
            {/* 创建竞猜活动表单 */}
            <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '4px', marginTop: '16px' }}>
                <h2>创建新的竞猜活动</h2>
                <div style={{ marginBottom: '16px' }}>
                    <div>竞猜选项（至少2个，最多10个）：</div>
                    {newActivity.choices.map((choice, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ width: '28px', marginRight: '8px', fontWeight: 600 }}>
                                {"ABCDEFGHIJ"[index] || index + 1}.
                            </div>
                            <input
                                placeholder={`选项 ${index + 1}`}
                                value={choice}
                                onChange={(e) => handleChoiceChange(index, e.target.value)}
                                style={{ flex: 1, padding: '8px' }}
                            />
                            {newActivity.choices.length > 2 && (
                                <button 
                                    onClick={() => removeChoice(index)}
                                    style={{ 
                                        marginLeft: '8px', 
                                        padding: '8px 16px', 
                                        backgroundColor: '#f44336', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        cursor: 'pointer' 
                                    }}
                                >
                                    删除
                                </button>
                            )}
                        </div>
                    ))}
                    <button 
                        onClick={addChoice}
                        style={{ 
                            width: '100%', 
                            padding: '8px', 
                            backgroundColor: '#ccc', 
                            color: 'black', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer' 
                        }}
                    >
                        添加选项
                    </button>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                    <div>奖金金额（ZJU）：</div>
                    <input
                        placeholder="输入奖金金额"
                        value={newActivity.prizeAmount}
                        onChange={handlePrizeAmountChange}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <div>活动描述：</div>
                    <textarea
                        placeholder="输入活动描述（可选）"
                        value={newActivity.description}
                        onChange={handleDescriptionChange}
                        style={{ width: '100%', padding: '8px', minHeight: '80px' }}
                    />
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                    <div>截止时间：</div>
                    <input
                        type="datetime-local"
                        onChange={(e) => handleDeadlineChange(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                
                <button 
                    onClick={onCreateActivity}
                    style={{ 
                        width: '100%', 
                        padding: '12px', 
                        backgroundColor: '#2196F3', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer' 
                    }}
                >
                    创建竞猜活动
                </button>
            </div>
        </div>
    )
}

export default LotteryPage