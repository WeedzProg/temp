const { network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")

/**upload by hand and initialize token uri's to use them in an array. or use Pinata or nft.storage
 * it is always good to have at least:
 * 1- data on our own node
 * 2- having someone pinning our data:
 *    1- easiest way programmaticaly is pinata
 * or
 * 2.1- having an entire decentralized network pinning the data:
 *    1- nft.storage
 */
//
// let tokenUris = [
//     "ipfs://QmaVkBn2tKmjbhphU7eyztbvSQU5EXDdqRyXZtRhSGgJGo",
//     "ipfs://QmYQC5aGZu2PTH8XzbJrbDnvhj3gVs7ya33H9mqUNvST3d",
//     "ipfs://QmZYmH5iDbD6v3U2ixoVAjioSzvWJszDzYdbeCLquGSpVm",
// ]
//
// corresponding images
//
// const imageUris = [
//     "ipfs://QmSsYRx3LpDAb1GZQm7zZ1AuHZjfbPkD6J7s9r41xu1mf8",
//     "ipfs://QmYx6GsYAKnNzZ9A6NvEKV9nf1VaDzJrqDR23Y8YSkebLU",
//     "ipfs://QmUPjADFGEKmfohdTaNcWhp7VGk26h5jXDA7v3VtTnTLcW",
// ]

const imagesLocation = "./images/randomNft"

//metadata
const metadataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "Cuteness",
            value: 100,
        },
    ],
}

// get the IPFS hashes of images
let tokenUris = [
    "ipfs://QmdUeToQJoyKyCXiWg1ZgW2JT1gENKLyabkuFWdkqKE7QH",
    "ipfs://QmaR5dnWm7CGjG6SdC6YxouKV4fzfe9A4cvCE16dE2hciA",
    "ipfs://QmVHcqXfNiguU56yset6wGzh3Q5hX7nenMbkpKfU27H5jz",
]

//fund subscription amount
const FUND_AMOUNT = "1000000000000000000000" // or ethers.parse

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    log("get accounts...")
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    if (process.env.IPFS_UPLOADED == "true") {
        tokenUris = await handleTokenUris()
    }

    log("----- Checking chain Id ------")

    let vrfCoordinatorV2Address, subscriptionId
    if (developmentChains.includes(network.name)) {
        log("----- use VRF mocks ------")
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const tx = await vrfCoordinatorV2Mock.createSubscription()
        const txReceipt = await tx.wait(1)

        subscriptionId = txReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        log("----- No need of mocks, testnet network ------")
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }
    log("----- Preparing args and retrieving necessary images ------")

    const gasLane = networkConfig[chainId].gasLane
    const callbackGasLimit = networkConfig[chainId].callbackGasLimit
    const mintFee = networkConfig[chainId].mintFee

    //test of storeImages function.
    // to have it working without errors , comment the args array in all
    //await storeImages(imagesLocation)

    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        gasLane,
        callbackGasLimit,
        tokenUris,
        mintFee,
    ]

    // deploy
    const randomIpfsNft = await deploy("RandomIpfsNft", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log("----- Contract deployed ------")

    // if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    //     log("verifying...")
    //     await verify(randomIpfsNft.address, args)
    //     log("-----------")
    // }
}

//handleTokenUris function, handles uploads to pinata
async function handleTokenUris() {
    tokenUris = []
    // storing images and metadata
    // grab the list of responses after images upload ran
    const { responses: imageUploadResponses, files } = await storeImages(imagesLocation)
    //loop through the list to upload each metadata
    for (imageUploadResponsesIndex in imageUploadResponses) {
        //create metadata
        // upload the metadata
        //syntatic sugar meaning "unpack", but basically it means A=B
        let tokenUriMetadata = { ...metadataTemplate }
        // drop the extension to keep just the name
        tokenUriMetadata.name = files[imageUploadResponsesIndex].replace(".png", "")
        tokenUriMetadata.description = `An addorable ${tokenUriMetadata.name} puppie!`
        //ipfs hash that we get on responses
        tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponsesIndex].IpfsHash}`
        console.log(`Uploading metadata ${tokenUriMetadata.name}...`)
        //store the json file of the metadata to ipfs / pinata
        const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
        // then now we have the token uri that we need
        tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }
    console.log("Token URIs Uploaded! They are ")
    console.log(tokenUris)
    return tokenUris
}

module.exports.tags = ["all", "randomIpfs", "main"]
