# Limit Order Protocol Extensions

Batch Token Swapping is a process that allows a user (the maker) to swap multiple different assets into a single destination asset (the taker) in a single transaction. Instead of making individual swaps for each token, batch swapping consolidates the process, reducing transaction costs and time.

**Presentation Link**: https://www.canva.com/design/DAG0PSR_SGA/dDmi0ALWyFmQSNFus80dEA/edit?utm_content=DAG0PSR_SGA&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton
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
The user receives the equivalent value in Taker for all of the tokens they swapped.
(Mock contracts are present in the mockTokens folder)

### Benefits: 
- **Gas Savings**: Instead of paying for each transaction separately, the user only pays for one, saving on gas fees.

- **Time Efficiency**: Rather than waiting for multiple transactions to complete, the user only waits for one.

- **Convenience**: The user can easily swap different tokens for a single destination token in one step, making portfolio management simpler.

### Deployed Contracts (Testnet)

Maker1Token: 0x9607c8045566eDa2ebCf2a044438bD65DB37386C
Maker2Token: 0x804883DbC16BCB93f63E3d7eB7C7a07Ca4dc1694
Maker3Token: 0xe60f11F556a6A5936Cd24dB9Dd61ecEfA8CC5b27
TakerToken: 0xaa3CD0A852651f00c1a79fCE161Ac120FDB83a62

Using LOP : 0xE53136D9De56672e8D2665C98653AC7b8A60Dc44
WETH MOCK: 0x885fd951fB363B6F7ECda513745Ce124E88D09aC

### Mainnet Deployment (Arbitrum One)
0x890661642512Afc01B71b7980e5258f25A093cCe

<img width="1405" height="861" alt="image" src="https://github.com/user-attachments/assets/12fffb6c-e0f0-4965-ba3b-b50a48048ccf" />

Usage Considerations
When choosing between the two implementations:

Use BatchOrderFiller.sol for:

- Simple batch swapping requirements
- When working with tokens that don't support ERC2612
- Scenarios where traditional approval patterns are acceptable


Use BatchOrderFillerWithPermit.sol for:

- Enhanced user experience with gasless approvals
- When working with ERC2612-compatible tokens
- Applications requiring more sophisticated permission management
- Better integration with modern DeFi protocols

![gif](https://github.com/user-attachments/assets/27ba6dcd-fecb-443b-a42b-a0e8c87982e7)
