// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IOrderMixin } from "../interfaces/IOrderMixin.sol";
import { TakerTraits } from "../libraries/TakerTraitsLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@1inch/solidity-utils/contracts/libraries/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";

/**
 * @title BatchOrderFillerWithPermit
 * @notice Enhanced BatchOrderFiller that supports EIP-2612 permit functionality
 * @dev This contract allows batch filling of limit orders with gasless token approvals using permits
 */
contract BatchOrderFillerWithPermit is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using AddressLib for Address;

    error EmptyBatch();
    error MsgValueNotZero();
    error UnsupportedTakerAsset();
    error InconsistentTakerAsset();
    error PermitExpired();
    error InvalidPermitSignature();

    IOrderMixin public immutable LIMIT_ORDER_PROTOCOL;

    struct OrderFillData {
        IOrderMixin.Order order;
        bytes32 r;
        bytes32 vs;
        uint256 amount;
        TakerTraits takerTraits;
        uint256 maxTakingAmount;
    }

    struct PermitData {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
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

    event PermitUsed(
        address indexed token,
        address indexed owner,
        address indexed spender,
        uint256 value,
        uint256 deadline
    );

    constructor(IOrderMixin limitOrderProtocol) {
        LIMIT_ORDER_PROTOCOL = limitOrderProtocol;
    }

    /**
     * @notice Fills a batch of orders using standard approvals
     * @param orders Array of order data to fill
     * @param recipient Address to receive the maker assets (use address(0) for msg.sender)
     * @return totalMakingAmount Total amount of maker assets received
     * @return totalTakingAmount Total amount of taker assets spent
     */
    function fillBatch(OrderFillData[] calldata orders, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 totalMakingAmount, uint256 totalTakingAmount)
    {
        return _fillBatchInternal(orders, recipient, false, PermitData(0, 0, 0, 0));
    }

    /**
     * @notice Fills a batch of orders using EIP-2612 permit for gasless approval
     * @param orders Array of order data to fill
     * @param recipient Address to receive the maker assets (use address(0) for msg.sender)
     * @param permitData The permit signature data for the taker asset
     * @return totalMakingAmount Total amount of maker assets received
     * @return totalTakingAmount Total amount of taker assets spent
     */
    function fillBatchWithPermit(
        OrderFillData[] calldata orders,
        address recipient,
        PermitData calldata permitData
    ) external payable nonReentrant returns (uint256 totalMakingAmount, uint256 totalTakingAmount) {
        if (permitData.deadline < block.timestamp) revert PermitExpired();
        return _fillBatchInternal(orders, recipient, true, permitData);
    }

    /**
     * @notice Internal function to handle batch filling logic
     * @param orders Array of order data to fill
     * @param recipient Address to receive maker assets
     * @param usePermit Whether to use permit for approval
     * @param permitData Permit signature data (ignored if usePermit is false)
     */
    function _fillBatchInternal(
        OrderFillData[] calldata orders,
        address recipient,
        bool usePermit,
        PermitData memory permitData
    ) internal returns (uint256 totalMakingAmount, uint256 totalTakingAmount) {
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

        // Handle permit if requested
        if (usePermit) {
            _executePermit(takerToken, totalMaxTaking, permitData);
        }

        // Transfer tokens from user to this contract
        takerToken.safeTransferFrom(msg.sender, address(this), totalMaxTaking);
        
        // Approve the limit order protocol to spend tokens
        takerToken.forceApprove(address(LIMIT_ORDER_PROTOCOL), totalMaxTaking);

        // Fill all orders
        for (uint256 i = 0; i < orders.length; ++i) {
            OrderFillData calldata data = orders[i];
            (uint256 makingAmount, uint256 takingAmount, bytes32 orderHash) =
                LIMIT_ORDER_PROTOCOL.fillOrder(data.order, data.r, data.vs, data.amount, data.takerTraits);

            totalMakingAmount += makingAmount;
            totalTakingAmount += takingAmount;

            _transferMakerAsset(data.order, recipient, makingAmount);

            emit OrderFilled(i, orderHash, makingAmount, takingAmount);
        }

        // Reset approval
        takerToken.forceApprove(address(LIMIT_ORDER_PROTOCOL), 0);

        // Refund excess tokens
        uint256 refund = totalMaxTaking - totalTakingAmount;
        if (refund > 0) {
            takerToken.safeTransfer(msg.sender, refund);
        }

        emit BatchFilled(msg.sender, recipient, takerAsset, orders.length, totalMakingAmount, totalTakingAmount, refund);
    }

    /**
     * @notice Executes EIP-2612 permit to approve tokens
     * @param token The ERC20 token to approve
     * @param value The amount to approve
     * @param permitData The permit signature data
     */
    function _executePermit(
        IERC20 token,
        uint256 value,
        PermitData memory permitData
    ) internal {
        try IERC20Permit(address(token)).permit(
            msg.sender,
            address(this),
            value,
            permitData.deadline,
            permitData.v,
            permitData.r,
            permitData.s
        ) {
            emit PermitUsed(address(token), msg.sender, address(this), value, permitData.deadline);
        } catch {
            // If permit fails, we assume the token doesn't support EIP-2612
            // or the signature is invalid. The subsequent transferFrom will
            // fail if there's no approval, providing better error context.
            revert InvalidPermitSignature();
        }
    }

    /**
     * @notice Transfers maker assets to the recipient
     * @param order The order being filled
     * @param recipient The recipient of maker assets
     * @param amount The amount to transfer
     */
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

    /**
     * @notice Checks if a token supports EIP-2612 permit
     * @param token The token address to check
     * @return true if the token supports permit, false otherwise
     */
    function supportsPermit(address token) external view returns (bool) {
        try IERC20Permit(token).DOMAIN_SEPARATOR() returns (bytes32) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @notice Gets the current nonce for a token permit
     * @param token The token address
     * @param owner The owner address
     * @return The current nonce
     */
    function getPermitNonce(address token, address owner) external view returns (uint256) {
        try IERC20Permit(token).nonces(owner) returns (uint256 nonce) {
            return nonce;
        } catch {
            return 0;
        }
    }

    receive() external payable {}
}