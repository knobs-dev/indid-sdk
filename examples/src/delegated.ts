// import { AdminClient } from '@indid/indid-admin-sdk'
import { AdminClient, IndidSigner, IndidAddress } from "../../packages/indid-admin";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const chainId = process.env.CHAIN_ID!;
const rpcUrl = process.env.RPC_URL!;
const coreApiKey = process.env.INDID_ADMIN_KEY!;
const privKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const friendAddress = process.env.FRIEND_ADDRESS!;

async function run() {
  const clientUser = await AdminClient.init({chainId: chainId, apiKey: coreApiKey});

  // generate a new wallet
  const wallet = privKey? new ethers.Wallet(privKey) : ethers.Wallet.createRandom();
  
  // Create an IndidSigner from the wallet's private key
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

  const send0 = {
    to: friendAddress,
    value: 1,
    data: "0x"
  }

  const resp = await clientUser.sendDelegatedTransactions([send0], { deadlineSeconds: 100000000 });
  console.log("send delegated transactions response", resp);

  const taskResp = await clientUser.waitTask(resp.taskId);
  console.log("task response", taskResp);

}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
  });
