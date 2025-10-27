// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
        
        delete ticketListedPrice[tokenId];
        
        emit TicketDelisted(tokenId);
    }
    
    /**
     * @dev 购买挂单的彩票
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
        
        // 取消挂单
        delete ticketListedPrice[tokenId];
        
        emit TicketBought(tokenId, msg.sender, msg.value);
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
}