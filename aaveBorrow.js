const { getNamedAccounts, ethers, network } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")
const { networkConfig } = require("../helper-hardhat-config")

async function main() {
    //aave protocol treats everything as ERC20
    // deposit eth into weth contract, receive weth
    await getWeth()

    const { deployer } = await getNamedAccounts()
    //to deposit on aave protocol, need the abi and contract address:
    // LendingPoolAddressProvider
    // mainnet: 0xb53c1a33016b2dc2ff3653530bff1848a515c8c5
    // goerli: 0x5E52dEc931FFb32f609681B8438A51c675cc232d

    // then get LendingPool contract address through LendingPoolAddressProvider contract

    //so grab the lendingPool address returned from the function getLendingPool()
    const lendingPool = await getLendingPool(deployer)
    console.log(`LendingPool Address: ${lendingPool.address}`)
    // address at the time of coding 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9

    // now we want to deposit
    /**
     * In order to be able to deposit if we look at the deposit function from LendingPool contract
     * here: https://github.com/aave/protocol-v2/blob/ice/mainnet-deployment-03-12-2020/contracts/protocol/lendingpool/LendingPool.sol
     *
     * we can see that the deposit function use this in its logic:
     * IERC20(asset).safeTransferFrom(msg.sender, aToken, amount);
     *
     * which is a safeTransferFrom() function call on the ERC20 Interface.
     * Then if we take a look or just remember a bit about ERC20 contract, it has an allowance checker
     * to check if it is approved that this function can pull out funds from a wallet.
     * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
     *
     *
     * - IERC20 interface
     * - Approve AAVE contract (ERC20 Allowance)
     * - Weth Token address
     * -
     */

    // Weth token address
    const wethTokenAddress = networkConfig[network.config.chainId].wethToken
    // const chainID = networkConfig[network.config.chainId]
    // console.log("Chain id is : ", chainID)
    console.log("Weth address is : ", networkConfig[network.config.chainId].wethToken)
    //approve
    //note if approve function is not ran before trying to deposit tokens, an error saying contract not approved is returned

    await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    //console.log("deployer address is : ", deployer)

    // then we can deposit -> lendingPool.deposit(asset, amoount, onBehalfOf, referralCode)
    // referralCode has been discontinued so always be 0
    // onBehalfOf ourselves
    // function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    console.log("Depositing....")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)

    console.log("Deposit done!")

    // borrow against our deposit collateral
    // requires to know:
    // what is our collateral, how much we can borrow and what are we already borrowing
    // lending pool has a getUserAccountData() function that checks those data among all reserves assets

    //const userData = await lendingPool.getUserAccountData(deployer)
    //console.log("User data: ", userData.toString())

    //User data:
    //collateral => 20000000000000000,
    //debt(borrowed) -> 0,
    //borrow amount allowed -> 16500000000000000,
    //liquidation thresold after borrowing -> 8600,
    //loan to value -> 8250,
    //health factor -> 115792089237316195423570985008687907853269984665640564039457584007913129639935

    //note
    // getUserAccountData() coupled to liquidationCall() on a bot can be a killer

    //put this in a function and Borrowed amount and available borrowing amount values
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

    // know how much we can borrow of another asset
    // which requires a price convertion rate to be known for knowing how much is possible to be borrowed
    // so let say for DAI -> make a function to get Dai pricefeed -> need aggregatorV3Interface.sol
    const daiPrice = await getDaiPrice()

    //calculate amount possible to borrow. (set to 95% of what we can borrow)
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log(`DAI possible to borrow: $ ${amountDaiToBorrow}`)
    //amount to wei
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())

    // function to borrow dai using the available borrow amount that we can
    //function borrow(address asset,uint256 amount,uint256 interestRateMode,uint16 referralCode,address onBehalfOf) external;
    // interest mode -> 1 = stable, 2 = variable
    const daiTokenAddress = networkConfig[network.config.chainId].daiToken
    await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)
    // check user data change
    await getBorrowUserData(lendingPool, deployer)

    //now let repay some or all of what we borrowed
    //function repay(address asset,uint256 amount,uint256 rateMode,address onBehalfOf) external returns (uint256);
    // note there is an approval to use the token for repayment in the repay function
    console.log("Repayment in progress...")
    await repay(daiTokenAddress, amountDaiToBorrowWei, lendingPool, deployer)
    // check user data change
    await getBorrowUserData(lendingPool, deployer)
}

// function to get LendingPool contract address through LendingPoolAddressProvider contract
// interface or abi can directly be found on aave or their repo
// pass account as parameter (deployer)
async function getLendingPool(account) {
    //lending pool address
    const lendingAddress = networkConfig[network.config.chainId].lendingPoolAddressesProvider

    // connect our provider to lendingPooladdressesProvider
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        lendingAddress,
        account
    )

    //get LendingPool address
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()

    // use the interface of ILendingPool.sol for ABI, lendingPoolAddress variable that owns the contract address for the address
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)

    // return the LendingPool contract on lendingPool variable
    return lendingPool
}

// function to approve ERC20, Allowance for contracts.
// requiring as parameters the contract address, and spender addres.
// so aave contract using deposit function and our wallet
/**
 * So it goes like this:
 * @param WETH token address = erc20Address
 * @param LendingPool contract address = spenderAddress -> giving the right to spend our fund to this contract
 * @param {*} amountToSpend
 * @param {*} signer -> deployer
 */
async function approveERC20(erc20Address, spenderAddress, amountToSpend, signer) {
    console.log(`Approving Contract... ${erc20Address}`)

    const ERC20Contract = await ethers.getContractAt("IERC20", erc20Address, signer)

    console.log("in process...")
    //approve
    const tx = await ERC20Contract.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("Contract Approved!")
}

//borrow function, first know about collateral, deposit, loan to value, health factor
// how much can be borrowed and what is already borrowed

async function getBorrowUserData(lendingPool, account) {
    //to get all values
    //const userData = await lendingPool.getUserAccountData(deployer)

    //for specific values
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`ETH Deposit: ${totalCollateralETH} Eth`)
    console.log(`ETH Borrowed: ${totalDebtETH} Eth`)
    console.log(`Available Borrow amount: ${availableBorrowsETH} Eth`)
    return { totalDebtETH, availableBorrowsETH }
}

async function getDaiPrice() {
    const daiFeed = networkConfig[network.config.chainId].daiEthPriceFeed
    const daiEthPriceFeed = await ethers.getContractAt("AggregatorV3Interface", daiFeed)
    //just reading function no need to sign, so no deployer required

    //return last price at first index
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`DAI/ETH price is: for $1 of DAI you get 0.00${price.toString()} ETH`)
    return price
}

// function to borrow dai, needs dai address, lending pool contract address, amount available to borrow, account
//function borrow(address asset,uint256 amount,uint256 interestRateMode,uint16 referralCode,address onBehalfOf) external;
// interest mode -> 1 = stable, 2 = variable
async function borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log(`You borrowed: ${amountDaiToBorrowWei} Dai`)
}

//function to repay
//function repay(address asset,uint256 amount,uint256 rateMode,address onBehalfOf) external returns (uint256);
async function repay(daiAddress, amountToRepay, lendingPool, account) {
    // before being able to repay, we need actually to approve the contract to grab our dai token for then making a repayment after.
    // need to allow that it can touch our funds
    await approveERC20(daiAddress, lendingPool, amountToRepay, account)

    const repayTx = await lendingPool.repay(daiAddress, amountToRepay, lendingPool, 1, account)
    await repayTx.wait(1)
    console.log(`You repaid: ${amountToRepay} Dai`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
