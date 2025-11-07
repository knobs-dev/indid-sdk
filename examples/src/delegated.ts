// import { AdminClient } from '@indid/indid-admin-sdk'
import { AdminClient, IndidSigner, LogLevel } from "../../packages/indid-admin/";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const backendUrl = process.env.BACKEND_URL!;
// const coreApiKey = process.env.SHARED_ADMIN_KEY!;
const coreApiKey = process.env.INDID_ADMIN_KEY!;
const privKey = process.env.PRIVATE_KEY;
const guardianPrivKey = process.env.GUARDIAN_PRIVATE_KEY!;


async function run() {
  const clientUser = await AdminClient.init({
    rpcUrl: rpcUrl,
    apiKey: coreApiKey,
    overrideBackendUrl: backendUrl,
    logLevel: LogLevel.DEBUG
  });

  // generate a new wallet
  const wallet = new ethers.Wallet(privKey!);

  // create an indid signer from the wallet
  const indidSigner = IndidSigner.fromSecp256k1(wallet.privateKey);

  const guardianSigner = IndidSigner.fromSecp256k1(guardianPrivKey);

  console.log("indidSigner", await indidSigner.getIndidAddress());

  const salt = BigInt(ethers.hexlify(ethers.randomBytes(32))).toString();

  // get smart account address
  const { accountAddress: counterfactualAddress } = await clientUser.getCounterfactualAddress(
    [await indidSigner.getIndidAddress()],
    salt,
    {
      guardians: [await guardianSigner.getIndidAddress()]
    }
  );
  console.log(
    "counterfactualAddress returned from sdk",
    counterfactualAddress
  );


  const { error, accountAddress } = await clientUser.createAndConnectAccount(
    indidSigner, 
    salt, 
    undefined, 
    { guardians: [await guardianSigner.getIndidAddress()]}
  );
  if (error) {
    console.error(error);
    return;
  }
  console.log("accountAddress after createAndConnectAccount", accountAddress);


  const tx = await clientUser.sendDelegatedTransactions([
    {
      to: wallet.address,
      value: ethers.parseEther("0"),
      data: "0x"
    }
  ]);

  const taskResult = await clientUser.waitTask(tx.taskId);

  console.log("task completed", taskResult);


}

run()
  .then(() => { })
  .catch((e) => {
    console.error(e);
  });
