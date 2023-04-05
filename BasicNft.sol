//SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

//import erc721 contract from openZeppelin library
import "../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";

//inheritance
contract BasicNft is ERC721 {
    //tokenId
    uint256 private s_tokenCounter;

    // token URI metadata
    string public constant TOKEN_URI =
        "ipfs://bafybeig37ioir76s7mg5oobetncojcm3c3hxasyd4rvid4jqhy4gkaheg4/?filename=0-PUG.json";

    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection. on the constructor of ERC721 contract
     */
    constructor() ERC721("Dogie", "DOG") {
        //In order to create new DOG we need a mint function that will use an URI and a TokenId
        //set the token Id s_tokenCounter to 0
        s_tokenCounter = 0;
    }

    // minting function that use the safeMint function of ERC721
    // it use an address to send it to when minted and a tokenId  which is like the index number of the NFT of from this smart contract
    function mintNft() public returns (uint256) {
        _safeMint(msg.sender, s_tokenCounter);
        //increment +1 at each mint and return the new tokenId
        s_tokenCounter = s_tokenCounter + 1;
        return s_tokenCounter;
    }

    // basically just with s_tokenCounter and its view and mint function we have an NFT contract
    // there is jsut no metadata and no visual. to have those we need to make the tokenURI function
    // to which we pass all necessary information to create a metadata and link and image
    // the image that we are gonna use is hosted on IPFS at:
    // https://ipfs.io/ipfs/QmSsYRx3LpDAb1GZQm7zZ1AuHZjfbPkD6J7s9r41xu1mf8?filename=pug.png

    // override tokenURI function from 721 as we don't need to use the whole function structure from there
    function tokenURI(uint256 /*tokenId*/) public pure override returns (string memory) {
        // require(_exists(tokenId))
        return TOKEN_URI;
    }

    // VIEW FUNCTIONS
    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }
}
