const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Mock Tokens with EIP-2612 Permit Support to Base Sepolia...");
    console.log("=======================================================================");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Get current nonce for sequential deployment
    let nonce = await ethers.provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", nonce);

    console.log("\n📦 Deploying Token Contracts...");
    console.log("===============================");

    // Deploy Maker1 Token
    console.log("Deploying Maker1Token...");
    const Maker1Token = await ethers.getContractFactory("Maker1Token");
    const maker1 = await Maker1Token.deploy({ nonce: nonce++ });
    await maker1.waitForDeployment();
    const maker1Address = await maker1.getAddress();
    console.log("✅ Maker1Token deployed to:", maker1Address);

    // Deploy Maker2 Token
    console.log("Deploying Maker2Token...");
    const Maker2Token = await ethers.getContractFactory("Maker2Token");
    const maker2 = await Maker2Token.deploy({ nonce: nonce++ });
    await maker2.waitForDeployment();
    const maker2Address = await maker2.getAddress();
    console.log("✅ Maker2Token deployed to:", maker2Address);

    // Deploy Maker3 Token
    console.log("Deploying Maker3Token...");
    const Maker3Token = await ethers.getContractFactory("Maker3Token");
    const maker3 = await Maker3Token.deploy({ nonce: nonce++ });
    await maker3.waitForDeployment();
    const maker3Address = await maker3.getAddress();
    console.log("✅ Maker3Token deployed to:", maker3Address);

    // Deploy Taker Token
    console.log("Deploying TakerToken...");
    const TakerToken = await ethers.getContractFactory("TakerToken");
    const taker = await TakerToken.deploy({ nonce: nonce++ });
    await taker.waitForDeployment();
    const takerAddress = await taker.getAddress();
    console.log("✅ TakerToken deployed to:", takerAddress);

    console.log("\n🔍 Verifying EIP-2612 Permit Support...");
    console.log("========================================");

    // Verify permit support for each token
    const tokens = [
        { name: "Maker1Token", contract: maker1, address: maker1Address },
        { name: "Maker2Token", contract: maker2, address: maker2Address },
        { name: "Maker3Token", contract: maker3, address: maker3Address },
        { name: "TakerToken", contract: taker, address: takerAddress }
    ];

    for (const token of tokens) {
        try {
            // Check if permit functions exist
            const domainSeparator = await token.contract.DOMAIN_SEPARATOR();
            const nonce = await token.contract.nonces(deployer.address);
            const name = await token.contract.name();
            const symbol = await token.contract.symbol();
            
            console.log(`✅ ${token.name}:`);
            console.log(`   Name: ${name} (${symbol})`);
            console.log(`   Domain Separator: ${domainSeparator.slice(0, 10)}...`);
            console.log(`   Current Nonce: ${nonce}`);
            console.log(`   EIP-2612 Support: ✅ YES`);
        } catch (error) {
            console.log(`❌ ${token.name}: EIP-2612 Support: NO`);
            console.log(`   Error: ${error.message}`);
        }
    }

    // Mint additional tokens to deployer (10M each)
    const mintAmount = ethers.parseEther("10000000"); // 10 million tokens

    console.log("\n💰 Minting Additional Tokens...");
    console.log("================================");
    
    try {
        const mintTx1 = await maker1.mint(deployer.address, mintAmount, { nonce: nonce++ });
        await mintTx1.wait();
        console.log("✅ Minted 10M MAKER1 tokens");

        const mintTx2 = await maker2.mint(deployer.address, mintAmount, { nonce: nonce++ });
        await mintTx2.wait();
        console.log("✅ Minted 10M MAKER2 tokens");

        const mintTx3 = await maker3.mint(deployer.address, mintAmount, { nonce: nonce++ });
        await mintTx3.wait();
        console.log("✅ Minted 10M MAKER3 tokens");

        const mintTx4 = await taker.mint(deployer.address, mintAmount, { nonce: nonce++ });
        await mintTx4.wait();
        console.log("✅ Minted 10M TAKER tokens");
    } catch (error) {
        console.error("❌ Error during minting:", error.message);
    }

    console.log("\n📊 Final Token Balances:");
    console.log("========================");
    try {
        const maker1Balance = await maker1.balanceOf(deployer.address);
        const maker2Balance = await maker2.balanceOf(deployer.address);
        const maker3Balance = await maker3.balanceOf(deployer.address);
        const takerBalance = await taker.balanceOf(deployer.address);

        console.log("MAKER1:", ethers.formatEther(maker1Balance), "tokens");
        console.log("MAKER2:", ethers.formatEther(maker2Balance), "tokens");
        console.log("MAKER3:", ethers.formatEther(maker3Balance), "tokens");
        console.log("TAKER:", ethers.formatEther(takerBalance), "tokens");
    } catch (error) {
        console.error("❌ Error checking balances:", error.message);
    }

    console.log("\n🎯 Deployment Summary:");
    console.log("======================");
    console.log("Network: Base Sepolia (Chain ID: 84532)");
    console.log("Deployer:", deployer.address);
    console.log();
    console.log("📝 Contract Addresses:");
    console.log("Maker1Token:", maker1Address);
    console.log("Maker2Token:", maker2Address);
    console.log("Maker3Token:", maker3Address);
    console.log("TakerToken:", takerAddress);
    
    console.log("\n🔧 Integration Configuration:");
    console.log("=============================");
    console.log("// Update your BatchOrderFillerWithPermit test script with these addresses:");
    console.log("const addresses = {");
    console.log(`    limitOrderProtocol: "0xE53136D9De56672e8D2665C98653AC7b8A60Dc44",`);
    console.log(`    batchOrderFillerWithPermit: "0xD3c9D46329C6F07E4b9ca94Ee94051F77bfcab3F",`);
    console.log(`    weth: "0x885fd951fB363B6F7ECda513745Ce124E88D09aC",`);
    console.log(`    maker1Token: "${maker1Address}",`);
    console.log(`    maker2Token: "${maker2Address}",`);
    console.log(`    maker3Token: "${maker3Address}",`);
    console.log(`    takerToken: "${takerAddress}"`);
    console.log("};");

    console.log("\n🧪 Test Permit Functionality:");
    console.log("=============================");
    console.log("All tokens now support EIP-2612 permits! You can:");
    console.log("✅ Use fillBatchWithPermit() for gasless token approvals");
    console.log("✅ Create permit signatures off-chain");
    console.log("✅ Batch multiple token swaps in a single transaction");
    console.log("✅ Save gas on approval transactions");

    console.log("\n🚀 Next Steps:");
    console.log("==============");
    console.log("1. Update your test script with the new token addresses above");
    console.log("2. Run the BatchOrderFillerWithPermit test script");
    console.log("3. Test both regular and permit-based batch filling");
    console.log("4. Compare gas costs between the two approaches");

    console.log("\n🎉 Mock Token Deployment Complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });