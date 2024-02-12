import {
  Client,
  IClientOpts,
  ICreateAccountResponse,
  ICreateAndConnectAccountResponse,
  IUserOperationBuilder,
  OpToJSON,
  ICreateAccountOpts,
  IUserOpSponsorshipResponse,
  IWebHookRequest,
  signEIP712Transaction,
  IRecoverAccountResponse,
  TaskUserOperationStatus,
  UserOperationBuilder
} from "@indid/indid-core-sdk";
import {
  EnterpriseModule__factory,
} from "@indid/indid-typechains";
import { ethers } from "ethers";


class AdminClient extends Client {
  private constructor(rpcUrl: string, apiKey: string, opts?: IClientOpts) {
    super(rpcUrl, apiKey, opts);
  }

  public static async init(rpcUrl: string, apiKey: string, opts?: IClientOpts) {
    const instance = new AdminClient(rpcUrl, apiKey, opts);
    await this.initialize(instance, opts);
    return instance;
  }

  public async createAccount(
    owner: string,
    salt: string = "0",
    webhookData?: IWebHookRequest,
    opts?: ICreateAccountOpts
  ): Promise<ICreateAccountResponse> {
    let config = { ...opts };

    if (opts == null) {
      config.factoryAddress = this.factoryAddress;
      config.moduleAddress = this.moduleAddress;
      config.guardians = this.guardians;
      config.moduleType = this.moduleType;
      config.storageType = this.storageType;
    }

    let response: ICreateAccountResponse;

    if (config.storageType === "standard") {
      response = await this.backendCaller.backendCreateAccount({
        factoryAddress: config.factoryAddress,
        owner: owner,
        _module: config.moduleAddress,
        _guardians: config.guardians,
        salt: salt,
        webhookData,
      });
    } else if (config.storageType === "shared") {
      if (opts != null) {
        if (opts.guardianStructId === undefined) {
          return {
            accountAddress: "",
            taskId: "",
            error: "No guardianStructId provided",
          };
        }
        config.guardianStructId = opts.guardianStructId;
      } else {
        config.guardianStructId = this.guardianStructId;
      }
      response = await this.backendCaller.backendCreateAccount({
        factoryAddress: config.factoryAddress,
        owner: owner,
        _module: config.moduleAddress,
        _guardianId: config.guardianStructId,
        salt: salt,
        webhookData,
      });
    } else {
      return { accountAddress: "", taskId: "", error: "Invalid storage type" };
    }

    return {
      accountAddress: response.accountAddress,
      taskId: response.taskId,
      error: response.error,
    };
  }

  public async createAndConnectAccount(
    signer?: ethers.Signer,
    salt: string = "0",
    webhookData?: IWebHookRequest,
    opts?: ICreateAccountOpts
  ): Promise<ICreateAndConnectAccountResponse> {
    let seed: string | undefined;
    if (signer == undefined && this.signer !== undefined) {
      const wallet = ethers.Wallet.createRandom();
      const seed = wallet.mnemonic.phrase;
      const path = "m/44'/60'/0'/0/0"; 
      const signer = ethers.Wallet.fromMnemonic(seed, path).connect(
        this.provider
      );
      this.signer = signer;
    }

    if (signer !== undefined) {
      this.signer = signer;
    }

    const response = await this.createAccount(
      this.signer!.address,
      salt,
      webhookData,
      opts
    );
    if (response.error) {
      return {
        accountAddress: "",
        taskId: "",
        seed,
        error: response.error,
      };
    }
    const taskResponse = await this.waitTask(response.taskId);
    if(taskResponse.operationStatus !== TaskUserOperationStatus.EXECUTED){
      return {
        accountAddress: "",
        taskId: "",
        seed,
        error: taskResponse.operationStatus + taskResponse.reason,
      };
    }

    this.connectAccount(this.signer, response.accountAddress);

    return {
      accountAddress: response.accountAddress,
      taskId: response.taskId,
      seed,
      error: response.error,
    };
  }

  async getUserOpSponsorship(
    builder: IUserOperationBuilder
  ): Promise<IUserOpSponsorshipResponse> {
    const response = await this.backendCaller.signPaymasterOp(
      OpToJSON(builder.getOp())
    );
    if (response.error) {
      return { paymasterAndData: "", error: response.error };
    }
    const paymasterData = response.paymasterAndData;
    builder.setPaymasterAndData(paymasterData);
    return { paymasterAndData: response.paymasterAndData, error: undefined };
  }

  public async recoverEnterpriseAccount(
    accountAddress: string,
    newOwner: string,
    webhookData?: IWebHookRequest
  ): Promise<IRecoverAccountResponse> {
    if(this.signer === undefined){
      return { taskId: "", error: "No signer provided" };
    }

    const moduleK = EnterpriseModule__factory.connect(
      this.moduleAddress,
      this.provider
    );

    console.log(
      "account guardians",
      await moduleK.getGuardians(accountAddress)
    );

    const calldata = moduleK.interface.encodeFunctionData("transferOwnership", [
      accountAddress,
      newOwner,
    ]);
    const deadline = Date.now() + 2000;
    let { signature, nonce } = await signEIP712Transaction(
      accountAddress,
      moduleK.address,
      calldata,
      deadline,
      this.chainId,
      [this.signer]
    );

    const response = await this.backendCaller.backendRecoverAccount({
      newOwner: newOwner,
      walletAddress: accountAddress,
      signature: signature,
      nonce: nonce,
      deadline: deadline,
      webhookData
    });

    if (response.error) {
      return { taskId: "", error: response.error };
    }

    return { taskId: response.taskId, error: undefined };
  }
}

export { AdminClient, UserOperationBuilder};
