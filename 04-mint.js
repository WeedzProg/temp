const { ethers, network, deployments } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

module.exports = async function ({ getNamedAccounts }) {
    const { deployer } = await getNamedAccounts()
    const { log } = deployments
    //mint BasicNft
    const basicNft = await ethers.getContract("BasicNft", deployer)
    const basicMintTx = await basicNft.mintNft()
    await basicMintTx.wait(1)
    log(`Basic NFT minted, Index 0 Token URI: ${await basicNft.tokenURI(0)}`)

    //mint dynamic onchain NFT
    const highValue = ethers.utils.parseEther("1700")
    const dynamicNft = await ethers.getContract("DynamicSvgNft", deployer)
    const dynamicMint = await dynamicNft.mintNft(highValue)
    await dynamicMint.wait(1)
    log(`Dynamic NFT minted at 0 index token URI, ${await dynamicNft.tokenURI(0)}`)

    // mint random nft hosted on IPFS
    const randomNft = await ethers.getContract("RandomIpfsNft", deployer)
    log("Random Contract address: ", randomNft.address)
    const mintFee = await randomNft.getMintFee()
    log("Minting fee is: ", mintFee.toString())
    const randomMintTx = await randomNft.requestNft({ value: mintFee.toString() })
    log("randomMintTx: ", randomMintTx)
    const randomMintTxReceipt = await randomMintTx.wait(1)
    log("randomMintTxReceipt: ", randomMintTxReceipt)
    log("deployed")
    const chainId = network.config.chainId
    //like in the test of random nft, we need to await a new promise to listen for event and return a promise, randomness event
    await new Promise(async (resolve, reject) => {
        setTimeout(() => reject("Timeout: 'NftMinted' event did not fire"), 10000) //300000 5 minute timeout time
        randomNft.once("NftMinted", async () => {
            log(`Random NFT minted at 0 index token URI, ${await randomNft.tokenURI(0)}`)
            resolve()
        })

        //if (developmentChains.includes(network.name)) {
        if (chainId == 31337) {
            const requestId = randomMintTxReceipt.events[1].args.requestId.toString()

            //get mock
            const vrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            await vrfCoordinatorV2.fulfillRandomWords(requestId, randomNft.address)
        }
    })
}
module.exports.tags = ["all", "mint"]
