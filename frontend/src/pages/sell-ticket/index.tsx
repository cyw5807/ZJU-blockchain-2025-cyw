import React, { useState, useEffect } from 'react';
import { lotteryNFTContract, lotteryContract, myERC20Contract, web3 } from "../../utils/contracts";

const SellTicketPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [tokenId, setTokenId] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [accountBalance, setAccountBalance] = useState<string>('0');
    const [availableTickets, setAvailableTickets] = useState<any[]>([]);

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
        }
        if (account) getBalance();
    }, [account]);

    // 加载当前账户可售的（未开奖）彩票列表，来源与 my-tickets 页面一致
    useEffect(() => {
        const loadAvailableTickets = async () => {
            if (!lotteryNFTContract || !lotteryContract || !account) return;
            try {
                const tickets: any[] = [];

                // 先缓存活动数据（和 my-tickets / create-activity 保持一致）
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
                            const choiceTotalsRaw = await Promise.all(choices.map((_: any, ci: number) =>
                                lotteryContract.methods.getChoiceTotalBets(id, ci).call().catch((e: any) => { console.warn('getChoiceTotalBets failed', id, ci, e); return '0'; })
                            ));
                            activityMap[id] = { rawAct: raw, choiceTotalsRaw };
                        }));
                    }
                } catch (e) {
                    console.warn('加载活动缓存失败', e);
                }

                // 列出 tokenIds（尽量从 Transfer 事件获取）
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

                if (tokenIds.length === 0) {
                    const MAX_SCAN = 500;
                    for (let id = 1; id <= MAX_SCAN; id++) {
                        try {
                            const exists = await lotteryNFTContract.methods.exists(id).call();
                            if (exists) tokenIds.push(id);
                        } catch (e) {
                            console.warn('exists() 检查失败或不存在方法，停止扫描', e);
                            break;
                        }
                    }
                }

                for (const tid of tokenIds) {
                    try {
                        const owner = await lotteryNFTContract.methods.ownerOf(tid).call();
                        if (owner.toLowerCase() !== account.toLowerCase()) continue;

                        const info = await lotteryNFTContract.methods.getTicketInfo(tid).call();
                        const activityId = Number(info[0] ?? info.activityId ?? 0);
                        const choiceIndex = Number(info[1] ?? info.choiceIndex ?? 0);
                        const priceRaw = String(info[2] ?? info.price ?? '0');
                        const priceStr = web3.utils.fromWei(priceRaw, 'ether');

                        // 使用缓存的活动信息判断是否 isOpen
                        const cached = activityMap[activityId];
                        let isOpen = true;
                        let activityDescription = '';
                        let activityChoices: string[] = [];
                        if (cached && cached.rawAct) {
                            isOpen = cached.rawAct?.isOpen ?? true;
                            activityDescription = cached.rawAct?.description || '';
                            activityChoices = cached.rawAct?.choices || [];
                        } else {
                            try {
                                const raw = await lotteryContract.methods.getActivity(activityId).call();
                                isOpen = raw?.isOpen ?? true;
                                activityDescription = raw?.description || '';
                                activityChoices = raw?.choices || [];
                            } catch (e) {
                                console.warn('回退读取活动失败', activityId, e);
                            }
                        }

                        if (isOpen) {
                            tickets.push({
                                id: tid,
                                activityId,
                                choiceIndex,
                                price: priceStr,
                                activityDescription,
                                choiceLabel: String.fromCharCode(65 + choiceIndex),
                                choiceContent: activityChoices[choiceIndex] || ''
                            });
                        }
                    } catch (e) {
                        console.warn('处理 tokenId 失败', tid, e);
                        continue;
                    }
                }

                setAvailableTickets(tickets);
            } catch (e) {
                console.error('加载可售票失败', e);
            }
        };

        loadAvailableTickets();
    }, [account]);

    // 挂单出售彩票
    const listTicket = async () => {
        if (!account) {
            alert('请先连接钱包');
            return;
        }

        if (!tokenId) {
            alert('请先选择一个彩票');
            return;
        }

        if (!price || parseFloat(price) <= 0) {
            alert('请输入有效价格');
            return;
        }

        try {
            // 将价格视为 ZJU 代币数量（小数部分按代币18位精度处理）
            const priceWei = web3.utils.toWei(String(price), 'ether');

            // 授权市场/合约可以管理该 NFT（将NFT授权给 lotteryContract 合约地址）并提示用户下一步
            if (lotteryNFTContract && lotteryContract) {
                const marketplace = lotteryContract.options.address;
                await lotteryNFTContract.methods.approve(marketplace, tokenId).send({ from: account });
                // 调用 NFT 合约上的 listTicket(tokenId, priceWei) 上链挂单（以 ZJU 计价）
                try {
                    await lotteryNFTContract.methods.listTicket(tokenId, priceWei).send({ from: account });
                    alert('已在链上创建挂单（listTicket）');
                } catch (e) {
                    console.warn('调用 listTicket 失败，可能合约不实现此方法或参数不对', e);
                    // 若失败，仍提示用户已授权 NFT 给市场合约，需要后续处理
                }
            }

            alert('已授权 NFT 给市场合约，请在后端/合约中完成挂单流程（价格以 ZJU 计价）');
        } catch (error) {
            console.error("挂单失败:", error);
            alert('挂单失败');
        }
    };

    return (
        <div className="page">
            <h1>挂单出售彩票</h1>
            <div className="account-info">
                <p>当前账户: {account || '未连接'}</p>
                {account && <div>ZJU 余额: {accountBalance}</div>}
            </div>
            
            <div className="sell-ticket-form">
                <h2>挂单出售持有的彩票</h2>
                
                <div className="form-group">
                    <label>选择要出售的彩票（仅显示未开奖的彩票）：</label>
                    <select value={tokenId} onChange={(e) => setTokenId(e.target.value)}>
                        <option value="">-- 请选择 --</option>
                        {availableTickets.map(t => (
                            <option key={t.id} value={String(t.id)}>
                                {`#${t.id} — 活动#${t.activityId} — ${t.choiceLabel}. ${t.choiceContent} — ${t.price} ZJU`}
                            </option>
                        ))}
                    </select>
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