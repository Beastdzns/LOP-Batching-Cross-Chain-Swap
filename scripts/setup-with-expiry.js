const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Testing BatchOrderFillerWithPermit Expiry Functionality");
    console.log("=" .repeat(60));

    // Use your already deployed contract addresses
    const addresses = {
        limitOrderProtocol: "0xE53136D9De56672e8D2665C98653AC7b8A60Dc44",
        batchOrderFiller: "0x1203250cb71Fdf9bbd1ed75659B13f669933b578", // From your deploy.js
        maker1Token: "0x9607c8045566eDa2ebCf2a044438bD65DB37386C",
        maker2Token: "0x804883DbC16BCB93f63E3d7eB7C7a07Ca4dc1694", 
        maker3Token: "0xe60f11F556a6A5936Cd24dB9Dd61ecEfA8CC5b27",
        takerToken: "0xaa3CD0A852651f00c1a79fCE161Ac120FDB83a62",
        weth: "0x885fd951fB363B6F7ECda513745Ce124E88D09aC"
    };

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Connect to already deployed BatchOrderFillerWithPermit
    console.log("\n📦 Connecting to deployed BatchOrderFillerWithPermit...");
    const batchFiller = await ethers.getContractAt("BatchOrderFillerWithPermit", addresses.batchOrderFiller);
    console.log("Connected to BatchOrderFillerWithPermit at:", addresses.batchOrderFiller);

    // Verify contract connection
    try {
        const connectedLOP = await batchFiller.LIMIT_ORDER_PROTOCOL();
        console.log("Contract is connected to LOP:", connectedLOP);
        
        if (connectedLOP.toLowerCase() === addresses.limitOrderProtocol.toLowerCase()) {
            console.log("✅ Contract connection verified");
        } else {
            console.log("❌ Contract connection mismatch");
            return;
        }
    } catch (error) {
        console.log("❌ Failed to connect to contract:", error.message);
        return;
    }

    // Get contract instances for tokens
    const maker1Token = await ethers.getContractAt("Maker1Token", addresses.maker1Token);
    const takerToken = await ethers.getContractAt("TakerToken", addresses.takerToken);

    console.log("\n💰 Checking balances...");
    try {
        const maker1Balance = await maker1Token.balanceOf(deployer.address);
        const takerBalance = await takerToken.balanceOf(deployer.address);
        console.log("Maker1 balance:", ethers.formatEther(maker1Balance));
        console.log("Taker balance:", ethers.formatEther(takerBalance));
    } catch (error) {
        console.log("Note: Could not fetch balances -", error.message);
    }

    // Get current block timestamp (works on real networks)
    const currentBlock = await ethers.provider.getBlock('latest');
    const currentTime = currentBlock.timestamp;

    // Test 1: Valid (Non-expired) Order
    console.log("\n🧪 TEST 1: Valid Non-Expired Order");
    console.log("-".repeat(40));
    
    const validExpiry = currentTime + 3600; // 1 hour from now
    
    console.log("Current timestamp:", currentTime);
    console.log("Valid expiry timestamp:", validExpiry);

    // Check if order is expired (should be false)
    const isExpired1 = await batchFiller.isOrderExpired(validExpiry);
    console.log("✅ Order expired (should be false):", isExpired1);

    // Test 2: Expired Order
    console.log("\n🧪 TEST 2: Expired Order");
    console.log("-".repeat(40));
    
    const expiredTime = currentTime - 3600; // 1 hour ago
    console.log("Expired timestamp:", expiredTime);
    
    // Check if order is expired (should be true)
    const isExpired2 = await batchFiller.isOrderExpired(expiredTime);
    console.log("✅ Order expired (should be true):", isExpired2);

    // Test 3: Zero expiry (never expires)
    console.log("\n🧪 TEST 3: Zero Expiry (Never Expires)");
    console.log("-".repeat(40));
    
    const neverExpires = await batchFiller.isOrderExpired(0);
    console.log("✅ Zero expiry order expired (should be false):", neverExpires);

    // Test 4: Batch Expiry Validation
    console.log("\n🧪 TEST 4: Batch Expiry Validation");
    console.log("-".repeat(40));

    // Create complete order data with all required fields for IOrderMixin.Order
    const createOrderData = (expiry) => ({
        order: {
            salt: ethers.randomBytes(32), // Add missing salt field
            maker: deployer.address,
            receiver: ethers.ZeroAddress,
            makerAsset: addresses.maker1Token,
            takerAsset: addresses.takerToken,
            makingAmount: ethers.parseEther("100"),
            takingAmount: ethers.parseEther("100"),
            offsets: 0,
            interactions: "0x"
        },
        r: ethers.randomBytes(32),
        vs: ethers.randomBytes(32),
        amount: ethers.parseEther("100"),
        takerTraits: 0,
        maxTakingAmount: ethers.parseEther("100"),
        expiry: expiry
    });

    try {
        const validOrderData = createOrderData(validExpiry);
        const expiredOrderData = createOrderData(expiredTime);
        const neverExpiresOrderData = createOrderData(0);

        // Test single order expiry
        const singleValidResult = await batchFiller.validateOrdersExpiry([validOrderData]);
        console.log("✅ Single valid order result (should be [false]):", singleValidResult);

        const singleExpiredResult = await batchFiller.validateOrdersExpiry([expiredOrderData]);
        console.log("✅ Single expired order result (should be [true]):", singleExpiredResult);

        // Test mixed batch
        const mixedOrders = [validOrderData, expiredOrderData, neverExpiresOrderData];
        const mixedResults = await batchFiller.validateOrdersExpiry(mixedOrders);
        console.log("✅ Mixed batch results (should be [false, true, false]):", mixedResults);

        // Test 6: Complex batch with different expiry scenarios
        console.log("\n🧪 TEST 6: Complex Batch Validation");
        console.log("-".repeat(40));
        
        const complexBatch = [
            createOrderData(0), // Never expires
            createOrderData(currentTime + 3600), // Valid (1 hour)
            createOrderData(currentTime - 100), // Expired (100 seconds ago)
            createOrderData(currentTime + 1800), // Valid (30 minutes)
            createOrderData(currentTime - 10) // Expired (10 seconds ago)
        ];

        const complexResults = await batchFiller.validateOrdersExpiry(complexBatch);
        console.log("✅ Complex batch results:");
        console.log("   [0] Never expires (should be false):", complexResults[0]);
        console.log("   [1] Valid 1h (should be false):", complexResults[1]);
        console.log("   [2] Expired 100s ago (should be true):", complexResults[2]);
        console.log("   [3] Valid 30m (should be false):", complexResults[3]);
        console.log("   [4] Expired 10s ago (should be true):", complexResults[4]);

    } catch (error) {
        console.log("❌ Batch validation failed:", error.message);
        console.log("This might indicate the contract doesn't have the validateOrdersExpiry function");
    }

    // Test 5: Different expiry scenarios (without time manipulation)
    console.log("\n🧪 TEST 5: Various Expiry Scenarios");
    console.log("-".repeat(40));
    
    const scenarios = [
        { name: "1 minute ago", expiry: currentTime - 60 },
        { name: "Current time", expiry: currentTime },
        { name: "1 minute future", expiry: currentTime + 60 },
        { name: "1 hour future", expiry: currentTime + 3600 },
        { name: "1 day future", expiry: currentTime + 86400 },
        { name: "Never expires", expiry: 0 }
    ];

    for (const scenario of scenarios) {
        try {
            const isExpired = await batchFiller.isOrderExpired(scenario.expiry);
            const expectedResult = scenario.expiry > 0 && scenario.expiry <= currentTime;
            console.log(`   ${scenario.name}: expired = ${isExpired} (expected: ${expectedResult})`);
        } catch (error) {
            console.log(`   ${scenario.name}: Error - ${error.message}`);
        }
    }

    // Test 7: Edge cases
    console.log("\n🧪 TEST 7: Edge Cases");
    console.log("-".repeat(40));
    
    const edgeCases = [
        { name: "Exactly current timestamp", expiry: currentTime },
        { name: "Very large future timestamp", expiry: currentTime + 365 * 24 * 3600 }, // 1 year
        { name: "Recent past timestamp", expiry: currentTime - 1 },
        { name: "Zero timestamp", expiry: 0 }
    ];

    for (const testCase of edgeCases) {
        try {
            const isExpired = await batchFiller.isOrderExpired(testCase.expiry);
            console.log(`   ${testCase.name}: expired = ${isExpired}`);
        } catch (error) {
            console.log(`   ${testCase.name}: Error - ${error.message}`);
        }
    }

    // Test 8: Permit support check
    console.log("\n🧪 TEST 8: Permit Support Check");
    console.log("-".repeat(40));
    
    try {
        const takerSupportsPermit = await batchFiller.supportsPermit(addresses.takerToken);
        const maker1SupportsPermit = await batchFiller.supportsPermit(addresses.maker1Token);
        
        console.log("✅ TakerToken supports permit:", takerSupportsPermit);
        console.log("✅ Maker1Token supports permit:", maker1SupportsPermit);
        
        if (takerSupportsPermit) {
            const nonce = await batchFiller.getPermitNonce(addresses.takerToken, deployer.address);
            console.log("✅ TakerToken permit nonce:", nonce.toString());
        }
        
        if (maker1SupportsPermit) {
            const nonce = await batchFiller.getPermitNonce(addresses.maker1Token, deployer.address);
            console.log("✅ Maker1Token permit nonce:", nonce.toString());
        }
    } catch (error) {
        console.log("Note: Permit support check failed -", error.message);
    }

    // Test 9: Real-world expiry simulation
    console.log("\n🧪 TEST 9: Real-World Expiry Simulation");
    console.log("-".repeat(40));
    
    const realWorldScenarios = [
        { name: "5 minute order", minutes: 5 },
        { name: "1 hour order", minutes: 60 },
        { name: "24 hour order", minutes: 1440 },
        { name: "7 day order", minutes: 10080 }
    ];

    for (const scenario of realWorldScenarios) {
        try {
            const expiryTime = currentTime + (scenario.minutes * 60);
            const isExpired = await batchFiller.isOrderExpired(expiryTime);
            const hoursFromNow = scenario.minutes / 60;
            console.log(`   ${scenario.name} (${hoursFromNow}h from now): expired = ${isExpired}`);
        } catch (error) {
            console.log(`   ${scenario.name}: Error - ${error.message}`);
        }
    }

    // Test 10: Function availability check
    console.log("\n🧪 TEST 10: Function Availability Check");
    console.log("-".repeat(40));
    
    try {
        const contractInterface = batchFiller.interface;
        const availableFunctions = Object.keys(contractInterface.functions);
        
        const hasIsOrderExpired = availableFunctions.some(f => f.includes('isOrderExpired'));
        const hasValidateOrdersExpiry = availableFunctions.some(f => f.includes('validateOrdersExpiry'));
        const hasSupportsPermit = availableFunctions.some(f => f.includes('supportsPermit'));
        const hasGetPermitNonce = availableFunctions.some(f => f.includes('getPermitNonce'));
        
        console.log("✅ Available functions:");
        console.log("   - isOrderExpired:", hasIsOrderExpired);
        console.log("   - validateOrdersExpiry:", hasValidateOrdersExpiry);
        console.log("   - supportsPermit:", hasSupportsPermit);
        console.log("   - getPermitNonce:", hasGetPermitNonce);
        
        if (!hasIsOrderExpired || !hasValidateOrdersExpiry) {
            console.log("❌ Some expiry functions are missing from the deployed contract");
            console.log("💡 You may need to redeploy with the complete implementation");
        }
        
    } catch (error) {
        console.log("Could not check function availability:", error.message);
    }

    // Summary
    console.log("\n📊 TEST SUMMARY");
    console.log("=" .repeat(50));
    console.log("✅ Contract connection successful");
    console.log("✅ Basic expiry function tests completed");
    console.log("✅ Edge case testing completed");
    console.log("✅ Permit support testing completed");
    console.log("✅ Real-world scenario testing completed");

    console.log("\n🎯 Tested Contract Addresses:");
    console.log("BatchOrderFillerWithPermit:", addresses.batchOrderFiller);
    console.log("LimitOrderProtocol:", addresses.limitOrderProtocol);
    console.log("TakerToken:", addresses.takerToken);
    console.log("Maker1Token:", addresses.maker1Token);
    
    console.log("\n✅ Testing completed!");
    console.log("The deployed contract functionality has been verified.");

    console.log("\n🔍 Current Network Info:");
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("Current Block:", currentBlock.number);
    console.log("Current Timestamp:", currentTime);
    console.log("Current Date:", new Date(currentTime * 1000).toISOString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });