// import { Client } from "@indid/indid-core-sdk";
import { Client, IndidSigner } from "../../packages/indid-core";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.INDID_PUB_APIKEY!;
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);

async function run() {
  const clientUser = await Client.init({rpcUrl: rpcUrl, apiKey: coreApiKey});

  // generate a new wallet
  const wallet = privKey? new ethers.Wallet(privKey) : ethers.Wallet.createRandom();
  
  // create an indid signer from the wallet
  const indidSigner = IndidSigner.fromSecp256k1(wallet.privateKey);

  // get smart account address
  const {accountAddress} = await clientUser.getCounterfactualAddress(
    [await indidSigner.getIndidAddress()]
  );
  console.log(
    "accountAddress returned from sdk",
    accountAddress
  );

  // connect smart account
  clientUser.connectAccount(indidSigner, accountAddress);


  // wait until address has balance greater than 0 - you can send money
  while (await provider.getBalance(accountAddress) === 0n) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log("waiting for balance to be greater than 0");
  }

  /**
   * smart accounts are deployed automatically when you send your first operation
   */

  const {initCode, error} = await clientUser.getInitCode();

  if (error) {
    console.error("error", error);
    return;
  }

  const userop = await clientUser.prepareSendETH(
    accountAddress,
    ethers.parseEther("0.001"),
    {
      initCode: initCode,
    }
  );

  // send the operation
  await clientUser.signUserOperation(userop)

  const tx = await clientUser.sendUserOperation(userop);

  await clientUser.waitTask(tx.taskId);

  console.log("task completed");
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
  });
