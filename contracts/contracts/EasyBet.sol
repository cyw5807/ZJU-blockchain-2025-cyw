// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment the line to use openzeppelin/ERC721,ERC20
// You can use this dependency directly because it has been installed by TA already
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// 使用 LotteryNFT 合约类型代替单独的接口声明
import "./LotteryNFT.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract EasyBet {
    // 定义角色：公证人
    address public owner;
    
    // 添加修饰符，仅允许公证人执行某些操作
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // 使用事件记录创建的竞猜项目
    event ActivityCreated(uint256 indexed activityId, string[] choices, uint256 prizeAmount, uint256 deadline);
    event BetPlaced(uint256 tokenId, uint256 price, address owner, uint256 activityId, uint256 choiceIndex);
    event ActivityClosed(uint256 indexed activityId, uint256 winningChoice);
    event PrizeClaimed(uint256 indexed activityId, uint256 tokenId, address winner, uint256 amount);

    // 竞猜项目结构体
    struct Activity {
        address owner;              // 项目创建者（公证人）
        uint256 listedTimestamp;    // 创建时间戳
        string[] choices;           // 可选项
        string description;         // 活动描述
        uint256 prizeAmount;        // 奖金总额（购买上限）
        uint256 deadline;           // 截止时间
        bool isOpen;                // 项目是否开放
        uint256 winningChoice;      // 获胜选项
        uint256 totalPool;          // 总奖池（实际购买金额总和）
        uint256 remainingAmount;    // 剩余可购买金额
    }

    // 活动映射
    mapping(uint256 => Activity) public activities; // 从项目ID到项目信息的映射
    uint256 public activityCounter; // 项目计数器
    
    // 彩票NFT合约地址（使用 LotteryNFT 合约类型）
    LotteryNFT public lotteryNFT;
    // ZJU ERC20 代币合约
    IERC20 public zjuToken;
    
    // 每个活动的获奖彩票列表
    mapping(uint256 => uint256[]) public winningTickets;
    
    // 记录奖金是否已被领取
    mapping(uint256 => mapping(uint256 => bool)) public prizeClaimed;
    
    // 记录每个选项的总投注金额
    mapping(uint256 => mapping(uint256 => uint256)) public choiceTotalBets;

    // 记录每张票的投注金额
    mapping(uint256 => uint256) public ticketBetAmount;

    // 记录每张票所属活动
    mapping(uint256 => uint256) public ticketActivity;

    // 活动 -> 选项 -> 票ID 列表（便于结算或统计）
    mapping(uint256 => mapping(uint256 => uint256[])) public activityChoiceTickets;

    constructor(address _lotteryNFTAddress, address _zjuTokenAddress) {
        owner = msg.sender; // 设置合约创建者为公证人
        activityCounter = 0;
        lotteryNFT = LotteryNFT(_lotteryNFTAddress);
        zjuToken = IERC20(_zjuTokenAddress);
    }

    /**
     * @dev 创建一个新的竞猜项目
     * @param choices 竞猜选项数组（至少2个选项）
     * @param prizeAmount 奖金总额（购买上限）
     * @param deadline 项目截止时间（时间戳）
     */
    function createActivity(
        string[] memory choices,
        string memory description,
        uint256 prizeAmount,
        uint256 deadline
    ) public onlyOwner returns (uint256) {
        // 验证输入参数
        require(choices.length >= 2, "At least 2 choices required");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(prizeAmount > 0, "Prize amount must be greater than 0");

        // 增加项目计数器
        uint256 newActivityId = ++activityCounter;

        // 创建新的竞猜项目
        Activity storage newActivity = activities[newActivityId];
        newActivity.owner = msg.sender;
        newActivity.listedTimestamp = block.timestamp;
        newActivity.choices = choices;
        newActivity.description = description;
        newActivity.prizeAmount = prizeAmount;
        newActivity.deadline = deadline;
        newActivity.isOpen = true;
        newActivity.winningChoice = 0; // 0表示尚未开奖
        newActivity.totalPool = 0;
        newActivity.remainingAmount = prizeAmount;

        // 触发事件
    emit ActivityCreated(newActivityId, choices, prizeAmount, deadline);
        
        return newActivityId;
    }
    
    /**
     * @dev 购买彩票
     * @param activityId 活动ID
     * @param choiceIndex 选择的选项索引
     * @param price 支付的价格
     */
    function buyTicket(
        uint256 activityId,
        uint256 choiceIndex,
        uint256 price
    ) external returns (uint256) {
        // 验证活动存在且开放
        Activity storage activity = activities[activityId];
        require(activity.isOpen, "Activity is not open");
        require(block.timestamp < activity.deadline, "Activity has ended");
        require(choiceIndex < activity.choices.length, "Invalid choice index");
        // 使用 ZJU ERC20 支付，调用方需先 approve 本合约转移相应金额
        require(price <= activity.remainingAmount, "Not enough remaining amount in the pool");
        // transferFrom caller -> this contract
        bool ok = zjuToken.transferFrom(msg.sender, address(this), price);
        require(ok, "ZJU transfer failed");
        
        // 更新活动状态
        activity.totalPool += price;
        activity.remainingAmount -= price;
        
        // 更新选项投注总额
        choiceTotalBets[activityId][choiceIndex] += price;
        
        // 调用NFT合约铸造彩票，授权的NFT合约会把票铸到购买者地址
        uint256 tokenId = lotteryNFT.mintTicketTo(msg.sender, activityId, choiceIndex, price);

        // 记录票相关信息，便于后续结算
        ticketBetAmount[tokenId] = price;
        ticketActivity[tokenId] = activityId;
        activityChoiceTickets[activityId][choiceIndex].push(tokenId);

        emit BetPlaced(tokenId, price, msg.sender, activityId, choiceIndex);

        return tokenId;
    }
    
    /**
     * @dev 关闭活动并设置获胜选项
     * @param activityId 活动ID
     * @param winningChoice 获胜选项索引
     */
    function closeActivity(uint256 activityId, uint256 winningChoice) external onlyOwner {
        Activity storage activity = activities[activityId];
        require(activity.isOpen, "Activity is not open");
        require(winningChoice < activity.choices.length, "Invalid winning choice");
        
        activity.isOpen = false;
        activity.winningChoice = winningChoice;
        
        emit ActivityClosed(activityId, winningChoice);
    }
    
    /**
     * @dev 领取奖金（通过彩票 tokenId）
     * @param tokenId 彩票ID
     */
    function claimPrize(uint256 tokenId) external {
        // 首先获取票信息并验证
    (uint256 activityIdFromNFT, uint256 choiceIndex, ) = lotteryNFT.getTicketInfo(tokenId);

        Activity storage activity = activities[activityIdFromNFT];
        require(!activity.isOpen, "Activity is still open");
        require(activity.winningChoice == choiceIndex, "This ticket did not win");
        require(!prizeClaimed[activityIdFromNFT][tokenId], "Prize already claimed");

        // 检查调用者是否是彩票的当前所有者
        require(lotteryNFT.ownerOf(tokenId) == msg.sender, "Not the owner of the ticket");

        // 获取投注金额（合约记录）
        uint256 betAmount = ticketBetAmount[tokenId];
        require(betAmount > 0, "Invalid bet amount");

        // 标记奖金已被领取
        prizeClaimed[activityIdFromNFT][tokenId] = true;

        // 计算奖金金额（按比例分配）
        uint256 totalWinningChoiceBets = choiceTotalBets[activityIdFromNFT][choiceIndex];
        require(totalWinningChoiceBets > 0, "No bets on winning choice");

        uint256 prizeAmount = (betAmount * activity.totalPool) / totalWinningChoiceBets;

        // 确保奖金不超过奖池总额
        if (prizeAmount > activity.totalPool) {
            prizeAmount = activity.totalPool;
        }

        // 转账 ZJU 代币奖金给调用者
        require(zjuToken.transfer(msg.sender, prizeAmount), "ZJU transfer failed");

        // 减少活动总奖池
        activity.totalPool -= prizeAmount;

        emit PrizeClaimed(activityIdFromNFT, tokenId, msg.sender, prizeAmount);
    }

    function helloworld() pure external returns(string memory) {
        return "hello world";
    }

    // TODO add any logic if you want
    
    /**
     * @dev 接收ETH资金
     */
    receive() external payable {}
    
    /**
     * @dev 获取活动信息
     * @param activityId 活动ID
     */
    function getActivity(uint256 activityId) external view returns (Activity memory) {
        return activities[activityId];
    }
    
    /**
     * @dev 获取选项总投注金额
     * @param activityId 活动ID
     * @param choiceIndex 选项索引
     */
    function getChoiceTotalBets(uint256 activityId, uint256 choiceIndex) external view returns (uint256) {
        return choiceTotalBets[activityId][choiceIndex];
    }
}