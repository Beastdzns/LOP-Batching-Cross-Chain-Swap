// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IOrderMixin } from "../interfaces/IOrderMixin.sol";
import { TakerTraits } from "../libraries/TakerTraitsLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@1inch/solidity-utils/contracts/libraries/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";

contract BatchOrderFiller is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using AddressLib for Address;

    error EmptyBatch();
    error MsgValueNotZero();
    error UnsupportedTakerAsset();
    error InconsistentTakerAsset();

    IOrderMixin public immutable LIMIT_ORDER_PROTOCOL;

    struct OrderFillData {
        IOrderMixin.Order order;
        bytes32 r;
        bytes32 vs;
        uint256 amount;
        TakerTraits takerTraits;
        uint256 maxTakingAmount;
    }

    event OrderFilled(
        uint256 indexed index,
        bytes32 orderHash,
        uint256 makingAmount,
        uint256 takingAmount
    );

    event BatchFilled(
        address indexed taker,
        address indexed recipient,
        address indexed takerAsset,
        uint256 totalOrders,
        uint256 totalMakingAmount,
        uint256 totalTakingAmount,
        uint256 refund
    );

    constructor(IOrderMixin limitOrderProtocol) {
        LIMIT_ORDER_PROTOCOL = limitOrderProtocol;
    }

     function fillBatch(OrderFillData[] calldata orders, address recipient)
         external
         payable
         nonReentrant
         returns (uint256 totalMakingAmount, uint256 totalTakingAmount)
     {
        if (orders.length == 0) revert EmptyBatch();
        if (msg.value != 0) revert MsgValueNotZero();

        if (recipient == address(0)) {
            recipient = msg.sender;
        }

        address takerAsset = orders[0].order.takerAsset.get();
        if (takerAsset == address(0)) revert UnsupportedTakerAsset();

        uint256 totalMaxTaking;
         for (uint256 i = 0; i < orders.length; ++i) {
             if (orders[i].order.takerAsset.get() != takerAsset) revert InconsistentTakerAsset();
             totalMaxTaking += orders[i].maxTakingAmount;
         }
 
         IERC20 takerToken = IERC20(takerAsset);
         takerToken.safeTransferFrom(msg.sender, address(this), totalMaxTaking);
         takerToken.forceApprove(address(LIMIT_ORDER_PROTOCOL), totalMaxTaking);


        for (uint256 i = 0; i < orders.length; ++i) {
            OrderFillData calldata data = orders[i];
            (uint256 makingAmount, uint256 takingAmount, bytes32 orderHash) =
                LIMIT_ORDER_PROTOCOL.fillOrder(data.order, data.r, data.vs, data.amount, data.takerTraits);

            totalMakingAmount += makingAmount;
            totalTakingAmount += takingAmount;

            _transferMakerAsset(data.order, recipient, makingAmount);

            emit OrderFilled(i, orderHash, makingAmount, takingAmount);
        }

        takerToken.forceApprove(address(LIMIT_ORDER_PROTOCOL), 0);

        uint256 refund = totalMaxTaking - totalTakingAmount;
        if (refund > 0) {
            takerToken.safeTransfer(msg.sender, refund);
        }

        emit BatchFilled(msg.sender, recipient, takerAsset, orders.length, totalMakingAmount, totalTakingAmount, refund);
    }

    function _transferMakerAsset(
        IOrderMixin.Order calldata order,
        address recipient,
        uint256 amount
    ) private {
        address makerAsset = order.makerAsset.get();
        if (makerAsset == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "ETH_TRANSFER_FAILED");
        } else {
            IERC20(makerAsset).safeTransfer(recipient, amount);
        }
    }

    receive() external payable {}
}