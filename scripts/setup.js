const { ethers } = require("hardhat");
const { buildOrder, signOrder, buildTakerTraits, buildMakerTraits } = require("../test/helpers/orderUtils");

async function main() {
    console.log("🚀 Testing BatchOrderFiller - Swapping Maker tokens to Taker...");
    console.log("================================================================");

    // Load deployed addresses
    const addresses = {
        limitOrderProtocol: "0xE53136D9De56672e8D2665C98653AC7b8A60Dc44",
        batchOrderFiller: "0x71f7FfbC52c14C1911fc8F855FeC2877e069FD1D",
        maker1Token: "0x921513BC14b691FF539BFf3A9B99Ad6BBba0F32f",
        maker2Token: "0x04f98C78f50229ea997aaAdAf033E76700639627",
        maker3Token: "0xb4A46cc8a7a75016Df317cf7F9829c99b0E0930e",
        takerToken: "0x4DBD404Dab4dF38943Cb21dba97686Ce01340aAf"
    };

    const [deployer] = await ethers.getSigners();
    console.log("Deployer (acts as both maker and taker):", deployer.address);

    // Get current nonce to ensure proper sequencing
    let currentNonce = await ethers.provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", currentNonce);

    const chainId = 84532; // Base Sepolia

    // Get contract instances
    const limitOrderProtocol = await ethers.getContractAt("LimitOrderProtocol", addresses.limitOrderProtocol);
    const batchOrderFiller = await ethers.getContractAt("BatchOrderFiller", addresses.batchOrderFiller);
    const maker1Token = await ethers.getContractAt("Maker1Token", addresses.maker1Token);
    const maker2Token = await ethers.getContractAt("Maker2Token", addresses.maker2Token);
    const maker3Token = await ethers.getContractAt("Maker3Token", addresses.maker3Token);
    const takerToken = await ethers.getContractAt("TakerToken", addresses.takerToken);

    console.log("\n📋 Step 1: Setup maker account (deployer) with tokens");
    console.log("====================================================");

    // Check current balances
    const currentMaker1 = await maker1Token.balanceOf(deployer.address);
    const currentMaker2 = await maker2Token.balanceOf(deployer.address);
    const currentMaker3 = await maker3Token.balanceOf(deployer.address);
    const currentTaker = await takerToken.balanceOf(deployer.address);

    console.log("Current balances:");
    console.log("MAKER1:", ethers.formatEther(currentMaker1));
    console.log("MAKER2:", ethers.formatEther(currentMaker2));
    console.log("MAKER3:", ethers.formatEther(currentMaker3));
    console.log("TAKER:", ethers.formatEther(currentTaker));

    // Approve LimitOrderProtocol to spend maker tokens with explicit nonce management
    console.log("\n🔧 Approving tokens with nonce management...");
    
    try {
        const tx1 = await maker1Token.approve(addresses.limitOrderProtocol, ethers.MaxUint256, {
            nonce: currentNonce++,
            gasLimit: 100000
        });
        await tx1.wait();
        console.log("✅ MAKER1 approved, nonce:", currentNonce - 1);

        const tx2 = await maker2Token.approve(addresses.limitOrderProtocol, ethers.MaxUint256, {
            nonce: currentNonce++,
            gasLimit: 100000
        });
        await tx2.wait();
        console.log("✅ MAKER2 approved, nonce:", currentNonce - 1);

        const tx3 = await maker3Token.approve(addresses.limitOrderProtocol, ethers.MaxUint256, {
            nonce: currentNonce++,
            gasLimit: 100000
        });
        await tx3.wait();
        console.log("✅ MAKER3 approved, nonce:", currentNonce - 1);

    } catch (error) {
        console.error("❌ Approval failed:", error.message);
        return;
    }

    console.log("✅ Approved LimitOrderProtocol to spend all maker tokens");

    console.log("\n📝 Step 2: Create limit orders (deployer as maker)");
    console.log("==================================================");

    // Order 1: 100 MAKER1 → 200 TAKER (1 MAKER1 = 2 TAKER)
    const order1 = buildOrder({
        makerAsset: addresses.maker1Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("100"),
        takingAmount: ethers.parseEther("200"),
        maker: deployer.address, // deployer is the maker
        makerTraits: buildMakerTraits({ allowMultipleFills: true })
    });

    // Order 2: 50 MAKER2 → 25 TAKER (1 MAKER2 = 0.5 TAKER)
    const order2 = buildOrder({
        makerAsset: addresses.maker2Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("50"),
        takingAmount: ethers.parseEther("25"),
        maker: deployer.address, // deployer is the maker
        makerTraits: buildMakerTraits({ allowMultipleFills: true })
    });

    // Order 3: 75 MAKER3 → 150 TAKER (1 MAKER3 = 2 TAKER)
    const order3 = buildOrder({
        makerAsset: addresses.maker3Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("75"),
        takingAmount: ethers.parseEther("150"),
        maker: deployer.address, // deployer is the maker
        makerTraits: buildMakerTraits({ allowMultipleFills: true })
    });

    console.log("✅ Orders created:");
    console.log("  - Order 1: 100 MAKER1 → 200 TAKER");
    console.log("  - Order 2: 50 MAKER2 → 25 TAKER");
    console.log("  - Order 3: 75 MAKER3 → 150 TAKER");
    console.log("  - Total TAKER needed: 375");

    console.log("\n✍️ Step 3: Sign orders (deployer signs as maker)");
    console.log("=================================================");

    const signature1 = await signOrder(order1, chainId, addresses.limitOrderProtocol, deployer);
    const signature2 = await signOrder(order2, chainId, addresses.limitOrderProtocol, deployer);
    const signature3 = await signOrder(order3, chainId, addresses.limitOrderProtocol, deployer);

    const sig1 = ethers.Signature.from(signature1);
    const sig2 = ethers.Signature.from(signature2);
    const sig3 = ethers.Signature.from(signature3);

    console.log("✅ All orders signed by deployer");

    console.log("\n💰 Step 4: Prepare taker (also deployer) with TAKER tokens");
    console.log("===========================================================");

    const totalTakerNeeded = ethers.parseEther("400"); // 375 + 25 buffer
    
    // Check if we have enough TAKER tokens
    if (currentTaker < totalTakerNeeded) {
        console.log("❌ Insufficient TAKER tokens. Need:", ethers.formatEther(totalTakerNeeded));
        console.log("Available:", ethers.formatEther(currentTaker));
        return;
    }

    try {
        const approveTx = await takerToken.approve(addresses.batchOrderFiller, totalTakerNeeded, {
            nonce: currentNonce++,
            gasLimit: 100000
        });
        await approveTx.wait();
        console.log("✅ Approved BatchOrderFiller to spend", ethers.formatEther(totalTakerNeeded), "TAKER tokens");
    } catch (error) {
        console.error("❌ TAKER token approval failed:", error.message);
        return;
    }

    console.log("\n📦 Step 5: Prepare batch order data");
    console.log("====================================");

    const orderFillData = [
        {
            order: order1,
            r: sig1.r,
            vs: sig1.yParityAndS,
            amount: ethers.parseEther("200"), // taking amount
            takerTraits: buildTakerTraits({ makingAmount: false }).traits,
            maxTakingAmount: ethers.parseEther("205") // 200 + 5 buffer
        },
        {
            order: order2,
            r: sig2.r,
            vs: sig2.yParityAndS,
            amount: ethers.parseEther("25"), // taking amount
            takerTraits: buildTakerTraits({ makingAmount: false }).traits,
            maxTakingAmount: ethers.parseEther("30") // 25 + 5 buffer
        },
        {
            order: order3,
            r: sig3.r,
            vs: sig3.yParityAndS,
            amount: ethers.parseEther("150"), // taking amount
            takerTraits: buildTakerTraits({ makingAmount: false }).traits,
            maxTakingAmount: ethers.parseEther("160") // 150 + 10 buffer
        }
    ];

    console.log("✅ Batch order data prepared");

    console.log("\n📊 Pre-batch balances:");
    console.log("======================");
    console.log("Deployer MAKER1:", ethers.formatEther(await maker1Token.balanceOf(deployer.address)));
    console.log("Deployer MAKER2:", ethers.formatEther(await maker2Token.balanceOf(deployer.address)));
    console.log("Deployer MAKER3:", ethers.formatEther(await maker3Token.balanceOf(deployer.address)));
    console.log("Deployer TAKER:", ethers.formatEther(await takerToken.balanceOf(deployer.address)));

    console.log("\n🔥 Step 6: Execute batch fill");
    console.log("==============================");

    try {
        // Estimate gas first
        const gasEstimate = await batchOrderFiller.fillBatch.estimateGas(orderFillData, deployer.address);
        console.log("Estimated gas:", gasEstimate.toString());

        const tx = await batchOrderFiller.fillBatch(orderFillData, deployer.address, {
            nonce: currentNonce++,
            gasLimit: gasEstimate + 100000n // Add buffer
        });
        const receipt = await tx.wait();
        
        console.log("✅ Batch fill successful!");
        console.log("Transaction hash:", receipt.hash);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("View on BaseScan: https://sepolia.basescan.org/tx/" + receipt.hash);

        // Parse events
        console.log("\n📈 Transaction Events:");
        console.log("======================");
        
        for (const log of receipt.logs) {
            try {
                const parsedLog = batchOrderFiller.interface.parseLog(log);
                if (parsedLog.name === "OrderFilled") {
                    console.log(`Order ${parsedLog.args.index} filled:`);
                    console.log(`  Making Amount: ${ethers.formatEther(parsedLog.args.makingAmount)}`);
                    console.log(`  Taking Amount: ${ethers.formatEther(parsedLog.args.takingAmount)}`);
                } else if (parsedLog.name === "BatchFilled") {
                    console.log("Batch Summary:");
                    console.log(`  Total Orders: ${parsedLog.args.totalOrders}`);
                    console.log(`  Total Making Amount: ${ethers.formatEther(parsedLog.args.totalMakingAmount)}`);
                    console.log(`  Total Taking Amount: ${ethers.formatEther(parsedLog.args.totalTakingAmount)}`);
                    console.log(`  Refund: ${ethers.formatEther(parsedLog.args.refund)}`);
                }
            } catch (e) {
                // Skip non-BatchOrderFiller events
            }
        }

    } catch (error) {
        console.error("❌ Batch fill failed:", error.message);
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
        if (error.data) {
            console.error("Error data:", error.data);
        }
        return;
    }

    console.log("\n📊 Post-batch balances:");
    console.log("========================");
    console.log("Deployer MAKER1:", ethers.formatEther(await maker1Token.balanceOf(deployer.address)));
    console.log("Deployer MAKER2:", ethers.formatEther(await maker2Token.balanceOf(deployer.address)));
    console.log("Deployer MAKER3:", ethers.formatEther(await maker3Token.balanceOf(deployer.address)));
    console.log("Deployer TAKER:", ethers.formatEther(await takerToken.balanceOf(deployer.address)));

    console.log("\n🎉 BATCH SWAP TEST COMPLETED SUCCESSFULLY!");
    console.log("==========================================");
    console.log("In this test, the deployer acted as both maker and taker:");
    console.log("- Sold: 100 MAKER1 + 50 MAKER2 + 75 MAKER3 tokens");
    console.log("- Bought: 375 TAKER tokens (net effect)");
    console.log("- This demonstrates the BatchOrderFiller functionality!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });