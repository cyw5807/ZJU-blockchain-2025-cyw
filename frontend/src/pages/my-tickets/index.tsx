import React, { useState, useEffect } from 'react';
import { lotteryContract, lotteryNFTContract, myERC20Contract, web3 } from "../../utils/contracts";

const MyTicketsPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [myTickets, setMyTickets] = useState<any[]>([]);
    const [accountBalance, setAccountBalance] = useState<string>('0');
    const [airdropClaimed, setAirdropClaimed] = useState<boolean>(false);

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
        const getAccountInfo = async () => {
            if (myERC20Contract && account) {
                try {
                    const ab = await myERC20Contract.methods.balanceOf(account).call();
                    setAccountBalance(web3.utils.fromWei(ab, 'ether'));
                    // 如果代币合约有记录空投领取状态，请替换方法名
                    try {
                        const claimed = await myERC20Contract.methods.claimedAirdropPlayerList(account).call();
                        setAirdropClaimed(claimed);
                    } catch (e) {
                        // 合约可能没有该映射，忽略
                    }
                } catch (e) {
                    console.error('Error getting account token info:', e);
                }
            }
        };

        if (account) {
            getAccountInfo();
        }
    }, [account]);

    const onClaimAirdrop = async () => {
        if (!account) {
            alert('请先连接钱包');
            return;
        }

        if (!myERC20Contract) {
            alert('代币合约不存在');
            return;
        }

        try {
            await myERC20Contract.methods.airdrop().send({ from: account });
            alert('成功领取空投代币!');
            const ab = await myERC20Contract.methods.balanceOf(account).call();
            setAccountBalance(web3.utils.fromWei(ab, 'ether'));
            setAirdropClaimed(true);
        } catch (error: any) {
            alert(error.message || '领取空投失败');
        }
    };

    useEffect(() => {
        const fetchMyTickets = async () => {
            if (lotteryNFTContract && account) {
                try {
                    console.log("获取用户持有的彩票");

                    const tickets: any[] = [];

                    // 首先尝试通过 Transfer 事件枚举（高效且常用）
                    let tokenIds: number[] = [];
                    try {
                        const events = await lotteryNFTContract.getPastEvents('Transfer', {
                            filter: { to: account },
                            fromBlock: 0,
                            toBlock: 'latest'
                        });
                        tokenIds = events.map((ev: any) => Number(ev.returnValues.tokenId));
                        tokenIds = Array.from(new Set(tokenIds));
                    } catch (e) {
                        console.warn('读取 Transfer 事件失败，后续将使用 exists() 扫描', e);
                        tokenIds = [];
                    }

                    // 如果没有从事件中找到票，则回退到逐个扫描 exists()
                    if (tokenIds.length === 0) {
                        const MAX_SCAN = 500; // 安全上限，避免无限循环
                        for (let id = 1; id <= MAX_SCAN; id++) {
                            try {
                                const exists = await lotteryNFTContract.methods.exists(id).call();
                                if (exists) tokenIds.push(id);
                            } catch (e) {
                                // 如果合约没有 exists 方法，直接跳出
                                console.warn('exists() 检查失败或不存在方法，停止扫描', e);
                                break;
                            }
                        }
                    }

                    // 通过 ownerOf 和 getTicketInfo 过滤出真正属于当前账户的票
                    for (const tid of tokenIds) {
                        try {
                            const owner = await lotteryNFTContract.methods.ownerOf(tid).call();
                            if (owner.toLowerCase() !== account.toLowerCase()) continue;

                            // getTicketInfo 返回 (activityId, choiceIndex, price)
                            const info = await lotteryNFTContract.methods.getTicketInfo(tid).call();
                            // info may be an array-like or object depending on ABI output
                            const activityId = Number(info[0] ?? info.activityId ?? 0);
                            const choiceIndex = Number(info[1] ?? info.choiceIndex ?? 0);
                            const priceRaw = info[2] ?? info.price ?? '0';
                            const price = web3.utils.fromWei(String(priceRaw), 'ether');

                            // 读取活动信息以显示描述与选项内容
                            let activityDescription = '';
                            let activityChoices: string[] = [];
                            try {
                                if (lotteryContract) {
                                    const rawAct = await lotteryContract.methods.getActivity(activityId).call();
                                    activityDescription = rawAct?.description || '';
                                    activityChoices = rawAct?.choices || [];
                                }
                            } catch (e) {
                                console.warn('读取活动信息失败', activityId, e);
                            }

                            const selectedOptionLabel = String.fromCharCode(65 + choiceIndex) || String(choiceIndex + 1);
                            const selectedOptionContent = activityChoices[choiceIndex] || '';

                            tickets.push({
                                id: tid,
                                price,
                                activityId,
                                activityDescription,
                                choiceIndex,
                                choiceLabel: selectedOptionLabel,
                                choiceContent: selectedOptionContent
                            });
                        } catch (e) {
                            console.warn('处理 tokenId 失败', tid, e);
                            continue;
                        }
                    }

                    setMyTickets(tickets);
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
                <p>当前账户: {account || '未连接'}</p>
                {account && (
                    <div style={{ marginTop: 8 }}>
                        <div>ZJU 代币余额: {accountBalance}</div>
                        {!airdropClaimed ? (
                            <button
                                onClick={onClaimAirdrop}
                                style={{ marginTop: 8, padding: '6px 12px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: 4 }}
                            >
                                领取空投 (ZJU)
                            </button>
                        ) : (
                            <div style={{ color: 'green', marginTop: 8 }}>您已领取过空投</div>
                        )}
                    </div>
                )}
            </div>
            
            <div className="tickets-list">
                <h2>我持有的彩票</h2>
                {myTickets.length > 0 ? (
                    <div>
                        {myTickets.map((ticket, index) => (
                            <div key={index} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
                                <div>
                                    <strong>彩票 #{ticket.id}</strong>
                                </div>
                                <div style={{ marginTop: 6 }}>
                                    <span style={{ color: 'green', fontWeight: 700 }}>{ticket.price} ZJU</span>
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
                    <p>暂无彩票</p>
                )}
            </div>
        </div>
    );
};

export default MyTicketsPage;
