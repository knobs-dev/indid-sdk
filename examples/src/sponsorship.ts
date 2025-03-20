import { AdminClient, IndidSigner } from "../../packages/indid-admin";
import { Client, UserOperationBuilder } from "../../packages/indid-core";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.INDID_PUB_APIKEY!;
const adminApiKey = process.env.INDID_ADMIN_KEY!;
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);

// this function leverage the permission level of admin client to ask sponsorship - it should be placed on the backend side
async function sponsorOperation(operation: UserOperationBuilder) : Promise<string> {
  const adminClient = await AdminClient.init({rpcUrl: rpcUrl, apiKey: adminApiKey});
  const {error, paymasterAndData} =  await adminClient.getUserOpSponsorship(operation);
  return paymasterAndData;
}

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
    ethers.parseEther("0"),
    {
      initCode: initCode,
    }
  );  

  const paymasterAndData = await sponsorOperation(userop as UserOperationBuilder);

  userop.setPaymasterAndData(paymasterAndData)

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
