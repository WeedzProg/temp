const pinataSDK = require("@pinata/sdk")
const path = require("path")
const fs = require("fs")
require("dotenv").config()

const pinataApiKey = process.env.UPLOAD_TO_PINATA
const pinataApiSecret = process.env.PINATA_SECRET
const pinata = pinataSDK(pinataApiKey, pinataApiSecret)

async function storeImages(imagesFilePath) {
    //get the full path of the images
    const fullImagesPath = path.resolve(imagesFilePath)

    //read entire directory to get those files
    const files = fs.readdirSync(fullImagesPath)
    // test output
    //console.log(files)
    //output -> [ 'pug.png', 'shiba-inu.png', 'st-bernard.png' ]

    // array of responses
    let responses = []
    console.log("uploading to Pinata...")
    for (fileIndex in files) {
        console.log(`Working on index ${files[fileIndex]}.....`)
        // create a readStream of a file at the selected path
        // since it is an image file it doesnt work exactly the same as "push this data"
        // the stream of those images here, is all the bytes and data behind each pixels
        const readableStreamForFile = fs.createReadStream(`${fullImagesPath}/${files[fileIndex]}`)
        try {
            // pin files to ipfs
            const response = await pinata.pinFileToIPFS(readableStreamForFile)
            responses.push(response)
        } catch (error) {
            console.log(error)
        }
    }
    // at last return responses and files
    return { responses, files }
}

// function for storing json metadata to ipfs / pinata
async function storeTokenUriMetadata(metadata) {
    try {
        //takes a bode -> json file
        // and an option
        const response = await pinata.pinJSONToIPFS(metadata)
        return response
    } catch (error) {
        console.log(error)
    }
    return null
}

module.exports = { storeImages, storeTokenUriMetadata }
