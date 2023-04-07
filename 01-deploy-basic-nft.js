const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    log("get accounts...")
    const { deployer } = await getNamedAccounts()

    log("-----------")

    //constructor doesnt require any parameter, keep args blank
    arguments = []
    const basicNft = await deploy("BasicNft", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    // if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    //     log("verifying...")
    //     await verify(basicNft.address, arguments)
    //     log("-----------")
    // }
}

module.exports.tags = ["all", "Basicnft", "main"]
