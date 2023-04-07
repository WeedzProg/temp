const { network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    log("get accounts...")
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    log("----- Checking chain Id ------")

    let vrfCoordinatorV2Address, subscriptionId
    if (developmentChains.includes(network.name)) {
        log("----- use VRF mocks ------")
        const vrfCoordinatorV2Mock = await etherscan.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const tx = await vrfCoordinatorV2Mock.createSubscription()
        const txReceipt = await tx.wait(1)

        subscriptionId = txReceipt.events[0].args.subId
    } else {
        log("----- No need of mocks, testnet network ------")
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }
    log("----- No need of mocks, testnet network ------")

    const gasLane = networkConfig[chainId].gasLane
    const callbackGasLimit = networkConfig[chainId].callbackGasLimit
    const mintFee = networkConfig[chainId].mintFee

    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        gasLane,
        mintFee,
        /*token Uris, */ callbackGasLimit,
    ]
    // if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    //     log("verifying...")
    //     await verify(basicNft.address, arguments)
    //     log("-----------")
    // }
}

module.exports.tags = ["all", "Basicnft", "main"]
