// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LotteryNFT is ERC721, Ownable {
    
    // 添加_tokenIds计数器
    uint256 private _tokenIds;
    
    // 彩票信息结构
    struct LotteryTicket {
        uint256 activityId;    // 关联的活动ID
        uint256 choiceIndex;   // 选择的选项索引
        uint256 price;         // 购买价格
    }

    // 排序方式的枚举
    enum SortBy {
        CostEffectiveness, // 0: 性价比 (高到低)
        PriceAsc           // 1: 价格 (低到高)
    }
    
    // 存储彩票信息
    mapping(uint256 => LotteryTicket) public lotteryTickets;
    
    // 记录每个活动的选项统计
    mapping(uint256 => mapping(uint256 => uint256)) public choiceCount;
    
    // 记录挂单信息
    mapping(uint256 => uint256) public ticketListedPrice;

    // 列表化已挂单的票，便于链上枚举
    uint256[] public listedTokens;
    // tokenId -> index in listedTokens (1-based). 0 表示不在列表中
    mapping(uint256 => uint256) private listedTokenIndex;
    
    address public easyBetContractAddress;

    // 事件
    event TicketMinted(uint256 indexed tokenId, uint256 indexed activityId, uint256 choiceIndex, uint256 price);
    event TicketListed(uint256 indexed tokenId, uint256 price);
    event TicketDelisted(uint256 indexed tokenId);
    event TicketBought(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event EasyBetContractUpdated(address indexed newAddress);
    
    constructor(address initialOwner) 
        ERC721("LotteryTicket", "LTT") 
        Ownable(initialOwner) 
    {}

    modifier onlyEasyBetContract() {
        require(msg.sender == easyBetContractAddress, "Caller is not the EasyBet contract");
        _;
    }

    function authorizeEasyBet(address _easyBetAddress) external onlyOwner {
        easyBetContractAddress = _easyBetAddress;
        minters[_easyBetAddress] = true;
        emit EasyBetContractUpdated(_easyBetAddress);
        emit MinterUpdated(_easyBetAddress, true);
    }
    
    /**
     * @dev 购买彩票并铸造NFT
     * @param activityId 活动ID
     * @param choiceIndex 选择的选项索引
     * @param price 购买价格
     */
    function mintTicket(uint256 activityId, uint256 choiceIndex, uint256 price) external returns (uint256) {
        _tokenIds++;
        uint256 newTokenId = _tokenIds;

        _mint(msg.sender, newTokenId);

        // 存储彩票信息
        lotteryTickets[newTokenId] = LotteryTicket({
            activityId: activityId,
            choiceIndex: choiceIndex,
            price: price
        });

        // 更新选项统计
        choiceCount[activityId][choiceIndex]++;

        emit TicketMinted(newTokenId, activityId, choiceIndex, price);

        return newTokenId;
    }

    // 允许合约所有者授权某些合约/地址为铸造者
    mapping(address => bool) public minters;

    event MinterUpdated(address indexed account, bool allowed);

    /**
     * @dev 铸造彩票并指定接收者（仅授权的 minter 可调用）
     */
    function mintTicketTo(address to, uint256 activityId, uint256 choiceIndex, uint256 price) external returns (uint256) {
        require(minters[msg.sender] || owner() == msg.sender, "Not authorized to mint");

        _tokenIds++;
        uint256 newTokenId = _tokenIds;

        _mint(to, newTokenId);

        // 存储彩票信息
        lotteryTickets[newTokenId] = LotteryTicket({
            activityId: activityId,
            choiceIndex: choiceIndex,
            price: price
        });

        // 更新选项统计
        choiceCount[activityId][choiceIndex]++;

        emit TicketMinted(newTokenId, activityId, choiceIndex, price);

        return newTokenId;
    }
    
    /**
     * @dev 挂单出售彩票
     * @param tokenId 彩票ID
     * @param price 出售价格
     */
    function listTicket(uint256 tokenId, uint256 price) external {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this ticket");
        require(price > 0, "Price must be greater than 0");
        require(ticketListedPrice[tokenId] == 0, "Ticket is already listed");
        
        // 如果尚未在列表中，则加入
        if (listedTokenIndex[tokenId] == 0) {
            listedTokens.push(tokenId);
            listedTokenIndex[tokenId] = listedTokens.length; // 1-based
        }

        ticketListedPrice[tokenId] = price;

        emit TicketListed(tokenId, price);
    }
    
    /**
     * @dev 取消挂单
     * @param tokenId 彩票ID
     */
    function delistTicket(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this ticket");
        require(ticketListedPrice[tokenId] > 0, "Ticket is not listed");
        
        // 从列表中移除（如果在列表中）
        _removeListing(tokenId);

        delete ticketListedPrice[tokenId];

        emit TicketDelisted(tokenId);
    }

    /**
     * @dev 获取经过筛选和排序的挂单彩票列表
     * @param _activityId 要筛选的活动ID (传 0 表示不过滤)
     * @param _choiceIndex 要筛选的选项索引 (由于最多 10 个选项, 传 11 表示不过滤, 仅当_activityId不为0时有效)
     * @param _sortBy 排序方式 (0: 性价比高到低, 1: 价格低到高)
     * @return memory 一个包含符合条件的tokenId的已排序数组
     */
    function getSortedAndFilteredTickets(
        uint256 _activityId,
        uint256 _choiceIndex,
        SortBy _sortBy
    ) external view returns (uint256[] memory) {
        // 验证输入：当指定选项索引时，必须也指定活动ID
        require(_activityId != 0 || _choiceIndex == 11, "Cannot filter by choice without an activity");

        uint256[] memory allListed = listedTokens;
        uint256 listedCount = allListed.length;

        // 筛选过程
        uint256 filteredCount = 0;
        for (uint i = 0; i < listedCount; i++) {
            uint256 tokenId = allListed[i];
            LotteryTicket memory ticket = lotteryTickets[tokenId];
            
            bool activityMatch = (_activityId == 0) || (ticket.activityId == _activityId);
            bool choiceMatch = (_activityId == 0) || (_choiceIndex == 11) || (ticket.choiceIndex == _choiceIndex);

            if (activityMatch && choiceMatch) {
                filteredCount++;
            }
        }

        if (filteredCount == 0) {
            return new uint256[](0);
        }

        // 填充结果数组
        uint256[] memory filteredTokens = new uint256[](filteredCount);
        uint256 currentIndex = 0;
        for (uint i = 0; i < listedCount; i++) {
            uint256 tokenId = allListed[i];
            LotteryTicket memory ticket = lotteryTickets[tokenId];

            bool activityMatch = (_activityId == 0) || (ticket.activityId == _activityId);
            bool choiceMatch = (_activityId == 0) || (_choiceIndex == 11) || (ticket.choiceIndex == _choiceIndex);

            if (activityMatch && choiceMatch) {
                filteredTokens[currentIndex] = tokenId;
                currentIndex++;
            }
        }

        // 排序过程
        for (uint i = 0; i < filteredCount; i++) {
            for (uint j = 0; j < filteredCount - i - 1; j++) {
                uint256 tokenA = filteredTokens[j];
                uint256 tokenB = filteredTokens[j+1];
                bool shouldSwap = false;

                if (_sortBy == SortBy.PriceAsc) {
                    // 按价格从低到高排序
                    if (ticketListedPrice[tokenA] > ticketListedPrice[tokenB]) {
                        shouldSwap = true;
                    }
                } else if (_sortBy == SortBy.CostEffectiveness) {
                    // 按性价比从高到低排序
                    // 性价比 = ticket.price / listed.price
                    // 比较 A/B > C/D  =>  A*D > C*B
                    LotteryTicket memory ticketA = lotteryTickets[tokenA];
                    LotteryTicket memory ticketB = lotteryTickets[tokenB];
                    // 为了从高到低排序，如果 A 的性价比 < B 的性价比，则交换
                    if (ticketA.price * ticketListedPrice[tokenB] < ticketB.price * ticketListedPrice[tokenA]) {
                        shouldSwap = true;
                    }
                }

                if (shouldSwap) {
                    filteredTokens[j] = tokenB;
                    filteredTokens[j+1] = tokenA;
                }
            }
        }

        return filteredTokens;
    }

    /**
     * @dev 使用 ERC20 代币（例如 ZJU）购买挂单彩票
     * 买家需先对本合约 approve 足够的代币金额。
     */
    function buyListedTicketWithERC20(address erc20Address, uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        uint256 price = ticketListedPrice[tokenId];
        require(price > 0, "Ticket is not listed");
        require(ownerOf(tokenId) != msg.sender, "You cannot buy your own ticket");

        address seller = ownerOf(tokenId);

        IERC20 token = IERC20(erc20Address);
        // 买家将代币从自己转给卖家，买家需先 approve 本合约
        bool ok = token.transferFrom(msg.sender, seller, price);
        require(ok, "ERC20 transfer failed");

        // 转移所有权
        _transfer(seller, msg.sender, tokenId);

        // 从挂单列表中移除并取消挂单
        _removeListing(tokenId);
        delete ticketListedPrice[tokenId];

        emit TicketBought(tokenId, msg.sender, price);
    }
    
    function forceDelistTicket(uint256 tokenId) external onlyEasyBetContract {
        if (ticketListedPrice[tokenId] > 0) {
            _removeListing(tokenId);
            delete ticketListedPrice[tokenId];
            emit TicketDelisted(tokenId);
        }
    }

    /**
     * @dev 获取彩票信息
     * @param tokenId 彩票ID
     */
    function getTicketInfo(uint256 tokenId) external view returns (uint256 activityId, uint256 choiceIndex, uint256 price) {
        LotteryTicket memory t = lotteryTickets[tokenId];
        return (t.activityId, t.choiceIndex, t.price);
    }
    
    /**
     * @dev 获取彩票挂单价格
     * @param tokenId 彩票ID
     */
    function getTicketListedPrice(uint256 tokenId) external view returns (uint256) {
        return ticketListedPrice[tokenId];
    }

    /**
     * @dev 返回当前合约中所有正在挂单的 tokenId 列表（链上枚举）
     */
    function getAllListedTickets() external view returns (uint256[] memory) {
        return listedTokens;
    }

    /**
     * @dev 内部：移除挂单并维护 listedTokens 数组与索引
     */
    function _removeListing(uint256 tokenId) internal {
        uint256 idx = listedTokenIndex[tokenId];
        if (idx == 0) {
            return; // not in list
        }

        // 将最后一个元素移到被删除位置，然后 pop
        uint256 lastIndex = listedTokens.length;
        uint256 lastTokenId = listedTokens[lastIndex - 1];

        if (tokenId != lastTokenId) {
            // 替换
            listedTokens[idx - 1] = lastTokenId;
            listedTokenIndex[lastTokenId] = idx;
        }

        // 删除最后一项
        listedTokens.pop();
        listedTokenIndex[tokenId] = 0;
    }
}