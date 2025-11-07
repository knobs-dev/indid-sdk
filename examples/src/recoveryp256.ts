// import { AdminClient } from '@indid/indid-admin-sdk'
import { AdminClient, IndidAddress, IndidSigner, LogLevel, SignerKind } from "../../packages/indid-admin/dist";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const privKey = process.env.PRIVATE_KEY;
const backendUrl = process.env.BACKEND_URL!;
const guardianPrivKey = process.env.GUARDIAN_PRIVATE_KEY;
const coreApiKey = process.env.SHARED_ADMIN_KEY!;
const p256PrivKey = process.env.P256_PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const guardianAddress = "0xD8db12BdEfeBDeE10BAEEbd9a99E4ff3c9BF887D"
const newOwnerAddress = "0xDFa6BC8D9E5F3cF6B63c8EE4D9B29e3EB782c4e1"

async function run() {
  const clientUser = await AdminClient.init({
    rpcUrl: rpcUrl,
    apiKey: coreApiKey,
    // overrideBackendUrl: "https://api.dev.indid.io/v2",
    overrideBackendUrl: backendUrl,
    logLevel: LogLevel.DEBUG
  });

  // generate a new wallet
  const wallet = privKey ? new ethers.Wallet(privKey) : ethers.Wallet.createRandom();

  console.log("wallet address", wallet.address);

  // create an indid signer from the wallet
  console.log("wallet.privateKey", wallet.privateKey);
  const indidSigner = IndidSigner.fromSecp256k1(wallet.privateKey);

  console.log("indidSigner", await indidSigner.getIndidAddress());

  const guardianSigner = IndidSigner.fromSecp256r1(p256PrivKey!, SignerKind.Guardian);
  const guardianAddress = await guardianSigner.getAddress();
  console.log("guardianSigner address", guardianAddress);

  // const salt = "64";
  const salt = BigInt(ethers.hexlify(ethers.randomBytes(32))).toString();

  //get smart account address
  const { accountAddress: accountAddress2 } = await clientUser.getCounterfactualAddress(
    [await indidSigner.getIndidAddress()],
    salt,
    // {
    //   guardians: [await guardianSigner.getIndidAddress()]
    // }
  );
  console.log("accountAddress from getCounterfactualAddress", accountAddress2);


  // connect and deploy smart account
  // const { error, accountAddress: address } = await clientUser.createAndConnectAccount(indidSigner, salt, undefined, {
  //   guardians: [guardianAddress]
  // });

  // if (error) {
  //   console.error(error);
  //   return;
  // }

  // console.log("accountAddress after createAndConnectAccount", address);

  const address = "0xC68bF41e44c37a85e4D82F1146a8a198f8747225"
  const connectResponse = await clientUser.connectAccount(indidSigner, address)
  if (connectResponse.error) {
    console.error(connectResponse.error);
    return;
  }

  const address2 = "0x948dB95F7ACBAb6bC054432cC05d18c0a258931B"
  // const connectResponse = await clientUser.connectAccount(indidSigner, address2)
  // if (connectResponse.error) {
  //   console.error(connectResponse.error);
  //   return;
  // }



  const recoveryOp = await clientUser.prepareEnterpriseRecoveryOperation(address2, 
    IndidAddress.fromSecp256k1(newOwnerAddress).getPrefixedAddress(),
    guardianSigner
  )

  const sponsorshipResponse = await clientUser.getUserOpSponsorship(recoveryOp)

  console.log("sponsorship", sponsorshipResponse);

  const signResp = await clientUser.signUserOperation(recoveryOp)

  console.log("signResp", signResp);


  const sendResp = await clientUser.sendUserOperation(recoveryOp)

  console.log("sendResp", sendResp);

  const taskResult = await clientUser.waitTask(sendResp.taskId)

  console.log("taskResult", taskResult);




  // const sponsorship = await clientUser.getUserOpSponsorship(userop);
  // console.log("sponsorship", sponsorship);

  // // send the operation
  // await clientUser.signUserOperation(userop)

  // const tx = await clientUser.sendUserOperation(userop);

  // const taskResult = await clientUser.waitTask(tx.taskId);

  // console.log("task completed", taskResult);


}

run()
  .then(() => { })
  .catch((e) => {
    console.error(e);
  });
