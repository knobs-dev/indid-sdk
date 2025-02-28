import {
  Client,
  ICreateAccountResponse,
  ICreateAndConnectAccountResponse,
  IUserOperationBuilder,
  OpToJSON,
  ICreateAccountOpts,
  IUserOpSponsorshipResponse,
  IWebHookRequest,
  IRecoverAccountResponse,
  TaskUserOperationStatus,
  IDelegatedTransactionOptions,
  ISendDelegatedTransactionsResponse,
  ICall,
  Logger,
  LogLevel, 
  IClientConfig,
  IndidSigner,
  SignerKind,
  IRetrieveSdkDefaultsResponse
} from "@indid/indid-core-sdk";
import { IndidModule, ModuleType, ModuleVersion, StorageType } from "@indid/indid-core-sdk/dist/module";
import { ethers } from "ethers";


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
    let defaultsResponse: IRetrieveSdkDefaultsResponse;
    defaultsResponse = await this.backendCaller.retrieveSdkDefaults(this.chainId);

    if (opts == null) {
      config.factoryAddress = defaultsResponse.factoryAddress;
      config.moduleAddress = defaultsResponse._module;
      config.guardians = defaultsResponse._guardians;
      config.beaconId = defaultsResponse._guardianId;
      config.moduleType = defaultsResponse.moduleType;
      config.storageType = defaultsResponse.storageType;
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
        if (opts.beaconId === undefined) {
          return {
            accountAddress: "",
            taskId: "",
            error: "No beaconId provided",
          };
        }
        config.beaconId = opts.beaconId;
      } else {
        config.beaconId = defaultsResponse._guardianId;
      }
      response = await this.backendCaller.backendCreateAccount({
        factoryAddress: config.factoryAddress,
        chainId: this.chainId.toString(),
        owner: owner,
        _module: config.moduleAddress,
        _guardianId: config.beaconId,
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
    signer: IndidSigner,
    salt: string = "0",
    webhookData?: IWebHookRequest,
    opts?: ICreateAccountOpts
  ): Promise<ICreateAndConnectAccountResponse> {
    //TODO: the signer should create a new onwer on either curve
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const response = await this.createAccount(
      await signer.getAddress(),
      salt,
      webhookData,
      opts
    );
    if (response.error) {
      return {
        accountAddress: "",
        taskId: "",
        error: response.error,
      };
    }
    const taskResponse = await this.waitTask(response.taskId);
    if (taskResponse.operationStatus !== TaskUserOperationStatus.EXECUTED) {
      return {
        accountAddress: "",
        taskId: "",
        error: taskResponse.operationStatus + taskResponse.reason,
      };
    }

    this.connectAccount(signer, response.accountAddress);

    return {
      accountAddress: response.accountAddress,
      taskId: response.taskId,
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
    guardianSigner: IndidSigner,
    webhookData?: IWebHookRequest
  ): Promise<IRecoverAccountResponse> {
    //TODO: is this check needed? the provider here is used to get the chainId
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }

    //get account info
    const accountInfoResponse = await this.backendCaller.getAccountInfo({ accountAddress: accountAddress, chainId: this.chainId.toString() });
    const module = new IndidModule(
      accountInfoResponse.moduleAddress,
      accountInfoResponse.moduleType as ModuleType,
      accountInfoResponse.storageType as StorageType,
      accountInfoResponse.moduleVersion as ModuleVersion
    );


    const calldata = module.getCalldataTransferOwnership(accountAddress, newOwner);
    const deadline = Date.now() + 2000;
    let { signature, nonce } = await guardianSigner.signEIP712Transaction(
      accountAddress,
      module.address,
      calldata,
      deadline,
      this.chainId,
      SignerKind.Guardian
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
    if (this.account === undefined) {
      throw new Error("No account available, create or connect account first");
    }

    const calldataMulticall = this.account.module.getCalldataMulticall(
      this.account.address,
      transactions
    );

    const currentTime = Math.round(new Date().getTime() / 1000);
    const deadline = currentTime + (opts?.deadlineSeconds || 60 * 60);

    let { signature, nonce } = await this.account.signer.signEIP712Transaction(
      this.account.address,
      this.account.module.address,
      calldataMulticall,
      deadline,
      chainId
    );

    const response = await this.backendCaller.sendDelegatedTransactions({
      accountAddress: this.account.address,
      chainId: chainId.toString(),
      moduleAddress: this.account.module.address,
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

export { AdminClient };
export * from "@indid/indid-core-sdk";
