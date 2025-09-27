const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Extensions to Base Sepolia...");
    console.log("=====================================");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    if (balance < ethers.parseEther("0.005")) {
        throw new Error("Insufficient ETH balance. Need at least 0.005 ETH for deployment.");
    }

    const deployedAddresses = {};

    // Use existing LimitOrderProtocol
    deployedAddresses.limitOrderProtocol = "0xE53136D9De56672e8D2665C98653AC7b8A60Dc44";
    console.log("Using existing LimitOrderProtocol at:", deployedAddresses.limitOrderProtocol);

    // Use your existing token addresses
    deployedAddresses.maker1Token = "0x921513BC14b691FF539BFf3A9B99Ad6BBba0F32f";
    deployedAddresses.maker2Token = "0x04f98C78f50229ea997aaAdAf033E76700639627";
    deployedAddresses.maker3Token = "0xb4A46cc8a7a75016Df317cf7F9829c99b0E0930e";
    deployedAddresses.takerToken = "0x4DBD404Dab4dF38943Cb21dba97686Ce01340aAf";

    console.log("Using existing tokens:");
    console.log("Maker1Token:", deployedAddresses.maker1Token);
    console.log("Maker2Token:", deployedAddresses.maker2Token);
    console.log("Maker3Token:", deployedAddresses.maker3Token);
    console.log("TakerToken:", deployedAddresses.takerToken);

    // Deploy WETH Mock (for completeness, using the existing WrappedTokenMock)
    console.log("\n1. Deploying WETH Mock...");
    const WrappedTokenMock = await ethers.getContractFactory("WrappedTokenMock");
    const weth = await WrappedTokenMock.deploy("Wrapped Ether", "WETH");
    await weth.waitForDeployment();
    deployedAddresses.weth = await weth.getAddress();
    console.log("WETH Mock deployed to:", deployedAddresses.weth);

    // Deploy BatchOrderFiller Extension
    console.log("\n2. Deploying BatchOrderFiller Extension...");
    const BatchOrderFiller = await ethers.getContractFactory("BatchOrderFiller");
    const batchOrderFiller = await BatchOrderFiller.deploy(deployedAddresses.limitOrderProtocol);
    await batchOrderFiller.waitForDeployment();
    deployedAddresses.batchOrderFiller = await batchOrderFiller.getAddress();
    console.log("BatchOrderFiller deployed to:", deployedAddresses.batchOrderFiller);

    // Test existing LimitOrderProtocol functionality
    console.log("\n3. Testing existing LimitOrderProtocol functionality...");
    try {
        const limitOrderProtocol = await ethers.getContractAt("LimitOrderProtocol", deployedAddresses.limitOrderProtocol);
        const domainSeparator = await limitOrderProtocol.DOMAIN_SEPARATOR();
        console.log("Domain separator:", domainSeparator);
        
        console.log("✅ Existing LimitOrderProtocol is functional");
        
        // Test BatchOrderFiller connection
        const connectedLOP = await batchOrderFiller.LIMIT_ORDER_PROTOCOL();
        console.log("BatchOrderFiller connected to LOP:", connectedLOP);
        if (connectedLOP.toLowerCase() === deployedAddresses.limitOrderProtocol.toLowerCase()) {
            console.log("✅ BatchOrderFiller properly connected to LimitOrderProtocol");
        } else {
            console.log("❌ BatchOrderFiller connection mismatch");
        }
        
    } catch (error) {
        console.log("❌ LimitOrderProtocol test failed:", error.message);
    }

    // Test token connections
    console.log("\n4. Testing token connections...");
    try {
        const maker1Token = await ethers.getContractAt("Maker1Token", deployedAddresses.maker1Token);
        const takerToken = await ethers.getContractAt("TakerToken", deployedAddresses.takerToken);
        
        const maker1Balance = await maker1Token.balanceOf(deployer.address);
        const takerBalance = await takerToken.balanceOf(deployer.address);
        
        console.log("Your MAKER1 balance:", ethers.formatEther(maker1Balance));
        console.log("Your TAKER balance:", ethers.formatEther(takerBalance));
        
        console.log("✅ Token connections working");
    } catch (error) {
        console.log("❌ Token connection test failed:", error.message);
    }

    // Final Summary
    console.log("\n========================================================");
    console.log("🎉 EXTENSIONS DEPLOYMENT COMPLETE!");
    console.log("========================================================");
    console.log("System Configuration:");
    console.log("====================");
    console.log("LimitOrderProtocol (existing):", deployedAddresses.limitOrderProtocol);
    console.log("BatchOrderFiller (new):", deployedAddresses.batchOrderFiller);
    console.log("WETH Mock (new):", deployedAddresses.weth);
    console.log("Maker1Token (existing):", deployedAddresses.maker1Token);
    console.log("Maker2Token (existing):", deployedAddresses.maker2Token);
    console.log("Maker3Token (existing):", deployedAddresses.maker3Token);
    console.log("TakerToken (existing):", deployedAddresses.takerToken);

    console.log("\nNext Steps:");
    console.log("==========");
    console.log("1. Create limit orders using your existing tokens");
    console.log("2. Use BatchOrderFiller to execute batch swaps");
    console.log("3. Monitor transactions on BaseScan");

    // Save addresses to file
    const fs = require('fs');
    fs.writeFileSync(
        'deployed-addresses.json', 
        JSON.stringify(deployedAddresses, null, 2)
    );
    console.log("\n📝 Addresses saved to deployed-addresses.json");

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });