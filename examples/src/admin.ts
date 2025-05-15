// import { AdminClient } from '@indid/indid-admin-sdk'
import { AdminClient, IndidSigner, LogLevel, SignerKind } from "../../packages/indid-admin";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.INDID_ADMIN_KEY!;
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);

async function run() {
  const clientUser = await AdminClient.init({
    rpcUrl: rpcUrl,
    apiKey: coreApiKey, 
    // overrideBackendUrl: "https://api.dev.indid.io/v2",
    overrideBackendUrl: "https://5d36-79-37-246-111.ngrok-free.app/v2",
    logLevel: LogLevel.DEBUG
  });

  // generate a new wallet
  const wallet = privKey ? new ethers.Wallet(privKey) : ethers.Wallet.createRandom();

  // create an indid signer from the wallet
  console.log("wallet.privateKey", wallet.privateKey);
  const indidSigner = IndidSigner.fromSecp256k1(wallet.privateKey);

  console.log("indidSigner", await indidSigner.getIndidAddress());

  // get smart account address
  const { accountAddress: accountAddress2 } = await clientUser.getCounterfactualAddress(
    [await indidSigner.getIndidAddress()]
  );
  console.log(
    "accountAddress returned from sdk",
    accountAddress2
  );

  // connect and deploy smart account
  // const { error, accountAddress: address } = await clientUser.createAndConnectAccount(indidSigner, "1");

  // if (error) {
  //   console.error(error);
  //   return;
  // }

  // console.log("accountAddress after createAndConnectAccount", address);


  // // wait until address has balance greater than 0
  // while (await provider.getBalance(accountAddress) === 0n) {
  //   await new Promise((resolve) => setTimeout(resolve, 10000));
  //   console.log("waiting for balance to be greater than 0");
  // }
  const accountAddress = "0xe56aaf33cc22c39337c5d75f0b48f966f87e6999"
  const { error: err } = await clientUser.connectAccount(indidSigner, accountAddress);
  if (err) {
    console.error(err);
    return;
  }

  const userop = await clientUser.prepareSendETH(
    wallet.address,
    ethers.parseEther("0.000"),
  );

  // send the operation
  await clientUser.signUserOperation(userop)

  const tx = await clientUser.sendUserOperation(userop);

  await clientUser.waitTask(tx.taskId);

  console.log("task completed");
}

run()
  .then(() => { })
  .catch((e) => {
    console.error(e);
  });
