import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Election", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const [owner, candidate1, candidate2, voter1, voter2, voter3] =
      await ethers.getSigners();

    const ElectionContract = await ethers.getContractFactory("Election");

    const election = await ElectionContract.deploy(
      [candidate1.getAddress(), candidate2.getAddress()],
      ethers.utils.parseEther("1.0")
    );

    return {
      election,
      participants: { owner, candidate1, candidate2, voter1, voter2, voter3 },
    };
  }

  describe("Deployment", function () {
    it("Should register candidates ", async function () {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );
      const isCandidate1Registered = election.candidates(
        participants.candidate1.getAddress()
      );
      const isCandidate2Registered = election.candidates(
        participants.candidate2.getAddress()
      );

      expect(await isCandidate1Registered).to.equal(true);
      expect(await isCandidate2Registered).to.equal(true);
    });

    it("Should set the right registrationFee", async function () {
      const { election } = await loadFixture(deployOneYearLockFixture);

      expect(await election.registrationFee()).to.equal(
        ethers.utils.parseEther("1")
      );
    });
  });

  describe("Registration", function () {
    it("should be able to register", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );

      const electionAsVoter1 = election.connect(participants.voter1);
      const registrationFee = await election.registrationFee();
      const transaction = await electionAsVoter1.register({
        value: registrationFee,
      });
      const voter1Address = await participants.voter1.getAddress();
      expect(transaction)
        .to.emit(electionAsVoter1, "VoterRegistered")
        .withArgs(voter1Address);
    });

    it("should be able to register if fee insufficient", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );
      const electionAsVoter1 = election.connect(participants.voter1);
      await expect(
        electionAsVoter1.register({
          value: ethers.utils.parseEther("0.9"),
        })
      ).to.be.revertedWith("Not enough amount for registration fee.");
    });

    it("should not be able too register if voter has already registered", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );

      const electionAsVoter1 = election.connect(participants.voter1);
      const registrationFee = await election.registrationFee();
      await electionAsVoter1.register({
        value: registrationFee,
      });
      await expect(
        electionAsVoter1.register({
          value: registrationFee,
        })
      ).to.be.revertedWith("Voter is already registered.");
    });
  });

  describe("Vote", () => {
    it("should be able to votes", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );
      const registrationFee = await election.registrationFee();

      const electionAsVote1 = election.connect(participants.voter1);
      const electionAsVote2 = election.connect(participants.voter2);
      const electionAsVote3 = election.connect(participants.voter3);

      await electionAsVote1.register({ value: registrationFee });
      await electionAsVote2.register({ value: registrationFee });
      await electionAsVote3.register({ value: registrationFee });

      const candidate1Address = await participants.candidate1.getAddress();
      const candidate2Address = await participants.candidate2.getAddress();

      const vote1 = await electionAsVote1.vote(candidate1Address);
      const vote2 = await electionAsVote2.vote(candidate1Address);
      const vote3 = await electionAsVote3.vote(candidate2Address);

      const voter1Address = await participants.voter1.getAddress();
      const voter2Address = await participants.voter2.getAddress();
      const voter3Address = await participants.voter3.getAddress();

      expect(vote1)
        .to.emit(election, "VoteSubmitted")
        .withArgs(candidate1Address, voter1Address);

      expect(vote2)
        .to.emit(election, "VoteSubmitted")
        .withArgs(candidate1Address, voter2Address);

      expect(vote3)
        .to.emit(election, "VoteSubmitted")
        .withArgs(candidate2Address, voter3Address);

      const candidate1Votes = await election.votes(candidate1Address);
      const candidate2Votes = await election.votes(candidate2Address);
      expect(candidate1Votes.toNumber()).to.be.eq(2);
      expect(candidate2Votes.toNumber()).to.be.eq(1);
    });

    it("should not allow vote if voter is not registered", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );

      const electionAsVote1 = election.connect(participants.voter1);

      const candidate1Address = await participants.candidate1.getAddress();

      await expect(electionAsVote1.vote(candidate1Address)).to.be.revertedWith(
        "Voter is not registered"
      );
    });

    it("should not allow vote if candidate is not registered", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );

      const electionAsVote1 = election.connect(participants.voter1);

      const unknownCandidate1Address = await participants.voter2.getAddress();

      const registrationFee = await election.registrationFee();

      await electionAsVote1.register({ value: registrationFee });

      await expect(
        electionAsVote1.vote(unknownCandidate1Address)
      ).to.be.revertedWith("Candidate is not registered");
    });

    it("should not allow vote if voter has already voted", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );

      const electionAsVote1 = election.connect(participants.voter1);

      const candidate1Address = await participants.candidate1.getAddress();

      const registrationFee = await election.registrationFee();

      await electionAsVote1.register({ value: registrationFee });

      await electionAsVote1.vote(candidate1Address);

      await expect(electionAsVote1.vote(candidate1Address)).to.be.revertedWith(
        "Voter has already voted"
      );
    });
  });

  describe("Close", () => {
    it("owner should be able to close the election", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );
      const registrationFee = await election.registrationFee();

      const electionAsVote1 = election.connect(participants.voter1);
      const electionAsVote2 = election.connect(participants.voter2);
      const electionAsVote3 = election.connect(participants.voter3);

      await electionAsVote1.register({ value: registrationFee });
      await electionAsVote2.register({ value: registrationFee });
      await electionAsVote3.register({ value: registrationFee });

      const close = election.close();

      expect(close).to.changeEtherBalance(
        participants.owner,
        registrationFee.mul(ethers.BigNumber.from(3))
      );
      expect(await election.isClosed()).to.be.true;
    });

    it("should not be able to register and vote if election has been closed", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );

      await election.close();
      const registrationFee = await election.registrationFee();

      await expect(
        election
          .connect(participants.voter1)
          .register({ value: registrationFee })
      ).to.be.revertedWith("Election has already closed");

      await expect(
        election
          .connect(participants.voter1)
          .vote(participants.candidate1.getAddress())
      ).to.be.revertedWith("Election has already closed");
    });

    it("owner should be the only one able to close ", async () => {
      const { election, participants } = await loadFixture(
        deployOneYearLockFixture
      );

      await expect(
        election.connect(participants.voter1).close()
      ).to.be.revertedWith("Unauthorized");
      await expect(
        election.connect(participants.candidate1).close()
      ).to.be.revertedWith("Unauthorized");
       expect(
        await election.connect(participants.owner).close()
      ).to.emit(election, 'Closed').withArgs(anyValue);
    });
  });
});
