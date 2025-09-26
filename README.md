# Limit Order Protocol Extensions

Batch Token Swapping is a process that allows a user (the maker) to swap multiple different assets into a single destination asset (the taker) in a single transaction. Instead of making individual swaps for each token, batch swapping consolidates the process, reducing transaction costs and time.

### Example:
User Request:
The user wants to swap:

10 DAI

5 ETH

3 SHIB
Into USDC.

Batch Swap Execution:
The platform takes the following steps internally:

Swap 10 DAI for USDC at the current exchange rate.

Swap 5 ETH for USDC at the current exchange rate.

Swap 3 BAT for USDC at the current exchange rate.

This happens in a single transaction.

Result:
The user receives the equivalent value in USDC for all of the tokens they swapped.

### Benefits: 
- **Gas Savings**: Instead of paying for each transaction separately, the user only pays for one, saving on gas fees.

- **Time Efficiency**: Rather than waiting for multiple transactions to complete, the user only waits for one.

- **Convenience**: The user can easily swap different tokens for a single destination token in one step, making portfolio management simpler.
