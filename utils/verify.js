//since it used run, it require hardhat
const { run } = require("hardhat")
//verify function through etherscan
//async function verify(contractAddress, args) {
// var as a function taking parameters using "=>"
// this is a function not assigned to a variable
//verify = async (contractAddress, args) => {
// all 3 are the same in this case
const verify = async (contractAddress, args) => {
    console.log("verifying contract...")

    // try / catch process in case a similar contract has already been verified / avoid some errors
    try {
        // verify task + arguments
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (e) {
        //if verified
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Contract or similar contract is already verified on etherscan.")
        } else {
            console.log(e)
        }
    }
}

module.exports = { verify }
