import { AdminClient } from "@indid/indid-admin-sdk";
import { Client, UserOperationBuilder } from "@indid/indid-core-sdk";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.INDID_PUB_APIKEY!;
const adminApiKey = process.env.INDID_ADMIN_KEY!;
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

// this function leverage the permission level of admin client to ask sponsorship - it should be placed on the backend side
async function sponsorOperation(operation: UserOperationBuilder) : Promise<string> {
  const adminClient = await AdminClient.init(rpcUrl, adminApiKey);
  const {error, paymasterAndData} =  await adminClient.getUserOpSponsorship(operation);
  return paymasterAndData;
}

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

  /**
   * smart accounts are deployed automatically when you send your first operation
   */

  const {initCode, error} = await clientUser.getInitCode();

  const userop = await clientUser.prepareSendETH(
    accountAddress,
    ethers.utils.parseEther("0"),
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
