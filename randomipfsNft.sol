// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// import chainlink library
import "../node_modules/@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "../node_modules/@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

//import erc721 contract from openZeppelin library
//import "../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";

// to be able to use the setTokenURI function we need to use the ERC721 contract that has
// that extension called ERC721URIStorage
// note that its not the most gas efficient but it comes with new functionality
import "../node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// control access, only owners
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

//error to revert Breed selection not going well
error RandomIpfsNft__RangeOutOfBounds();
// revert if less than mint fee
error RandomIpfsNft__NeedMoreETHSent();
// revert withdrawing if not success
error RandomIpfsNft__TransfertFailed();

contract RandomIpfsNft is VRFConsumerBaseV2, ERC721URIStorage, Ownable {
    /**
     * when minting NFT, trigger a chainlink VRF to get a random number
     * from which we get a random NFT
     * Pug, Shiba or St Bernard
     * ------------------
     * With different rarity:
     * pug = super rare
     * shiba = rare
     * St Bernard = common
     * ------------------
     * Users have to pay to mint an NFT,
     * then owner of the contract can withdraw the ETH for payment
     */

    //Type declaration
    // Breed from percent of chance
    enum Breed {
        PUG,
        SHIBA_INU,
        ST_BERNARD
    }

    // constructor variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint16 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;

    //vrf helper
    //mapping between the adress and the requestId to linked it to be the owner of the NFT at minting
    // to avoid the chainlink node calling on fulfillRandomWors to be the owner, as when we request the requestId it happens in 2 transactions
    mapping(uint256 => address) public s_requestIdToSender;

    //NFT helper
    //tokenId
    uint256 private s_tokenCounter;
    // max chance value
    uint256 internal constant MAX_CHANCE_VALUE = 100;
    // create an array to update IPFS
    string[] internal s_dogTokenUris;
    //mint fee
    uint256 internal immutable i_mintFee;

    //Events
    event NftRequested(uint256 indexed requestId, address requester);
    event NftMinted(Breed dogBreed, address minter);

    //constructor using VRF and ERC721 constructors
    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane,
        uint16 callbackGasLimit,
        string[3] memory dogTokenUris,
        uint256 mintFee
    ) VRFConsumerBaseV2(vrfCoordinatorV2) ERC721("Random IPFS NFT", "RIN") {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_subscriptionId = subscriptionId;
        i_gasLane = gasLane;
        i_callbackGasLimit = callbackGasLimit;
        s_dogTokenUris = dogTokenUris;
        i_mintFee = mintFee;
    }

    // the address that request the number will be map to be the adress that mint the nft to be the owner of it
    // to not be unproperly attributed to another adress
    // make it payable to users
    function requestNft() public payable returns (uint256 requestId) {
        if (msg.value < i_mintFee) {
            revert RandomIpfsNft__NeedMoreETHSent();
        }
        requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        // when requestNft is called, it will set the requestIdToSender of the requested random number to be the caller of the request
        s_requestIdToSender[requestId] = msg.sender;

        emit NftRequested(requestId, msg.sender);
    }

    //withdrawing the nft for owner only through Ownable.sol onlyOwner function
    function withdraw() public onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert RandomIpfsNft__TransfertFailed();
        }
    }

    // get the random number
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        //when chainlink node response to the request,
        // we set the caller of the requestId / requestNFT to be the owner of the NFT
        address dogOwner = s_requestIdToSender[requestId];

        //tokenId update
        uint256 newTokenId = s_tokenCounter;

        // use any random number we get modulo max chance of rarity
        uint256 moddedRng = randomWords[0] % MAX_CHANCE_VALUE;
        // result between 0 and 99
        // 7 -> PUG
        // 12 -> Shiba
        // 88 -> St Bernard
        // 45 -> St Bernard
        Breed dogBreed = getBreedFromModdedRng(moddedRng);

        //then mint

        _safeMint(dogOwner, newTokenId);
        //update token counter
        s_tokenCounter = s_tokenCounter + 1;
        //s_tokenCounter += s_tokenCounter;
        // set URI to a new tokenId based on the array we created of memory 3
        // using its index version in uint256 of dogBreed
        _setTokenURI(newTokenId, s_dogTokenUris[uint256(dogBreed)]);

        emit NftMinted(dogBreed, dogOwner);
    }

    // attributes dogs to a percent
    function getBreedFromModdedRng(uint256 moddedRng) private pure returns (Breed) {
        /**
         * let say moddedRng = 25
         * cumulativesSum = 0
         * i = 0
         * --------------
         * first loop i = 10, 2nd loop i = 30, 3rd loop i = 100
         * --------------
         * so first time cumulativesSum = 0, cumulativesSum + chanceArray[i] = 0 + 10
         * at the end of the loop, cumulativesSum += 10
         * --------------
         * 2nd time, cumulativesSum = 10 , then 10 + 30, at the end 10 += 30 => 40
         * --------------
         * 3rd time, 40, then 40 + 100 -> 140, then 40 += 100 -> 140
         * --------------
         * --------------
         * so if moddedRng is superior or equal to cumulativesSum and inferior to cumulativesSum + chanceArray
         * it returns breed[i], else it increments.
         * --------------
         * first time 25 is superior but not inferior to the additional sum so it loop a second time
         * second time 25 is superior than 10, and inferior than additional sum 40 -> both true, result is breed[1] -> Shiba
         */

        uint256 cumulativesSum = 0;
        uint[3] memory chanceArray = getChanceArray();
        for (uint256 i = 0; i < chanceArray.length; i++) {
            if (moddedRng >= cumulativesSum && moddedRng < cumulativesSum + chanceArray[i]) {
                return Breed(i);
            }
            cumulativesSum += chanceArray[i];
        }

        // and in case if for some weird reasons it doesnt return a breed, revert
        revert RandomIpfsNft__RangeOutOfBounds();
    }

    // chance array, which will decide the chance of getting one of the 3 dogs
    // returning an uint256 of size 3 in memory
    function getChanceArray() public pure returns (uint256[3] memory) {
        //which set the index array 0 to 10% chance, index 1 to 20% as it will be 30 - 10, and index 2 to 60% -> 100 - (30 + 10) = 60
        // so pub -> 10%
        // shiba -> 20%
        // st bernard -> 60%
        return [10, 30, MAX_CHANCE_VALUE];
    }

    //mint fee view
    function getMintFee() public view returns (uint256) {
        return i_mintFee;
    }

    // function tokenUri view
    function getDogTokenUris(uint256 index) public view returns (string memory) {
        return s_dogTokenUris[index];
    }

    // view token counter
    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }

    // doesnt need this function anymore since when we call setTokenUri function it will set one automatically
    // and ERC721URIStorage contract already have that function integrated
    //function tokenURI(uint256) public view override returns (string memory) {}
}
