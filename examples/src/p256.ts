// import { AdminClient } from '@indid/indid-admin-sdk'
import { AdminClient, IndidSigner, LogLevel, SignerKind } from "../../packages/indid-admin/dist";
import dotenv from "dotenv";
import { ethers } from "ethers";

// Load env file
dotenv.config();

const rpcUrl = process.env.RPC_URL!;
const backendUrl = process.env.BACKEND_URL!;
const coreApiKey = process.env.SHARED_ADMIN_KEY!;
const p256PrivKey = process.env.P256_PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const recipientAddress = "0xDFa6BC8D9E5F3cF6B63c8EE4D9B29e3EB782c4e1"

async function run() {
  const clientUser = await AdminClient.init({
    rpcUrl: rpcUrl,
    apiKey: coreApiKey, 
    overrideBackendUrl: backendUrl,
    logLevel: LogLevel.DEBUG
  });

  const indidSigner = IndidSigner.fromSecp256r1(p256PrivKey!);

  console.log("indidSigner", await indidSigner.getIndidAddress());

  const salt = "333";

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
    recipientAddress,
    ethers.parseEther("0.000"),
    {
      initCode: initCodeResponse.initCode,
    }
  );

  const sponsorship = await clientUser.getUserOpSponsorship(userop);
  console.log("sponsorship", sponsorship);

  // send the operation
  await clientUser.signUserOperation(userop)

  const tx = await clientUser.sendUserOperation(userop);

  const taskResult = await clientUser.waitTask(tx.taskId);

  console.log("task completed", taskResult);


}

run()
  .then(() => { })
  .catch((e) => {
    console.error(e);
  });
