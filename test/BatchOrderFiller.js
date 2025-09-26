const { expect } = require("@1inch/solidity-utils");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deploySwapTokens } = require("./helpers/fixtures");
const { ether } = require("./helpers/utils");
const {
    buildOrder,
    signOrder,
    buildTakerTraits,
} = require("./helpers/orderUtils");

const toOrderStruct = (order) => ({
    salt: order.salt,
    maker: order.maker,
    receiver: order.receiver,
    makerAsset: order.makerAsset,
    takerAsset: order.takerAsset,
    makingAmount: order.makingAmount,
    takingAmount: order.takingAmount,
    makerTraits: order.makerTraits,
});

describe("BatchOrderFiller", function () {
    async function deployBatchFillerFixture() {
        const [maker, maker2, taker] = await ethers.getSigners();
        const { dai, weth, swap, chainId } = await deploySwapTokens();
        const swapAddress = await swap.getAddress();

        await dai.mint(maker.address, ether("1000"));
        await dai.mint(maker2.address, ether("1000"));
        await dai.connect(maker).approve(swapAddress, ether("1000"));
        await dai.connect(maker2).approve(swapAddress, ether("1000"));

        await weth.connect(taker).deposit({ value: ether("1") });

        const BatchOrderFiller = await ethers.getContractFactory(
            "BatchOrderFiller"
        );
        const batchFiller = await BatchOrderFiller.deploy(swapAddress);
        await batchFiller.waitForDeployment();

        return { dai, weth, swap, chainId, batchFiller, maker, maker2, taker };
    }

    it("fills multiple orders and refunds surplus taker asset", async function () {
        const { dai, weth, swap, chainId, batchFiller, maker, maker2, taker } =
            await loadFixture(deployBatchFillerFixture);
        const swapAddress = await swap.getAddress();
        const makerAsset = await dai.getAddress();
        const takerAsset = await weth.getAddress();

        const order1 = buildOrder({
            maker: maker.address,
            makerAsset,
            takerAsset,
            makingAmount: ether("120"),
            takingAmount: ether("0.1"),
        });
        const order2 = buildOrder({
            maker: maker2.address,
            makerAsset,
            takerAsset,
            makingAmount: ether("80"),
            takingAmount: ether("0.08"),
        });

        const signature1 = await signOrder(order1, chainId, swapAddress, maker);
        const signature2 = await signOrder(
            order2,
            chainId,
            swapAddress,
            maker2
        );
        const { r: r1, yParityAndS: vs1 } = ethers.Signature.from(signature1);
        const { r: r2, yParityAndS: vs2 } = ethers.Signature.from(signature2);

        const takerTraits1 = buildTakerTraits({
            makingAmount: true,
            threshold: order1.takingAmount,
        });
        const takerTraits2 = buildTakerTraits({
            makingAmount: true,
            threshold: order2.takingAmount,
        });

        const buffer1 = ether("0.005");
        const buffer2 = ether("0.004");
        const maxTaking1 = order1.takingAmount + buffer1;
        const maxTaking2 = order2.takingAmount + buffer2;
        const totalMaxTaking = maxTaking1 + maxTaking2;

        const batchAddress = await batchFiller.getAddress();
        await weth.connect(taker).approve(batchAddress, totalMaxTaking);

        const fillData = [
            {
                order: toOrderStruct(order1),
                r: r1,
                vs: vs1,
                amount: order1.makingAmount,
                takerTraits: takerTraits1.traits,
                maxTakingAmount: maxTaking1,
            },
            {
                order: toOrderStruct(order2),
                r: r2,
                vs: vs2,
                amount: order2.makingAmount,
                takerTraits: takerTraits2.traits,
                maxTakingAmount: maxTaking2,
            },
        ];

        const tx = await batchFiller
            .connect(taker)
            .fillBatch(fillData, ethers.ZeroAddress);

        const totalMaking = order1.makingAmount + order2.makingAmount;
        const totalTaking = order1.takingAmount + order2.takingAmount;
        const refund = totalMaxTaking - totalTaking;

        await expect(tx)
            .to.emit(batchFiller, "OrderFilled")
            .withArgs(0, anyValue, order1.makingAmount, order1.takingAmount);
        await expect(tx)
            .to.emit(batchFiller, "OrderFilled")
            .withArgs(1, anyValue, order2.makingAmount, order2.takingAmount);
        await expect(tx)
            .to.emit(batchFiller, "BatchFilled")
            .withArgs(
                taker.address,
                taker.address,
                takerAsset,
                2,
                totalMaking,
                totalTaking,
                refund
            );

        await expect(tx).to.changeTokenBalances(
            dai,
            [taker, maker, maker2],
            [totalMaking, -order1.makingAmount, -order2.makingAmount]
        );
        await expect(tx).to.changeTokenBalances(
            weth,
            [taker, maker, maker2],
            [-totalTaking, order1.takingAmount, order2.takingAmount]
        );
    });

    it("reverts on inconsistent taker asset", async function () {
        const { dai, weth, swap, chainId, batchFiller, maker, maker2, taker } =
            await loadFixture(deployBatchFillerFixture);
        const swapAddress = await swap.getAddress();
        const makerAsset = await dai.getAddress();
        const wethAddress = await weth.getAddress();

        const order1 = buildOrder({
            maker: maker.address,
            makerAsset,
            takerAsset: wethAddress,
            makingAmount: ether("50"),
            takingAmount: ether("0.04"),
        });
        const mismatchOrder = buildOrder({
            maker: maker2.address,
            makerAsset,
            takerAsset: makerAsset,
            makingAmount: ether("40"),
            takingAmount: ether("35"),
        });

        const signature1 = await signOrder(order1, chainId, swapAddress, maker);
        const signature2 = await signOrder(
            mismatchOrder,
            chainId,
            swapAddress,
            maker2
        );
        const { r: r1, yParityAndS: vs1 } = ethers.Signature.from(signature1);
        const { r: r2, yParityAndS: vs2 } = ethers.Signature.from(signature2);

        const takerTraits1 = buildTakerTraits({
            makingAmount: true,
            threshold: order1.takingAmount,
        });
        const takerTraits2 = buildTakerTraits({
            makingAmount: true,
            threshold: mismatchOrder.takingAmount,
        });

        const maxTaking1 = order1.takingAmount;
        const maxTakingMismatch = mismatchOrder.takingAmount;
        const fillData = [
            {
                order: toOrderStruct(order1),
                r: r1,
                vs: vs1,
                amount: order1.makingAmount,
                takerTraits: takerTraits1.traits,
                maxTakingAmount: maxTaking1,
            },
            {
                order: toOrderStruct(mismatchOrder),
                r: r2,
                vs: vs2,
                amount: mismatchOrder.makingAmount,
                takerTraits: takerTraits2.traits,
                maxTakingAmount: maxTakingMismatch,
            },
        ];

        await expect(
            batchFiller.connect(taker).fillBatch(fillData, taker.address)
        ).to.be.revertedWithCustomError(batchFiller, "InconsistentTakerAsset");
    });

    it("reverts on empty batch", async function () {
        const { batchFiller, taker } = await loadFixture(
            deployBatchFillerFixture
        );

        await expect(
            batchFiller.connect(taker).fillBatch([], taker.address)
        ).to.be.revertedWithCustomError(batchFiller, "EmptyBatch");
    });
});
