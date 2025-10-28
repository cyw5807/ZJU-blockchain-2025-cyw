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
        uint256 activityId;     // 关联的活动ID
        uint256 choiceIndex;    // 选择的选项索引
        uint256 price;          // 购买价格
    }
    
    // 存储彩票信息
    mapping(uint256 => LotteryTicket) public lotteryTickets;
    
    // 记录每个活动的选项统计
    mapping(uint256 => mapping(uint256 => uint256)) public choiceCount;
    
    // 记录挂单信息
    mapping(uint256 => uint256) public ticketListedPrice;

    // 列表化已挂单的票，便于链上枚举（注意：大数组可能消耗 gas，适合中小规模）
    uint256[] public listedTokens;
    // tokenId -> index in listedTokens (1-based). 0 表示不在列表中
    mapping(uint256 => uint256) private listedTokenIndex;
    
    // 事件
    event TicketMinted(uint256 indexed tokenId, uint256 indexed activityId, uint256 choiceIndex, uint256 price);
    event TicketListed(uint256 indexed tokenId, uint256 price);
    event TicketDelisted(uint256 indexed tokenId);
    event TicketBought(uint256 indexed tokenId, address indexed buyer, uint256 price);
    
    constructor(address initialOwner) 
        ERC721("LotteryTicket", "LTT") 
        Ownable(initialOwner) 
    {}
    
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

    function setMinter(address account, bool allowed) external onlyOwner {
        minters[account] = allowed;
        emit MinterUpdated(account, allowed);
    }

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
     * @dev 购买挂单的彩票（使用 ETH）
     * @param tokenId 彩票ID
     */
    function buyListedTicket(uint256 tokenId) external payable {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(ticketListedPrice[tokenId] > 0, "Ticket is not listed");
        require(msg.value == ticketListedPrice[tokenId], "Incorrect payment amount");
        require(ownerOf(tokenId) != msg.sender, "You cannot buy your own ticket");
        
        address seller = ownerOf(tokenId);
        
        // 转移所有权
        _transfer(seller, msg.sender, tokenId);
        
        // 支付给卖家
        payable(seller).transfer(msg.value);
        
        // 从挂单列表中移除并取消挂单
        _removeListing(tokenId);
        delete ticketListedPrice[tokenId];
        
        emit TicketBought(tokenId, msg.sender, msg.value);
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
     * @dev 检查彩票是否存在
     * @param tokenId 彩票ID
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
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