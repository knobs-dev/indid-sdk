// import { AdminClient } from '@indid/indid-admin-sdk'
import { AdminClient, IndidSigner, LogLevel, SignerKind } from "../../packages/indid-admin/dist";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.SHARED_ADMIN_KEY!
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);

async function run() {
  const clientUser = await AdminClient.init({
    rpcUrl: rpcUrl,
    apiKey: coreApiKey, 
    // overrideBackendUrl: "https://api.dev.indid.io/v2",
    overrideBackendUrl: "https://4f75-79-37-246-111.ngrok-free.app/v2",
    logLevel: LogLevel.DEBUG
  });

  // generate a new wallet
  const wallet = privKey ? new ethers.Wallet(privKey) : ethers.Wallet.createRandom();

  // create an indid signer from the wallet
  console.log("wallet.privateKey", wallet.privateKey);
  const indidSigner = IndidSigner.fromSecp256k1(wallet.privateKey);

  console.log("indidSigner", await indidSigner.getIndidAddress());

  const salt = "400001";

  // get smart account address
  const { accountAddress: accountAddress2 } = await clientUser.getCounterfactualAddress(
    [await indidSigner.getIndidAddress()],
    salt
  );
  console.log(
    "accountAddress returned from sdk",
    accountAddress2
  );

  const initCodeResponse = await clientUser.getInitCode([await indidSigner.getIndidAddress()], salt);
  console.log("initCode", initCodeResponse);

  const { error } = await clientUser.connectAccount(indidSigner, accountAddress2);
  if (error) {
    console.error(error);
    return;
  }


  const userop = await clientUser.prepareSendETH(
    wallet.address,
    ethers.parseEther("0.000"),
    {
      initCode: initCodeResponse.initCode,
    }
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
  // const accountAddress = "0xe56aaf33cc22c39337c5d75f0b48f966f87e6999"
  // const { error: err } = await clientUser.connectAccount(indidSigner, accountAddress);
  // if (err) {
  //   console.error(err);
  //   return;
  // }

  // const userop = await clientUser.prepareSendETH(
  //   wallet.address,
  //   ethers.parseEther("0.000"),
  // );

  const sponsorship = await clientUser.getUserOpSponsorship(userop);
  console.log("sponsorship", sponsorship);

  // send the operation
  await clientUser.signUserOperation(userop)

  const tx = await clientUser.sendUserOperation(userop);

  const taskResult = await clientUser.waitTask(tx.taskId);

  console.log("task completed", taskResult);
  console.log("Task details:", {
    receipt: taskResult.receipt,
    logs: taskResult.receipt ? JSON.stringify(taskResult.receipt, null, 2) : undefined
  });

}

run()
  .then(() => { })
  .catch((e) => {
    console.error(e);
  });
