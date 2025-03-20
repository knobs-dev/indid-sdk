// import { AdminClient } from '@indid/indid-admin-sdk'
import { AdminClient, IndidSigner } from "../../packages/indid-admin";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.INDID_ADMIN_KEY!;
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);

async function run() {
  const clientUser = await AdminClient.init({rpcUrl: rpcUrl, apiKey: coreApiKey});

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

  // connect and deploy smart account
  const { error, accountAddress: address } = await clientUser.createAndConnectAccount(indidSigner);

  if(error) {
    console.error(error);
    return;
  }
 

  // wait until address has balance greater than 0
  while (await provider.getBalance(accountAddress) === 0n) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log("waiting for balance to be greater than 0");
  }

  const userop = await clientUser.prepareSendETH(
    accountAddress,
    ethers.parseEther("0.001"),
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
