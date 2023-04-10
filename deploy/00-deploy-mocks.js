const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
//Coordinator parameters
const BASE_FEE = "250000000000000000" // premium cost fee for interacting in Link
const GAS_PRICE_LINK = 1e9 //1power9 calculated value based on the gas price of the chain

//mock deploy
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    /*if network is testnet or not deploy mock*/
    //const chainId = network.config.chainId
    //log("chainId is ", chainId)
    //if (chainId == 31337) {
    //or use this returning true or false if devlopment chains
    log("dev chain is ", developmentChains.includes(network.name))
    if (developmentChains.includes(network.name)) {
        log("local network detected. preparing mock....")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("Mock deployed")
        log("----------------------")
    }
    log("not development chain")
}

module.exports.tags = ["all", "mocks"]
