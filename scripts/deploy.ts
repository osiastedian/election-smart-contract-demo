import { ethers } from "hardhat";

async function main() {
  const [owner, candidate1, candidate2] = await ethers.getSigners();
  const candidates = await Promise.all([candidate1.getAddress(), candidate2.getAddress()]);
  const Election = await ethers.getContractFactory("Election");
  const election = await Election.deploy(candidates, ethers.utils.parseEther('1'));

  await election.deployed();

  console.log(
    `Election with candidates [${candidates.join()}] deployed to ${election.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
