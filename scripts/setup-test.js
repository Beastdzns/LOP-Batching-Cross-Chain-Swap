const { ethers } = require("hardhat");
const { buildOrder, signOrder, buildTakerTraits } = require("../test/helpers/orderUtils");

async function main() {
    console.log("🚀 OPTIMIZED DEMO: BatchOrderFillerWithPermit (Auto Gas)");
    console.log("=======================================================");

    const addresses = {
        limitOrderProtocol: "0xE53136D9De56672e8D2665C98653AC7b8A60Dc44",
        batchOrderFillerWithPermit: "0xD3c9D46329C6F07E4b9ca94Ee94051F77bfcab3F",
        maker1Token: "0x9607c8045566eDa2ebCf2a044438bD65DB37386C",
        maker2Token: "0x804883DbC16BCB93f63E3d7eB7C7a07Ca4dc1694",
        maker3Token: "0xe60f11F556a6A5936Cd24dB9Dd61ecEfA8CC5b27",
        takerToken: "0xaa3CD0A852651f00c1a79fCE161Ac120FDB83a62"
    };

    const [deployer] = await ethers.getSigners();
    console.log("🔑 Sender:", deployer.address);
    
    // Check balance with better formatting
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 ETH Balance:", ethers.formatEther(balance));

    // Check current network gas prices
    const feeData = await ethers.provider.getFeeData();
    console.log("⛽ Network Gas Info:");
    if (feeData.maxFeePerGas) {
        console.log("  Max Fee:", ethers.formatUnits(feeData.maxFeePerGas, "gwei"), "gwei");
        console.log("  Priority Fee:", ethers.formatUnits(feeData.maxPriorityFeePerGas || 0n, "gwei"), "gwei");
    } else {
        console.log("  Gas Price:", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");
    }

    const chainId = 84532;

    // Contract instances
    const limitOrderProtocol = await ethers.getContractAt("LimitOrderProtocol", addresses.limitOrderProtocol);
    const batchOrderFillerWithPermit = await ethers.getContractAt("BatchOrderFillerWithPermit", addresses.batchOrderFillerWithPermit);
    
    const tokenABI = [
        "function name() view returns (string)",
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)"
    ];

    const maker1Token = await ethers.getContractAt(tokenABI, addresses.maker1Token);
    const maker2Token = await ethers.getContractAt(tokenABI, addresses.maker2Token);
    const maker3Token = await ethers.getContractAt(tokenABI, addresses.maker3Token);
    const takerToken = await ethers.getContractAt(tokenABI, addresses.takerToken);

    // Helper function for auto-gas transactions
    async function executeWithAutoGas(contractCall, description) {
        console.log(`🔄 ${description}...`);
        
        const tx = await contractCall();
        console.log(`⏳ Tx: ${tx.hash}`);
        
        const receipt = await tx.wait();
        const cost = receipt.gasUsed * receipt.gasPrice;
        console.log(`✅ Success! Gas: ${receipt.gasUsed} | Cost: ${ethers.formatEther(cost)} ETH`);
        
        return receipt;
    }

    console.log("\n📊 Pre-Transaction Balances");
    console.log("============================");
    console.log("MAKER1:", ethers.formatEther(await maker1Token.balanceOf(deployer.address)));
    console.log("MAKER2:", ethers.formatEther(await maker2Token.balanceOf(deployer.address)));
    console.log("MAKER3:", ethers.formatEther(await maker3Token.balanceOf(deployer.address)));
    console.log("TAKER:", ethers.formatEther(await takerToken.balanceOf(deployer.address)));

    console.log("\n🏗️ Creating Orders");
    console.log("==================");
    
    const lopAddress = await limitOrderProtocol.getAddress();
    
    const order1 = buildOrder({
        maker: deployer.address,
        makerAsset: addresses.maker1Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("2"),   // Smaller amounts = less gas
        takingAmount: ethers.parseEther("4"),
    });

    const order2 = buildOrder({
        maker: deployer.address,
        makerAsset: addresses.maker2Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("1"),
        takingAmount: ethers.parseEther("3"),
    });

    const order3 = buildOrder({
        maker: deployer.address,
        makerAsset: addresses.maker3Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("1"),
        takingAmount: ethers.parseEther("2"),
    });

    console.log("Orders: 2+1+1 MAKER → 4+3+2 TAKER");

    // Sign orders
    const signature1 = await signOrder(order1, chainId, lopAddress, deployer);
    const signature2 = await signOrder(order2, chainId, lopAddress, deployer);
    const signature3 = await signOrder(order3, chainId, lopAddress, deployer);

    const { r: r1, yParityAndS: vs1 } = ethers.Signature.from(signature1);
    const { r: r2, yParityAndS: vs2 } = ethers.Signature.from(signature2);
    const { r: r3, yParityAndS: vs3 } = ethers.Signature.from(signature3);

    console.log("✅ Orders signed");

    console.log("\n🔑 Approvals (Auto Gas)");
    console.log("========================");

    // All approvals with auto gas
    await executeWithAutoGas(
        () => maker1Token.approve(lopAddress, ethers.parseEther("2")),
        "Approving MAKER1"
    );

    await executeWithAutoGas(
        () => maker2Token.approve(lopAddress, ethers.parseEther("1")),
        "Approving MAKER2"
    );

    await executeWithAutoGas(
        () => maker3Token.approve(lopAddress, ethers.parseEther("1")),
        "Approving MAKER3"
    );

    // Prepare batch data
    const takerTraits = buildTakerTraits({ makingAmount: false });
    const batchOrderData = [
        {
            order: order1,
            r: r1,
            vs: vs1,
            amount: ethers.parseEther("4"),
            takerTraits: takerTraits.traits,
            maxTakingAmount: ethers.parseEther("5")
        },
        {
            order: order2,
            r: r2,
            vs: vs2,
            amount: ethers.parseEther("3"),
            takerTraits: takerTraits.traits,
            maxTakingAmount: ethers.parseEther("4")
        },
        {
            order: order3,
            r: r3,
            vs: vs3,
            amount: ethers.parseEther("2"),
            takerTraits: takerTraits.traits,
            maxTakingAmount: ethers.parseEther("3")
        }
    ];

    const totalMaxTaking = ethers.parseEther("12");

    await executeWithAutoGas(
        () => takerToken.approve(addresses.batchOrderFillerWithPermit, totalMaxTaking),
        "Approving TAKER for batch filler"
    );

    console.log("\n🚀 Batch Fill Execution");
    console.log("========================");

    const batchReceipt = await executeWithAutoGas(
        () => batchOrderFillerWithPermit.fillBatch(batchOrderData, deployer.address),
        "Executing batch fill"
    );

    // Parse events
    for (const log of batchReceipt.logs) {
        try {
            const parsed = batchOrderFillerWithPermit.interface.parseLog(log);
            if (parsed.name === 'BatchFilled') {
                console.log("\n🎯 Batch Results:");
                console.log("Orders Filled:", parsed.args.totalOrders.toString());
                console.log("Total Making:", ethers.formatEther(parsed.args.totalMakingAmount));
                console.log("Total Taking:", ethers.formatEther(parsed.args.totalTakingAmount));
                console.log("Refund:", ethers.formatEther(parsed.args.refund));
            }
        } catch (e) {}
    }

    console.log("\n📊 Final Balances");
    console.log("==================");
    console.log("MAKER1:", ethers.formatEther(await maker1Token.balanceOf(deployer.address)));
    console.log("MAKER2:", ethers.formatEther(await maker2Token.balanceOf(deployer.address)));
    console.log("MAKER3:", ethers.formatEther(await maker3Token.balanceOf(deployer.address)));
    console.log("TAKER:", ethers.formatEther(await takerToken.balanceOf(deployer.address)));

    console.log("\n🎉 DEMO COMPLETED WITH AUTO GAS!");
}

main().then(() => process.exit(0)).catch(console.error);