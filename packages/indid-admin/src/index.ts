import {
  Client,
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
  IDelegatedTransactionOptions,
  ISendDelegatedTransactionsResponse,
  ICall,
  Logger,
  LogLevel,
  IClientConfig
} from "@indid/indid-core-sdk";
import {
  EnterpriseModule__factory, UsersModule__factory,
} from "@indid/indid-typechains";
import { BigNumberish, ethers } from "ethers";
import { Interface } from "ethers/lib/utils";

class AdminClient extends Client {
  private constructor(config: IClientConfig) {
    super(config);
  }

  public static async init(config: IClientConfig) {
    const instance = new AdminClient(config);
    Logger.getInstance().setLogLevel(config.logLevel || LogLevel.NONE);
    await this.initialize(instance, config);
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
        chainId: this.chainId.toString(),
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
        chainId: this.chainId.toString(),
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
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
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
      await this.signer!.getAddress(),
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
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const response = await this.backendCaller.signPaymasterOp({
      ...OpToJSON(builder.getOp()),
      chainId: this.chainId.toString()
    });
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
    guardianSigner: ethers.Wallet | ethers.providers.JsonRpcSigner,
    webhookData?: IWebHookRequest
  ): Promise<IRecoverAccountResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const moduleK = EnterpriseModule__factory.connect(
      this.moduleAddress,
      this.provider
    );

    Logger.getInstance().debug(
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
      [guardianSigner as ethers.Wallet]
    );

    const response = await this.backendCaller.backendRecoverAccount({
      newOwner: newOwner,
      walletAddress: accountAddress,
      chainId: this.chainId,
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

  public async sendDelegatedTransactions(
    transactions: ICall[],
    opts?: IDelegatedTransactionOptions
  ): Promise<ISendDelegatedTransactionsResponse> {
    let chainId = opts?.chainId || this.chainId;
    if (chainId === undefined || chainId === 0) {
     return {
      taskId: "",
      error: "No chainId provided, either pass chainId in options or connect to a provider",
     }
    }
    if (this.signer === undefined) {
      throw new Error("No signer available, create or connect account first");
    }

    let abi;
    if (this.moduleType === "enterprise") {
      abi = EnterpriseModule__factory.abi;
    } else if (this.moduleType === "users") {
      abi = UsersModule__factory.abi;
    } else {
      throw new Error("Invalid module type");
    }

    const moduleInterface = new Interface(abi);

    const functionName = opts?.doNotRevertOnTxFailure ? "multiCallNoRevert" : "multiCall";
    const calldataMulticall = moduleInterface.encodeFunctionData(
      functionName,
      [this.accountAddress, transactions]
    );

    const currentTime = Math.round(new Date().getTime() / 1000);
    const deadline = currentTime + (opts?.deadlineSeconds || 60 * 60);

    let { signature, nonce } = await signEIP712Transaction(
      this.accountAddress,
      this.moduleAddress,
      calldataMulticall,
      deadline,
      chainId,
      [this.signer]
    );


    // const executeCalldata = (await module!.populateTransaction.execute(
    //   this.accountAddress,
    //   calldataMulticall,
    //   nonce,
    //   deadline,
    //   signature
    // )).data!

    //hash executeCalldata
    // const executeCalldataHash = solidityKeccak256(["bytes"], [executeCalldata]);

    const response = await this.backendCaller.sendDelegatedTransactions({
      accountAddress: this.accountAddress,
      chainId: chainId.toString(),
      moduleAddress: this.moduleAddress,
      data: calldataMulticall,
      nonce: nonce,
      deadline: deadline,
      sigs: signature,
      webhookData: opts?.webhookData,
    });

    return {
      taskId: response.taskId,
      error: response.error,
    };
  }
}

export { AdminClient};
export * from "@indid/indid-core-sdk";
