import { Client } from "../../packages/indid-core/dist";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.INDID_PUB_APIKEY!;
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

async function run() {
  const clientUser = await Client.init(rpcUrl, coreApiKey);

  // generate a new wallet
  const wallet = privKey? new ethers.Wallet(privKey) : ethers.Wallet.createRandom();

  // get smart account address
  const {accountAddress} = await clientUser.getCounterfactualAddress(
    wallet.address
  );
  console.log(
    "accountAddress returned from sdk",
    accountAddress
  );

  // connect smart account
  clientUser.connectAccount(wallet, accountAddress);


  // wait until address has balance greater than 0 - you can send money
  while ((await provider.getBalance(accountAddress)).isZero()) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log("waiting for balance to be greater than 0");
  }

  /**
   * smart accounts are deployed automatically when you send your first operation
   */

  const {initCode, error} = await clientUser.getInitCode();

  const userop = await clientUser.prepareSendETH(
    accountAddress,
    ethers.utils.parseEther("0.001"),
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
