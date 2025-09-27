# Limit Order Protocol Extensions

Batch Token Swapping is a process that allows a user (the maker) to swap multiple different assets into a single destination asset (the taker) in a single transaction. Instead of making individual swaps for each token, batch swapping consolidates the process, reducing transaction costs and time.

### Example:
User Request:
The user wants to swap:

- 100 Maker1 Token

- 50 Maker2 Token

- 75 Maker3 Token

Into Taker Token.

Batch Swap Execution:
The platform takes the following steps internally:

- Swap 100 Maker1 for Taker Token at the current exchange rate(1 Maker1 = 2 Taker).

- Swap 50 Maker2 for Taker Token at the current exchange rate(1 Maker2 = 0.5 Taker).

- Swap 75 Maker3 for Taker Token at the current exchange rate(1 Maker3 = 2 Taker).

This happens in a single transaction.

Result:
The user receives the equivalent value in USDC for all of the tokens they swapped.

### Benefits: 
- **Gas Savings**: Instead of paying for each transaction separately, the user only pays for one, saving on gas fees.

- **Time Efficiency**: Rather than waiting for multiple transactions to complete, the user only waits for one.

- **Convenience**: The user can easily swap different tokens for a single destination token in one step, making portfolio management simpler.
