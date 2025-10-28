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

                    // 先按 create-activity 的逻辑加载并缓存所有活动信息，以避免对同一活动重复 RPC 调用
                    const activityMap: Record<number, any> = {};
                    try {
                        const counter = await lotteryContract.methods.activityCounter().call();
                        const n = Number(counter || 0);
                        if (n > 0) {
                            const ids = Array.from({ length: n }, (_, i) => i + 1);
                            const raws = await Promise.all(ids.map(id => lotteryContract.methods.getActivity(id).call().catch((e: any) => { console.warn('getActivity error', id, e); return null; })));
                            await Promise.all(raws.map(async (raw: any, idx: number) => {
                                const id = ids[idx];
                                if (!raw) return;
                                const choices: string[] = raw.choices || [];
                                // 获取每个选项的总投注（wei）
                                const choiceTotalsRaw = await Promise.all(choices.map((_: any, ci: number) =>
                                    lotteryContract.methods.getChoiceTotalBets(id, ci).call().catch((e: any) => { console.warn('getChoiceTotalBets failed', id, ci, e); return '0'; })
                                ));
                                activityMap[id] = { rawAct: raw, choiceTotalsRaw };
                            }));
                        }
                    } catch (e) {
                        console.warn('加载活动缓存失败', e);
                    }

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
                            const priceRaw = String(info[2] ?? info.price ?? '0'); // wei string
                            const price = web3.utils.fromWei(String(priceRaw), 'ether');

                            // 读取已缓存的活动信息以显示描述与选项内容，并获取活动状态（是否已开奖/取消）
                            let activityDescription = '';
                            let activityChoices: string[] = [];
                            let activityIsOpen = true;
                            let activityCancelled = false;
                            let activityWinningChoice: any = null;
                            let precomputedPrize = null; // in ether string if computed
                            try {
                                const cached = activityMap[activityId];
                                const rawAct = cached?.rawAct ?? null;
                                const choiceTotalsRaw = cached?.choiceTotalsRaw ?? null;
                                if (rawAct) {
                                    activityDescription = rawAct?.description || '';
                                    activityChoices = rawAct?.choices || [];
                                    activityIsOpen = rawAct?.isOpen ?? true;
                                    activityCancelled = rawAct?.cancelled ?? false;
                                    activityWinningChoice = rawAct?.winningChoice;

                                    // 如果活动已结束且有 winningChoice（可能为 0），且当前票的选项等于中奖选项，尝试计算该票的中奖金额
                                    if (!activityIsOpen && activityWinningChoice !== undefined && activityWinningChoice !== null && activityWinningChoice !== '') {
                                        try {
                                            // 只为属于中奖选项的票计算金额
                                            if (Number(activityWinningChoice) === choiceIndex) {
                                                const totalWinning = (choiceTotalsRaw && choiceTotalsRaw[Number(activityWinningChoice)]) || '0';
                                                const totalWinningBN = web3.utils.toBN(totalWinning || '0');
                                                // 使用活动的总额度(prizeAmount)减去剩余额度(remainingAmount)作为总奖池（已售出额度）
                                                const prizeAmountBN = web3.utils.toBN(rawAct?.prizeAmount || rawAct?.totalPool || '0');
                                                const remainingBN = web3.utils.toBN(rawAct?.remainingAmount || '0');
                                                let totalPoolBN = prizeAmountBN.sub(remainingBN);
                                                if (totalPoolBN.isNeg && totalPoolBN.lt(web3.utils.toBN('0'))) totalPoolBN = web3.utils.toBN('0');
                                                const priceBN = web3.utils.toBN(priceRaw || '0');
                                                let prizeBN = web3.utils.toBN('0');
                                                if (!totalWinningBN.isZero()) {
                                                    // 中奖金额 = 本彩票投注额 / 正确选项投注额 * 总奖池（已售出额度）
                                                    prizeBN = priceBN.mul(totalPoolBN).div(totalWinningBN);
                                                }
                                                precomputedPrize = web3.utils.fromWei(prizeBN, 'ether');
                                            }
                                        } catch (e) {
                                            console.warn('计算中奖金额失败', activityId, e);
                                        }
                                    }
                                } else {
                                    // 如果没有缓存的活动，回退到较慢的 RPC 获取（保持兼容）
                                    const raw = await lotteryContract.methods.getActivity(activityId).call();
                                    activityDescription = raw?.description || '';
                                    activityChoices = raw?.choices || [];
                                    activityIsOpen = raw?.isOpen ?? true;
                                    activityCancelled = raw?.cancelled ?? false;
                                    activityWinningChoice = raw?.winningChoice;
                                }
                            } catch (e) {
                                console.warn('读取活动信息失败', activityId, e);
                            }

                            const selectedOptionLabel = String.fromCharCode(65 + choiceIndex) || String(choiceIndex + 1);
                            const selectedOptionContent = activityChoices[choiceIndex] || '';

                            tickets.push({
                                id: tid,
                                price,
                                priceRaw,
                                activityId,
                                activityDescription,
                                choiceIndex,
                                choiceLabel: selectedOptionLabel,
                                choiceContent: selectedOptionContent,
                                isOpen: activityIsOpen,
                                cancelled: activityCancelled,
                                winningChoice: activityWinningChoice,
                                prize: precomputedPrize
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
                <h2>未开奖的彩票</h2>
                {myTickets.filter(t => t.isOpen).length === 0 && <div>暂无未开奖的彩票</div>}
                {myTickets.filter(t => t.isOpen).map((ticket, index) => (
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

                <h2 style={{ marginTop: 16 }}>已开奖或已退奖的彩票</h2>
                {myTickets.filter(t => !t.isOpen).length === 0 && <div>暂无已开奖或已退奖的彩票</div>}
                {myTickets.filter(t => !t.isOpen).map((ticket, index) => {
                    const winnerSet = ticket.winningChoice !== undefined && ticket.winningChoice !== null && ticket.winningChoice !== '';
                    const isWinner = !ticket.cancelled && winnerSet && Number(ticket.winningChoice) === Number(ticket.choiceIndex);
                    const isLoser = !ticket.cancelled && winnerSet && Number(ticket.winningChoice) !== Number(ticket.choiceIndex);
                    return (
                    <div key={index} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12, background: '#fafafa' }}>
                        <div>
                            <strong>彩票 #{ticket.id}</strong>
                        </div>
                        <div style={{ marginTop: 6 }}>
                            <span style={{ color: 'green', fontWeight: 700 }}>{ticket.price} ZJU</span>
                            {/* inline: 已退奖 / 未中奖 / 中奖金额 */}
                            {ticket.cancelled ? (
                                <span style={{ color: '#999', marginLeft: 8 }}>已退奖</span>
                            ) : isWinner ? (
                                <span style={{ color: 'red', fontWeight: 700, marginLeft: 8 }}>中奖：{ticket.prize ?? '0'} ZJU</span>
                            ) : isLoser ? (
                                <span style={{ color: 'red', marginLeft: 8 }}>未中奖</span>
                            ) : null}
                        </div>
                        <div style={{ marginTop: 8 }}><strong>活动 #{ticket.activityId}</strong></div>
                        {ticket.activityDescription && <div style={{ marginTop: 6 }}>{ticket.activityDescription}</div>}
                        <div style={{ marginTop: 8 }}>
                            <strong>已选:</strong> {ticket.choiceLabel}. {ticket.choiceContent}
                        </div>
                    </div>
                    )
                })}
            </div>
        </div>
    );
};

export default MyTicketsPage;
