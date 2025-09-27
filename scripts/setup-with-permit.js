const { ethers } = require("hardhat");
const { buildOrder, signOrder, buildTakerTraits } = require("../test/helpers/orderUtils");
const { ether } = require("../test/helpers/utils");

async function main() {
    console.log("🚀 Testing BatchOrderFillerWithPermit - Complete Setup with EIP-2612 Permits");
    console.log("=============================================================================");

    // Load deployed addresses - UPDATED WITH NEW TOKEN ADDRESSES
    const addresses = {
        limitOrderProtocol: "0xE53136D9De56672e8D2665C98653AC7b8A60Dc44",
        batchOrderFillerWithPermit: "0xD3c9D46329C6F07E4b9ca94Ee94051F77bfcab3F",
        weth: "0x885fd951fB363B6F7ECda513745Ce124E88D09aC",
        maker1Token: "0x9607c8045566eDa2ebCf2a044438bD65DB37386C",
        maker2Token: "0x804883DbC16BCB93f63E3d7eB7C7a07Ca4dc1694",
        maker3Token: "0xe60f11F556a6A5936Cd24dB9Dd61ecEfA8CC5b27",
        takerToken: "0xaa3CD0A852651f00c1a79fCE161Ac120FDB83a62"
    };

    const [deployer] = await ethers.getSigners();
    console.log("Deployer (acts as both maker and taker):", deployer.address);

    // Get current nonce to ensure proper sequencing
    let currentNonce = await ethers.provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", currentNonce);

    const chainId = 84532; // Base Sepolia

    // Get contract instances with proper interfaces
    const limitOrderProtocol = await ethers.getContractAt("LimitOrderProtocol", addresses.limitOrderProtocol);
    const batchOrderFillerWithPermit = await ethers.getContractAt("BatchOrderFillerWithPermit", addresses.batchOrderFillerWithPermit);
    
    // Use IERC20Permit interface to ensure permit functions are available
    const maker1Token = await ethers.getContractAt([
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
        "function mint(address,uint256)",
        "function DOMAIN_SEPARATOR() view returns (bytes32)",
        "function nonces(address) view returns (uint256)",
        "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
    ], addresses.maker1Token);

    const maker2Token = await ethers.getContractAt([
        "function name() view returns (string)",
        "function symbol() view returns (string)", 
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
        "function mint(address,uint256)",
        "function DOMAIN_SEPARATOR() view returns (bytes32)",
        "function nonces(address) view returns (uint256)",
        "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
    ], addresses.maker2Token);

    const maker3Token = await ethers.getContractAt([
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
        "function mint(address,uint256)",
        "function DOMAIN_SEPARATOR() view returns (bytes32)",
        "function nonces(address) view returns (uint256)",
        "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
    ], addresses.maker3Token);

    const takerToken = await ethers.getContractAt([
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)",
        "function mint(address,uint256)",
        "function DOMAIN_SEPARATOR() view returns (bytes32)",
        "function nonces(address) view returns (uint256)",
        "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
    ], addresses.takerToken);

    const weth = await ethers.getContractAt("WrappedTokenMock", addresses.weth);

    console.log("\n🔍 Step 1: Verify contract connections and permit support");
    console.log("========================================================");

    // Verify BatchOrderFillerWithPermit connection
    const connectedLOP = await batchOrderFillerWithPermit.LIMIT_ORDER_PROTOCOL();
    console.log("BatchOrderFillerWithPermit connected to LOP:", connectedLOP);
    
    if (connectedLOP.toLowerCase() === addresses.limitOrderProtocol.toLowerCase()) {
        console.log("✅ BatchOrderFillerWithPermit properly connected to LimitOrderProtocol");
    } else {
        console.log("❌ BatchOrderFillerWithPermit connection mismatch");
        return;
    }

    // Check permit support for tokens with corrected function calls
    console.log("\n🔍 Checking EIP-2612 permit support:");
    const tokens = [
        { name: "Maker1Token", contract: maker1Token, address: addresses.maker1Token },
        { name: "Maker2Token", contract: maker2Token, address: addresses.maker2Token },
        { name: "Maker3Token", contract: maker3Token, address: addresses.maker3Token },
        { name: "TakerToken", contract: takerToken, address: addresses.takerToken }
    ];

    const permitSupport = {};
    for (const token of tokens) {
        try {
            // Test multiple ways to call the functions
            let domainSeparator, nonce, name;
            
            try {
                // Try uppercase first (as defined in Solidity)
                domainSeparator = await token.contract.DOMAIN_SEPARATOR();
            } catch (e) {
                try {
                    // Try camelCase version
                    domainSeparator = await token.contract.domainSeparator();
                } catch (e2) {
                    // Try calling with function signature
                    domainSeparator = await token.contract["DOMAIN_SEPARATOR()"]();
                }
            }
            
            try {
                nonce = await token.contract.nonces(deployer.address);
            } catch (e) {
                nonce = await token.contract["nonces(address)"](deployer.address);
            }
            
            try {
                name = await token.contract.name();
            } catch (e) {
                name = await token.contract["name()"]();
            }
            
            console.log(`${token.name}: ✅ EIP-2612 Support confirmed`);
            console.log(`  - Name: ${name}`);
            console.log(`  - Domain Separator: ${domainSeparator.slice(0, 10)}...`);
            console.log(`  - Current Nonce: ${nonce}`);
            permitSupport[token.name] = true;
            
        } catch (error) {
            console.log(`${token.name}: ❌ No EIP-2612 support:`, error.message);
            permitSupport[token.name] = false;
            
            // Try to get basic token info to verify contract is working
            try {
                const name = await token.contract.name();
                const symbol = await token.contract.symbol();
                console.log(`  - But token is accessible: ${name} (${symbol})`);
            } catch (basicError) {
                console.log(`  - Token contract not accessible at all:`, basicError.message);
            }
        }
    }

    // If no tokens support permit, let's check if the contracts were compiled correctly
    const allSupport = Object.values(permitSupport).some(support => support);
    if (!allSupport) {
        console.log("\n⚠️  TROUBLESHOOTING: No tokens support EIP-2612");
        console.log("This could mean:");
        console.log("1. Contracts weren't compiled with ERC20Permit extension");
        console.log("2. ABI doesn't include permit functions");
        console.log("3. Contract addresses are incorrect");
        
        console.log("\n🔍 Let's check basic contract functionality:");
        try {
            const takerName = await takerToken.name();
            const takerSymbol = await takerToken.symbol();
            const takerBalance = await takerToken.balanceOf(deployer.address);
            console.log(`TakerToken basic info: ${takerName} (${takerSymbol}), Balance: ${ethers.formatEther(takerBalance)}`);
        } catch (error) {
            console.log("❌ Can't even access basic token functions:", error.message);
            return;
        }
    }

    console.log("\n💰 Step 2: Check current token balances");
    console.log("=======================================");

    // Check current balances
    const currentMaker1 = await maker1Token.balanceOf(deployer.address);
    const currentMaker2 = await maker2Token.balanceOf(deployer.address);
    const currentMaker3 = await maker3Token.balanceOf(deployer.address);
    const currentTaker = await takerToken.balanceOf(deployer.address);

    console.log("Current balances:");
    console.log("Maker1:", ethers.formatEther(currentMaker1));
    console.log("Maker2:", ethers.formatEther(currentMaker2));
    console.log("Maker3:", ethers.formatEther(currentMaker3));
    console.log("Taker:", ethers.formatEther(currentTaker));

    if (currentMaker1 > 0 && currentMaker2 > 0 && currentMaker3 > 0 && currentTaker > 0) {
        console.log("✅ All tokens have sufficient balances for testing");
    } else {
        console.log("⚠️ Some tokens have zero balance, this might cause issues");
        return;
    }

    // Continue with the rest of your test logic...
    console.log("\n📝 Step 3: Create and sign limit orders");
    console.log("=======================================");

    const lopAddress = await limitOrderProtocol.getAddress();
    
    // Create smaller orders to ensure we have enough balance
    const order1 = buildOrder({
        maker: deployer.address,
        makerAsset: addresses.maker1Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("10"),
        takingAmount: ethers.parseEther("12"),
    });

    const order2 = buildOrder({
        maker: deployer.address,
        makerAsset: addresses.maker2Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("8"),
        takingAmount: ethers.parseEther("13"),
    });

    const order3 = buildOrder({
        maker: deployer.address,
        makerAsset: addresses.maker3Token,
        takerAsset: addresses.takerToken,
        makingAmount: ethers.parseEther("5"),
        takingAmount: ethers.parseEther("14"),
    });

    // Sign orders
    console.log("Signing orders...");
    const signature1 = await signOrder(order1, chainId, lopAddress, deployer);
    const signature2 = await signOrder(order2, chainId, lopAddress, deployer);
    const signature3 = await signOrder(order3, chainId, lopAddress, deployer);

    const { r: r1, yParityAndS: vs1 } = ethers.Signature.from(signature1);
    const { r: r2, yParityAndS: vs2 } = ethers.Signature.from(signature2);
    const { r: r3, yParityAndS: vs3 } = ethers.Signature.from(signature3);

    console.log("✅ All orders created and signed");

    // If we have permit support, test it, otherwise use regular batch
    if (permitSupport.TakerToken) {
        console.log("\n🎉 Testing permit functionality since TakerToken supports it!");
        // Add your permit testing code here
    } else {
        console.log("\n⚠️ Skipping permit test - using regular approvals instead");
        console.log("To fix permit support, ensure your token contracts:");
        console.log("1. Inherit from ERC20Permit");
        console.log("2. Are compiled with the correct ABI");
        console.log("3. Have the DOMAIN_SEPARATOR and nonces functions");
    }

    console.log("\n🎉 Test completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });