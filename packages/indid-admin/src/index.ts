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
  IRetrieveSdkDefaultsResponse,
  IndidAddress,
  IndidModule,
  ModuleType,
  ModuleVersion,
  StorageType,
  ISendDelegatedTransactionsRequest
} from "@indid/indid-core-sdk";


/**
 * AdminClient is a class that extends the Client class and adds additional functionality for creating and managing accounts.
 */
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

  /**
   * Creates an account
   * @param owners The owners of the account
   * @param salt The salt to use for the account
   * @param webhookData The webhook data to use for the account creation
   * @param opts The options to use for the account
   * @returns The account address and task id
   */
  public async createAccount(
    owners: IndidAddress[],
    salt: string = "0",
    webhookData?: IWebHookRequest,
    opts?: ICreateAccountOpts
  ): Promise<ICreateAccountResponse> {
    let config: ICreateAccountOpts;



    // Handle case when no options are provided - use defaults from backend
    if (opts == null) {
      // Get defaults from backend if needed
      let defaultsResponse: IRetrieveSdkDefaultsResponse;
      defaultsResponse = await this.backendCaller.retrieveSdkDefaults(this.chainId);
      if (defaultsResponse.error) {
        return { accountAddress: "", taskId: "", error: defaultsResponse.error };
      }
      config = {
        factoryAddress: defaultsResponse.factoryAddress,
        moduleAddress: defaultsResponse._module,
        guardians: defaultsResponse._guardians.map((g: any) => {
          const prefix = g.type === 0 ? "0x00" : "0x01";
          const addressWithoutPrefix = g.value.startsWith("0x") ? g.value.slice(2) : g.value;
          return IndidAddress.newFromPrefixedAddress(prefix + addressWithoutPrefix);
        }),
        beaconId: defaultsResponse._guardianId,
        moduleType: defaultsResponse.moduleType,
        storageType: defaultsResponse.storageType
      };
    }
    // When options are provided, validate they include all necessary parameters
    else {
      config = { ...opts };

      // Validate required common parameters
      if (!config.factoryAddress || !config.moduleAddress || !config.moduleType || !config.storageType) {
        return {
          accountAddress: "",
          taskId: "",
          error: "Missing required parameters: factoryAddress, moduleAddress, moduleType, and storageType must be provided"
        };
      }

      // Validate storage-type specific parameters
      if (config.storageType === "standard" && (!config.guardians || config.guardians.length === 0)) {
        return {
          accountAddress: "",
          taskId: "",
          error: "For standard storage type, guardians must be provided"
        };
      }

      if (config.storageType === "shared" && !config.beaconId) {
        return {
          accountAddress: "",
          taskId: "",
          error: "For shared storage type, beaconId must be provided"
        };
      }
    }

    // Validate owners
    if (owners === undefined || owners.length === 0) {
      return {
        accountAddress: "",
        taskId: "",
        error: "No owners provided, at least one owner address is required"
      };
    }

    let response: ICreateAccountResponse;

    if (config.storageType === "standard") {
      response = await this.backendCaller.backendCreateAccount({
        factoryAddress: config.factoryAddress,
        chainId: this.chainId.toString(),
        owner: owners.map(o => o.getPrefixedAddress()),
        _module: config.moduleAddress,
        _guardians: config.guardians!.map(g => g.getPrefixedAddress()),
        salt: salt,
        webhookData,
      });
    } else if (config.storageType === "shared") {
      response = await this.backendCaller.backendCreateAccount({
        factoryAddress: config.factoryAddress,
        chainId: this.chainId.toString(),
        owner: owners.map(o => o.getPrefixedAddress()),
        _module: config.moduleAddress,
        _guardianId: config.beaconId!,
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


  /**
   * Creates and connects an account
   * @param signer The signer to use for the account
   * @param salt The salt to use for the account
   * @param webhookData The webhook data to use for the account creation
   * @param opts The options to use for the account
   * @returns The account address and task id
   */
  public async createAndConnectAccount(
    signer: IndidSigner,
    salt: string = "0",
    webhookData?: IWebHookRequest,
    opts?: ICreateAccountOpts
  ): Promise<ICreateAndConnectAccountResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const response = await this.createAccount(
      [await signer.getIndidAddress()],
      salt,
      webhookData,
      opts
    );
    Logger.getInstance().debug("response inside createAndConnectAccount: ", response);
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

  /**
   * Gets the sponsorship for a user operation
   * @param builder The user operation builder
   * @returns The paymaster and data
   */
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

  /**
   * Recovers an enterprise account
   * @param accountAddress The address of the account to recover
   * @param newOwner The new owner of the account
   * @param guardianSigner The signer for the account guardian
   * @param webhookData The webhook data to use
   * @returns The task id and possible error
   */
  public async recoverEnterpriseAccount(
    accountAddress: string,
    newOwner: IndidAddress,
    guardianSigner: IndidSigner,
    webhookData?: IWebHookRequest
  ): Promise<IRecoverAccountResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }

    //get account info
    const accountInfoResponse = await this.backendCaller.getAccountInfo(
      { accountAddress: accountAddress, chainId: this.chainId.toString() });
    const module = new IndidModule(
      accountInfoResponse.moduleAddress,
      accountInfoResponse.moduleType as ModuleType,
      accountInfoResponse.storageType as StorageType,
      accountInfoResponse.moduleVersion as ModuleVersion
    );


    const calldata = module.getCalldataTransferOwnership(accountAddress, newOwner.getPrefixedAddress());
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
      newOwner: newOwner.getPrefixedAddress(),
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

  /**
   * Sends a prepared delegated transaction.
   * 
   * @param preparedTransaction - The prepared transaction request object
   * @returns The task ID or error
   */
  public async sendPreparedDelegatedTransactions(
    preparedTransaction: ISendDelegatedTransactionsRequest
  ): Promise<ISendDelegatedTransactionsResponse> {
    const response = await this.backendCaller.sendDelegatedTransactions(preparedTransaction);
    
    return {
      taskId: response.taskId,
      error: response.error,
    };
  }

  /**
   * Sends delegated transactions
   * @param transactions The transactions to send
   * @param opts The options to use for the transactions
   * @returns The task id or possible error
   */
  public async sendDelegatedTransactions(
    transactions: ICall[],
    opts?: IDelegatedTransactionOptions
  ): Promise<ISendDelegatedTransactionsResponse> {
    try {
      const preparedTransaction = await this.prepareDelegatedTransactions(transactions, opts);
      return await this.sendPreparedDelegatedTransactions(preparedTransaction);
    } catch (error: any) {
      return {
        taskId: "",
        error: error.message || "Unknown error occurred during delegated transaction preparation",
      };
    }
  }
}

export { AdminClient };
export * from "@indid/indid-core-sdk";
