import {
  ethers,
  dataSlice,
  BigNumberish,
  hexlify,
  randomBytes,
  getBytes
} from "ethers";
import {
  IUserOperationBuilder,
  ISendUserOperationOpts,
  ICreateAccountOpts,
  IConnectAccountOpts,
  ISendUserOpResponse,
  IInitCodeResponse,
  IGetCounterfactualAddressResponse,
  IWebHookRequest,
  IWebHookSignatureRequest,
  IWaitTaskResponse,
  IUserOperationReceipt,
  IGetNonceResponse,
  IGetUserOperationHashResponse,
  ISignUserOperationResponse,
  IUserOperationOptions,
  IUserOperationReceiptResponse,
  ICall,
  IConnectAccountResponse,
  IInitCodeRequest,
  IClientConfig,
  EntryPointMinimalABI,
  IRetrieveSdkDefaultsResponse,
  IDelegatedTransactionOptions,
  ISendDelegatedTransactionsRequest,
  ICreateAccountRequest
} from "./types";
import { LogLevel, Logger, OpToJSON } from "./utils";
import { UserOperationMiddlewareCtx } from "./context";
import { EntryPointAddress } from "./constants";
import { BundlerJsonRpcProvider } from "./provider";
import { BackendCaller } from "./backendCaller";
import WebSocket from "isomorphic-ws";

import { IndidModule, ModuleType, ModuleVersion, StorageType } from "./module";
import { AccountVersion, IndidAccount } from "./account";
import {
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  DEFAULT_VERIFICATION_GAS_LIMIT_R1,
  DEFAULT_VERIFICATION_GAS_LIMIT_R1_PRECOMPILE,
  UserOperationBuilder,
} from "./builder";

import { ec as EC } from "elliptic";
import * as crypto from "crypto";
import { IndidSigner } from "./signer";
import { IndidAddress, SignatureType, SignerKind } from "./address";
import { IndidDeployer } from "./deployer";

/**
 * Main client class for interacting with the Indid protocol.
 * Provides methods for account management, transaction creation, and user operation handling.
 */
export class Client {
  public provider?: BundlerJsonRpcProvider;
  public backendCaller: BackendCaller;

  public entryPointAddress: string;

  public entryPoint: ethers.Contract;
  public chainId: BigNumberish;
  public account: IndidAccount;

  /**
   * Private constructor for the Client class.
   * @param {IClientConfig} config - Client configuration options
   * @private
   */
  protected constructor(config: IClientConfig) {
    if (config.overrideBundlerRpc) {
      this.provider = new BundlerJsonRpcProvider(config.overrideBundlerRpc).setBundlerRpc(
        config.overrideBundlerRpc
        // "http://localhost:3000/rpc"
      );
    }

    Logger.getInstance().setLogLevel(config.logLevel || LogLevel.NONE);

    this.backendCaller = new BackendCaller(
      config.overrideBackendUrl || "https://api.indid.io",
      config.apiKey
    );

    this.entryPointAddress = "0x";
    this.chainId = 0;
    this.entryPoint = "0x" as any;
    this.account = "0x" as any;
  }

  /**
   * Initializes a new Client instance with the provided configuration.
   * Sets up the provider, backend caller, and other essential components.
   * 
   * @param config - Client configuration options
   * @returns A fully initialized Client instance
   */
  public static async init(config: IClientConfig) {
    const instance = new Client(config);
    await this.initialize(instance, config);
    return instance;
  }

  /**
   * Internal method to initialize a Client instance with the provided configuration.
   * Sets up the provider, entryPoint, chainId and other components based on the config.
   * 
   * @param instance - The Client instance to initialize
   * @param config - Client configuration options
   * @private
   */
  static async initialize(instance: Client, config: IClientConfig) {

    if (config.rpcUrl) {
      Logger.getInstance().debug("rpcUrl provided, connecting to provider");
      instance.provider = new BundlerJsonRpcProvider(config.rpcUrl);
      instance.chainId = await instance.provider
        .getNetwork()
        .then((network) => BigInt(network.chainId));

      //This line of code is setting entryPointAddress based on the first truthy value found among the following, in order:
      instance.entryPointAddress = config.overrideEntryPoint || EntryPointAddress[Number(instance.chainId)] || EntryPointAddress[137];

      instance.entryPoint = new ethers.Contract(
        instance.entryPointAddress,
        EntryPointMinimalABI,
        instance.provider
      );
    }

    else if (config.chainId) {
      Logger.getInstance().debug("chainId provided, setting chainId");
      instance.chainId = config.chainId;
      //This line of code is setting entryPointAddress based on the first truthy value found among the following, in order:
      instance.entryPointAddress = config.overrideEntryPoint || EntryPointAddress[Number(instance.chainId)] || EntryPointAddress[137];
    }

    else {
      Logger.getInstance().debug("You are initializing the client without a chainId or rpcUrl");
      instance.entryPointAddress = config.overrideEntryPoint || EntryPointAddress[137];
    }
    //TODO: check if this is useful
    instance.backendCaller.backendUrl =
      config.overrideBackendUrl || "https://api.indid.io";

    Logger.getInstance().setLogLevel(config.logLevel || LogLevel.NONE);
    Logger.getInstance().debug(`EntryPointAddress: ${instance.entryPointAddress}`);
    Logger.getInstance().debug(`Backend url: ${instance.backendCaller.backendUrl}`);

  }

  /**
   * Connects to a blockchain provider using the provided RPC URL.
   * Sets up the entryPoint contract and retrieves the chainId.
   * 
   * @param rpcUrl - The URL of the RPC provider
   * @throws If connection to the provider fails
   */
  public async connectProvider(rpcUrl: string) {
    this.provider = new BundlerJsonRpcProvider(rpcUrl);
    this.entryPoint = new ethers.Contract(
      this.entryPointAddress,
      EntryPointMinimalABI,
      this.provider
    );
    this.chainId = await this.provider
      .getNetwork()
      .then((network) => BigInt(network.chainId));

    Logger.getInstance().debug("connectProvider has set the chainId to: ", this.chainId);
  }

  /**
   * Calculates the counterfactual address of an account before it's deployed.
   * Uses initCode to determine what the account address will be after deployment.
   * 
   * @param owners - Array of owner addresses
   * @param salt - Salt value for address generation
   * @param opts - Optional account creation parameters
   * @returns The calculated address or error
   * @throws If provider is not connected
   */
  public async getCounterfactualAddress(
    owners: IndidAddress[],
    salt: string = "0",
    opts?: ICreateAccountOpts
  ): Promise<IGetCounterfactualAddressResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    let response = await this.getInitCode(owners, salt, opts);

    Logger.getInstance().debug("response getInitCode: ", response);

    if (response.error) {
      return {
        accountAddress: "",
        error: response.error,
      };
    }

    const accountAddress = await this.provider.call({
      to: response.initCode.slice(0, 42),
      data: "0x" + response.initCode.slice(42),
    });

    Logger.getInstance().debug("accountAddress from provider.call: ", accountAddress);
    if (accountAddress === "0x") {
      return {
        accountAddress: "",
        error: "Error calculating counterfactual address",
      };
    }

    return {
      accountAddress: "0x" + accountAddress.slice(26),
    };
  }

  /**
   * Gets the sequential nonce for an account from the EntryPoint contract.
   * 
   * @param accountAddress - Optional address of the account (uses connected account if not provided)
   * @returns The account nonce or error
   * @throws If provider is not connected or no account is available
   */
  public async getAccountNonce(
    accountAddress?: string
  ): Promise<IGetNonceResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    if (accountAddress === undefined) {
      if (this.account.address === "0x") {
        return {
          nonce: "",
          error:
            "No account address available, provide one or connect a smart contract account first",
        };
      }
      accountAddress = this.account.address;
    }

    return { nonce: await this.entryPoint.getNonce(accountAddress) };
  }


  /**
   * Generates a non-sequential (random) nonce for an account.
   * Creates a random key and uses it to get a non-sequential nonce from the EntryPoint.
   * 
   * @param accountAddress - Optional address of the account (uses connected account if not provided)
   * @returns The generated random nonce or error
   * @throws If provider is not connected or no account is available
   */
  public async getNonSequentialAccountNonce(
    accountAddress?: string
  ): Promise<IGetNonceResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    if (accountAddress === undefined) {
      if (this.account.address === "0x") {
        return {
          nonce: "",
          error:
            "No account address available, provide one or connect a smart contract account first",
        };
      }
      accountAddress = this.account.address;
    }

    //generate 192 random bits for the key
    const key = hexlify(randomBytes(24));

    return { nonce: await this.entryPoint.getNonce(this.account.address, key) };
  }

  /**
   * Connects to an existing account with the provided signer and address.
   * Either uses provided module information or retrieves it from the backend.
   * 
   * @param signer - The signer for the account
   * @param accountAddress - The address of the account to connect
   * @param opts - Optional account connection parameters
   * @returns Success or error response
   */
  public async connectAccount(
    signer: IndidSigner,
    accountAddress: string,
    opts?: IConnectAccountOpts
  ): Promise<IConnectAccountResponse> {
    if (this.chainId === 0 && opts?.chainId === undefined) {
      return {
        error: "No chainId provided, either pass chainId in options or connect to a provider",
      }
    }
    let chainId = opts?.chainId || this.chainId;

    if (opts != null) {
      const module = new IndidModule(
        opts.moduleAddress,
        opts.moduleType as ModuleType,
        opts.storageType as StorageType,
        opts.moduleVersion as ModuleVersion
      );

      this.account = new IndidAccount({
        signer: signer,
        version: opts.accountVersion as AccountVersion,
        address: accountAddress,
        module: module,
        factoryAddress: opts.factoryAddress
      });
      return {};
    }
    else {
      const response = await this.backendCaller.getAccountInfo({ accountAddress: accountAddress, chainId: chainId.toString() });
      Logger.getInstance().debug("response backend caller getAccountInfo: ", response);

      const module = new IndidModule(
        response.moduleAddress,
        response.moduleType as ModuleType,
        response.storageType as StorageType,
        response.moduleVersion as ModuleVersion
      );
      this.account = new IndidAccount({
        signer: signer,
        version: response.accountVersion as AccountVersion,
        address: accountAddress,
        module: module,
        factoryAddress: response.factoryAddress
      });
      // this.guardians = response.guardians;
      // this.guardiansHash = response.guardiansHash;
      // this.guardianStructId = response.guardianStructId;

      return {
        error: response.error,
      };
    }
  }

  /**
   * Prepares a user operation to execute multiple transactions in a single call.
   * Encodes the transactions for multicall execution through the account's module.
   * 
   * @param transactions - Array of transaction objects 
   * @param opts - Optional user operation parameters
   * @returns A builder with the partially constructed user operation
   * @throws If no signer is available
   */
  public async prepareSendTransactions(
    transactions: ICall[],
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    Logger.getInstance().debug("account object: ", this.account);
    if (!this.account.signer) {
      throw new Error("No signer available, connect account first");
    }

    Logger.getInstance().debug("moduleType: ", this.account.module.moduleType);

    const calldataMulticall = this.account.module.getCalldataMulticall(
      this.account.address,
      transactions,
      opts?.doNotRevertOnTxFailure
    );

    const calldataOp = this.account.getInvokeModuleCalldata(
      this.account.module.address,
      calldataMulticall
    );

    let builder = await this.fillUserOperation(
      calldataOp,
      opts
    );

    return builder;
  }

  /**
   * Prepares a user operation for an enterprise recovery operation.
   * Creates and signs the appropriate calldata for transferring account ownership.
   * 
   * @param accountAddress - The address of the account to recover
   * @param newOwner - The address of the new owner
   * @param guardianSigner - The signer for the guardian
   * @param opts - Optional user operation parameters
   * @returns A builder with the partially constructed user operation
   * @throws If provider is not connected, no signer is available, or module type is not enterprise
   */
  public async prepareEnterpriseRecoveryOperation(
    accountAddress: string,
    newOwner: string,
    guardianSigner: IndidSigner,
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    if (this.account.signer === undefined) {
      throw new Error("No signer available, create or connect account first");
    }

    const response = await this.backendCaller.getAccountInfo({ accountAddress: accountAddress, chainId: this.chainId.toString() });
    Logger.getInstance().debug("response backend caller getAccountInfo: ", response);

    if (response.error) {
      throw new Error("Error getting account info: " + response.error);
    }

    if (response.moduleType !== "enterprise") {
      throw new Error("Only enterprise module is supported");
    }

    const accountModule = new IndidModule(
      response.moduleAddress,
      response.moduleType as ModuleType,
      response.storageType as StorageType,
      response.moduleVersion as ModuleVersion
    );


    const calldataRecovery = accountModule.getCalldataTransferOwnership(accountAddress, newOwner);

    Logger.getInstance().debug("calldataRecovery: ", calldataRecovery);

    const currentTimeInSeconds = Math.round(new Date().getTime() / 1000);
    const deadline = currentTimeInSeconds + (opts?.deadlineSeconds || 60 * 60);
    let { signature, nonce } = await guardianSigner.signEIP712Transaction(
      accountAddress,
      accountModule.address,
      calldataRecovery,
      deadline,
      this.chainId,
      SignerKind.Guardian
    );


    //This workaround handles signatures for different module versions
    let prefixedSignature = signature;
    Logger.getInstance().debug("prefixedSignature before: ", prefixedSignature);
    Logger.getInstance().debug("guardianSigner.getCurveType(): ", guardianSigner.getCurveType());
    Logger.getInstance().debug("module version: ", accountModule.version);
    if (accountModule.version > 1 && guardianSigner.getCurveType() === "secp256k1") {
      prefixedSignature = IndidSigner
        .createPrefixedSignature(SignerKind.Guardian,
          SignatureType.Secp256k1,
          await guardianSigner.ethersSigner!.getAddress(),
          signature);

    }

    Logger.getInstance().debug("signature recovery: ", signature);


    const calldataExecute = accountModule.getCalldataExecute(
      accountAddress,
      calldataRecovery,
      nonce,
      deadline,
      [prefixedSignature]
    );

    const builder = await this.prepareSendTransactions([{
      to: accountModule.address,
      value: 0,
      data: calldataExecute
    }]);
    return builder;
  }

  /**
   * Prepares a user operation to send a module operation with provided signatures.
   * Used for operations that require pre-signed approvals.
   * 
   * @param calldata - The calldata for the module operation
   * @param nonce - The nonce for the module operation
   * @param deadline - The deadline timestamp for the module operation
   * @param signatures - The signatures for the module operation
   * @param opts - Optional user operation parameters
   * @returns A builder with the partially constructed user operation
   */
  public async prepareSendModuleOperation(
    calldata: string,
    nonce: string,
    deadline: number,
    signatures: string,
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    let sigs = "0x";
    if (signatures !== undefined) {
      sigs = signatures;
    }

    const calldataOp = this.account.getInvokeModuleCalldata(
      this.account.module.address,
      calldata,
      nonce,
      deadline,
      sigs
    );

    let builder = await this.fillUserOperation(calldataOp, opts);

    return builder;
  }

  /**
   * Gets the initialization code for an account.
   * Either retrieves the init code for an existing account or generates it for a new one.
   * 
   * @param owners - Optional array of owner addresses
   * @param salt - Salt value for account creation
   * @param opts - Optional account creation parameters
   * @returns The initialization code or error
   */
  public async getInitCode(
    owners?: IndidAddress[],
    salt: string = "0",
    opts?: ICreateAccountOpts
  ): Promise<IInitCodeResponse> {
    // If account already exists, fetch its init code from backend
    if (this.account.address !== "0x" && this.account.address !== undefined) {
      const response = await this.backendCaller.getAccountInfo({
        accountAddress: this.account.address,
        chainId: this.chainId.toString()
      });
      return { initCode: response.initCode, error: response.error };
    }

    let ownersPrefixedAddresses: string[] = [];
    let config: ICreateAccountRequest;

    // Handle case when no options are provided - use defaults from backend
    if (opts == null) {
      const defaultsResponse = await this.backendCaller.retrieveSdkDefaults(this.chainId);
      Logger.getInstance().debug("defaultsResponse", defaultsResponse);
      config = {
        factoryAddress: defaultsResponse.factoryAddress,
        _module: defaultsResponse._module,
        _guardians: defaultsResponse._guardians.map((g: any) => {
          const prefix = g.type === 0 ? "0x00" : "0x01";
          const addressWithoutPrefix = g.value.startsWith("0x") ? g.value.slice(2) : g.value;
          return prefix + addressWithoutPrefix;
        }),
        _guardianId: defaultsResponse._guardianId,
        moduleType: defaultsResponse.moduleType,
        storageType: defaultsResponse.storageType
      };
    }
    // When options are provided with at least some parameters
    else {
      // Start with defaults from backend if needed
      if (!opts.factoryAddress || !opts.moduleAddress || !opts.moduleType || !opts.storageType) {
        const defaultsResponse = await this.backendCaller.retrieveSdkDefaults(this.chainId);

        // Important: Always prioritize guardians from opts if they exist
        const hasGuardians = opts.guardians && opts.guardians.length > 0;
        Logger.getInstance().debug("Opts has guardians:", hasGuardians, opts.guardians?.length);

        config = {
          factoryAddress: opts.factoryAddress || defaultsResponse.factoryAddress,
          _module: opts.moduleAddress || defaultsResponse._module,
          moduleType: opts.moduleType || defaultsResponse.moduleType,
          storageType: opts.storageType || defaultsResponse.storageType,
          //TODO: beacon id should be the hash of initial guardians and beacon salt
          //should we use a random beacon salt in the backend?
          _guardianId: opts.beaconId || defaultsResponse._guardianId,
          beaconSalt: opts.beaconSalt || "0",
          // Prioritize guardians from opts if provided
          // Backend returns object with type and value, we need to convert it to string with prefix
          _guardians: hasGuardians ? opts.guardians!.map(g => g.getPrefixedAddress()) : defaultsResponse._guardians.map((g: any) => {
            const prefix = g.type === 0 ? "0x00" : "0x01";
            const addressWithoutPrefix = g.value.startsWith("0x") ? g.value.slice(2) : g.value;
            return prefix + addressWithoutPrefix;
          })
        };

        Logger.getInstance().debug("Final config guardians:", config._guardians);
      } else {
        // All required parameters are provided
        config = { ...opts };
      }

      // Validate storage-type specific parameters
      if (config.storageType === "standard" && (!config._guardians || config._guardians.length === 0)) {
        return {
          initCode: "",
          error: "For standard storage type, guardians must be provided"
        };
      }

      if (config.storageType === "shared" && !config._guardianId) {
        return {
          initCode: "",
          error: "For shared storage type, beaconId must be provided"
        };
      }
    }

    // Validate owners
    if (owners === undefined || owners.length === 0) {
      return { initCode: "", error: "No owners provided, at least one owner address is required" };
    } else {
      ownersPrefixedAddresses = owners.map(owner => owner.getPrefixedAddress());
    }

    Logger.getInstance().debug("storageType: ", config.storageType);

    let requestData: IInitCodeRequest;
    const storageType = config.storageType;

    // Pack and hash owners using ethers v6 methods
    const packedOwnersArray = ethers.solidityPacked(
      ["bytes[]"],
      [ownersPrefixedAddresses]
    );

    const ownersHash = ethers.keccak256(packedOwnersArray);

    // Build request data based on storage type
    if (storageType === "standard") {
      try {

        // Pack and hash guardians using ethers v6 methods
        const packedGuardiansArray = ethers.solidityPacked(
          ["bytes[]"],
          [config._guardians!]
        );

        const guardiansHash = ethers.keccak256(packedGuardiansArray);

        requestData = {
          owner: owners.map(o => o.getPrefixedAddress()),
          ownersHash,
          factoryAddress: config.factoryAddress,
          guardians: config._guardians,
          guardiansHash,
          moduleAddress: config._module, 
          salt,
          chainId: this.chainId,
        };
      } catch (error) {
        return { initCode: "", error: `Error processing guardians: ${error}` };
      }
    } else if (storageType === "shared") {
      requestData = {
        owner: owners.map(o => o.getPrefixedAddress()),
        ownersHash,
        factoryAddress: config.factoryAddress,
        //if beaconSalt is not provided, it will be set to 0
        beaconSalt: config.beaconSalt || "0",
        guardians: config._guardians,
        guardianId: config._guardianId!,
        moduleAddress: config._module,
        salt,
        chainId: this.chainId,
      };
    } else {
      return { initCode: "", error: "Invalid storage type" };
    }

    Logger.getInstance().debug("requestData inside getInitCode: ", requestData);

    // Call backend to retrieve init code
    const response = await this.backendCaller.retrieveInitCode(requestData);
    return {
      initCode: response.initCode,
      error: response.error
    };
  }

  /**
   * Sends a user operation to the bundler through the backend service.
   * Optionally provide webhook data for notification of operation status.
   * 
   * @param builder - The user operation builder
   * @param webhookData - Optional webhook data for notifications
   * @returns The operation hash, task ID, or error
   */
  public async sendUserOperation(
    builder: IUserOperationBuilder,
    webhookData?: IWebHookRequest
  ): Promise<ISendUserOpResponse> {
    const op = builder.getOp();
    // Convert BigInt values to strings
    const serializedOp = {
      ...op,
      nonce: op.nonce.toString(),
      callGasLimit: op.callGasLimit.toString(),
      verificationGasLimit: op.verificationGasLimit.toString(),
      preVerificationGas: op.preVerificationGas.toString(),
      maxFeePerGas: op.maxFeePerGas.toString(),
      maxPriorityFeePerGas: op.maxPriorityFeePerGas.toString()
    };

    const response = await this.backendCaller.sendUserOp({
      ...serializedOp,
      webhookData,
      chainId: this.chainId.toString(),
    });

    return {
      userOpHash: response.userOpHash,
      taskId: response.taskId,
      error: response.error,
    };
  }

  /**
   * Prepares a user operation to send ETH to a recipient.
   * Convenience wrapper around prepareSendTransactions for ETH transfers.
   * 
   * @param recipientAddress - The recipient address
   * @param amount - The amount of ETH to send
   * @param opts - Optional user operation parameters
   * @returns A builder with the partially constructed user operation
   */
  async prepareSendETH(
    recipientAddress: string,
    amount: BigNumberish,
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    return (await this.prepareSendTransactions(
      [{ to: recipientAddress, value: amount, data: "0x" }],
      opts
    ));

  }

  /**
   * Prepares a user operation to send ERC20 tokens to a recipient.
   * Encodes an ERC20 transfer call and prepares it for execution.
   * 
   * @param contractAddress - The ERC20 token contract address
   * @param recipientAddress - The recipient address
   * @param amount - The amount of tokens to send
   * @param opts - Optional user operation parameters
   * @returns A builder with the partially constructed user operation
   */
  public async prepareSendERC20(
    contractAddress: string,
    recipientAddress: string,
    amount: BigNumberish,
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    const erc20Interface = new ethers.Interface([
      "function transfer(address to, uint256 amount) returns (bool)"
    ]);
    const calldata = erc20Interface.encodeFunctionData("transfer", [
      recipientAddress,
      amount
    ]);

    return (await this.prepareSendTransactions(
      [{ to: contractAddress, value: 0, data: calldata }],
      opts
    ));
  }

  /**
   * Waits for a user operation to be completed and returns its receipt.
   * Internally retrieves the task ID for the operation, then waits for task completion.
   * 
   * @param userOpHash - The hash of the user operation
   * @param timeoutMs - Timeout in milliseconds (default 100 seconds)
   * @returns The operation receipt or error
   */
  public async waitOP(
    userOpHash: string,
    timeoutMs: number = 100000
  ): Promise<IUserOperationReceiptResponse> {
    if (userOpHash === null) {
      return {
        receipt: {} as IUserOperationReceipt,
        error: "No userOpHash provided",
      };
    }
    let responseCaller = await this.backendCaller.getTaskFromUserOpHash(
      userOpHash
    );
    if (responseCaller.error) {
      return {
        receipt: {} as IUserOperationReceipt,
        error: responseCaller.error,
      };
    }
    const taskId = responseCaller.taskId;
    let response = await this.waitTask(taskId, timeoutMs);

    if (response.reason !== undefined) {
      return { receipt: {} as IUserOperationReceipt, error: response.reason };
    }
    return {
      receipt: response.receipt as unknown as IUserOperationReceipt,
      error: response.reason,
    };
  }

  /**
   * Waits for a task to be completed via WebSocket connection.
   * Opens a WebSocket connection to the backend and waits for task status updates.
   * 
   * @param taskId - The ID of the task to wait for
   * @param timeoutMs - Timeout in milliseconds (default 100 seconds)
   * @returns The task result containing status, receipt, and reason
   */
  public async waitTask(
    taskId: string,
    timeoutMs: number = 100000
  ): Promise<IWaitTaskResponse> {
    return new Promise((resolve, reject) => {
      let backendUrl = this.backendCaller.backendUrl;
      if (backendUrl.startsWith("http")) {
        backendUrl = "ws" + backendUrl.slice(4);
      }
      const url = `${backendUrl}/ws/task?id=${taskId}`;
      const socket = new WebSocket(url, [
        `auth.jwt.${this.backendCaller.apiKey}`,
      ]);

      // Set a timeout to close the socket after timeoutMs
      const timeout = setTimeout(() => {
        socket.close();
        reject({ error: "Timeout" });
      }, timeoutMs);

      socket.onopen = () => {
        // Connection opened
        Logger.getInstance().debug("WebSocket connection opened");
      };

      socket.onmessage = (event) => {
        const res = JSON.parse(event.data as string) as IWaitTaskResponse;

        Logger.getInstance().debug("🚀 task result from websocket:", res.operationStatus);
        if (res === undefined || res == null) {
          reject({ error: "No response from server" });
        }

        const { operationStatus, reason, receipt } = res;

        //if task is pending or unhandled, wait
        if (!["PENDING", "UNHANDLED"].includes(operationStatus)) {
          // Close the socket
          socket.close();
          // Clear timeout
          clearTimeout(timeout);
          // Resolve the promise
          resolve({
            operationStatus: operationStatus,
            receipt: receipt,
            reason: reason,
          });
        }
      };

      socket.onerror = (error) => {
        // An error occurred
        Logger.getInstance().error("WebSocket error: ", error);
      };

      socket.onclose = (event) => {
        // Connection was closed
        Logger.getInstance().debug("WebSocket connection closed: ", event.code, event.reason);
      };
    });
  }

  /**
   * Builds a complete user operation from a builder object.
   * Finalizes all fields and prepares the operation for submission.
   * 
   * @param builder - The user operation builder
   * @returns The built user operation
   */
  async buildUserOperation(builder: IUserOperationBuilder) {
    return builder.buildOp(await this.entryPoint.getAddress(), this.chainId);
  }

  /**
   * Fills a user operation with necessary data based on the provided calldata.
   * Sets sender, calldata, gas parameters, and other fields required for a valid operation.
   * 
   * @param callData - The calldata for the user operation
   * @param opts - Optional user operation parameters
   * @returns A builder with the filled user operation
   * @throws If provider is not connected
   */
  async fillUserOperation(
    callData: string,
    opts?: IUserOperationOptions
  ): Promise<UserOperationBuilder> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    let builder = new UserOperationBuilder();
    builder.setSender(this.account.address);
    builder.setCallData(callData);
    // let verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT;
    // let callGasLimit = BigInt(0);

    if (opts?.initCode !== undefined) {
      Logger.getInstance().debug("initCode inside fillUserOperation: ", opts.initCode);
      builder.setInitCode(opts.initCode);
      builder.setNonce(0);
    } else if (await this.account.isCounterfactual(this.provider)) {
      const initCodeResponse = await this.getInitCode();
      if (initCodeResponse.error) {
        throw new Error("Error getting init code: " + initCodeResponse.error);
      }
      Logger.getInstance().debug("initCodeResponse.initCode inside fillUserOperation: ", initCodeResponse.initCode);
      builder.setInitCode(initCodeResponse.initCode);
      builder.setNonce(0);

    }
    else {
      //No init code case
      let internalNonce;
      if (opts?.nonceOP !== undefined) {
        internalNonce = opts.nonceOP;
      } else {
        internalNonce = (await this.getNonSequentialAccountNonce()).nonce;
      }
      builder.setNonce(internalNonce);
      Logger.getInstance().debug("nonceSDK inside fillUserOperation", internalNonce);
    }

    // First set maxFeePerGas and maxPriorityFeePerGas
    if (opts?.maxFeePerGas) {
      builder.setMaxFeePerGas(opts.maxFeePerGas);
    } else {
      if (builder.getMaxFeePerGas() == BigInt(0)) {
        const block = await this.provider.getBlock("latest");
        Logger.getInstance().debug("maxPriorityFeePerGas", builder.getMaxPriorityFeePerGas());
        builder.setMaxFeePerGas(
          block?.baseFeePerGas! + BigInt(builder.getMaxPriorityFeePerGas())
        );
      }
    }
    if (opts?.maxPriorityFeePerGas) {
      builder.setMaxPriorityFeePerGas(opts.maxPriorityFeePerGas);
    }

    //TODO: handle overrides better
    //setting a dummy signature to avoid the error from bundler
    const signature = await this.account.signer.createDummySignature();
    builder.setSignature(signature);
    const response = await this.backendCaller.estimateUserOpGas({
      ...builder.getOp(),
      chainId: this.chainId.toString(),
    });

    // Set gas values from backend response
    builder.setCallGasLimit(BigInt(response.gasEstimate.result.callGasLimit));
    builder.setVerificationGasLimit(BigInt(response.gasEstimate.result.verificationGasLimit));
    builder.setPreVerificationGas(BigInt(response.gasEstimate.result.preVerificationGas));

    // Override with provided optional values
    if (opts?.preVerificationGas) {
      builder.setPreVerificationGas(opts.preVerificationGas);
    }
    if (opts?.verificationGasLimit) {
      builder.setVerificationGasLimit(opts.verificationGasLimit);
    }
    if (opts?.callGasLimit) {
      builder.setCallGasLimit(opts.callGasLimit);
    }

    return builder;
  }

  /**
   * Gets the hash of a user operation.
   * Calculates the hash that uniquely identifies the operation on-chain.
   * 
   * @param builder - The user operation builder
   * @returns The operation hash
   * @throws If provider is not connected
   */
  public async getUserOperationHash(
    builder: IUserOperationBuilder
  ): Promise<IGetUserOperationHashResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const op = builder.getOp();
    const chainId = await this.provider.getNetwork().then((net) => net.chainId);
    const message = new UserOperationMiddlewareCtx(
      op,
      await this.entryPoint.getAddress(),
      chainId
    ).getUserOpHash();
    return { userOpHash: message };
  }

  /**
   * Signs a user operation with the connected account's signer.
   * Gets the operation hash and signs it with the account's private key.
   * 
   * @param builder - The user operation builder
   * @returns The signature, operation hash, or error
   * @throws If provider is not connected
   */
  async signUserOperation(
    builder: IUserOperationBuilder
  ): Promise<ISignUserOperationResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    if (this.account.signer === undefined) {
      return {
        signature: "",
        userOpHash: "",
        error: "No signer available, create or connect account first",
      };
    }
    const op = builder.getOp();
    const chainId = await this.provider.getNetwork().then((net) => net.chainId);
    const message = new UserOperationMiddlewareCtx(
      op,
      await this.entryPoint.getAddress(),
      chainId
    ).getUserOpHash();

    const signature = await this.account.signer.signMessage(getBytes(message));

    builder.setSignature(signature);
    return {
      signature: signature,
      userOpHash: message,
    };
  }

  /**
   * Sends a user operation directly to the bundler and optionally waits for its inclusion.
   * Provides both dry-run capability and actual submission with monitoring.
   * 
   * @param builder - The user operation builder
   * @param timeoutMs - Timeout in milliseconds for waiting (default 100 seconds)
   * @param waitIntervalMs - Interval in milliseconds between checks while waiting (default 5 seconds)
   * @param opts - Optional sending parameters
   * @returns The operation hash and a wait function
   * @throws If provider is not connected
   */
  async sendUserOperationBundler(
    builder: IUserOperationBuilder,
    timeoutMs: number = 100000,
    waitIntervalMs: number = 5000,
    opts?: ISendUserOperationOpts
  ) {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const dryRun = Boolean(opts?.dryRun);
    const op = await this.buildUserOperation(builder);
    opts?.onBuild?.(op);

    const userOpHash = dryRun
      ? new UserOperationMiddlewareCtx(
        op,
        await this.entryPoint.getAddress(),
        this.chainId
      ).getUserOpHash()
      : ((await this.provider.send("eth_sendUserOperation", [
        OpToJSON(op),
        await this.entryPoint.getAddress(),
      ])) as string);
    builder.resetOp();

    return {
      userOpHash,
      wait: async () => {
        if (dryRun) {
          return null;
        }
        const end = Date.now() + timeoutMs;
        const block = await this.provider!.getBlock("latest");
        while (Date.now() < end) {
          const events = await this.entryPoint.queryFilter(
            this.entryPoint.filters.UserOperationEvent(userOpHash),
            Math.max(0, block?.number! - 100)
          );
          if (events.length > 0) {
            return events[0];
          }
          await new Promise((resolve) => setTimeout(resolve, waitIntervalMs));
        }

        return null;
      },
    };
  }

  /**
   * Verifies the signature of a webhook request.
   * Validates that the request body matches the hash and checks the signature.
   * 
   * @param req - The webhook request with body and signature headers
   * @param verifyingKey - Optional custom verification key
   * @returns True if the signature is valid, false otherwise
   * @static
   */
  public static verifyWebhookSignature(
    req: IWebHookSignatureRequest,
    verifyingKey?: string
  ): boolean {
    const curve = new EC("secp256k1");

    const computedMsgBodyHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body))
      .digest("hex");

    const hash = req.headers.encodedMessage;

    // Checking if the computed hash matches the one in the headers
    if (computedMsgBodyHash != hash) {
      Logger.getInstance().debug("Computed hash does not match the hash in the headers");

      return false;
    }

    // Use verifyingKey if it's provided, otherwise use the default key
    const publicKey = curve.keyFromPublic(
      verifyingKey
        ? verifyingKey
        //prod key
        : "04e450bafe7e0772618749f7dcb1c941a62454103bcb11741d22125099e6f4cf7094fc2f40eab745c578f51e21b32683e1a285f9806c86929c92a98fbd50c96d71",
      //dev key
      // : "041294b0d86c27e213d1678b2fe8c7a4296971c16671004596e59dcf13f9c940995a67a0b928a875dcb615cdc28048ae95e11a516a6caac35f0ef65c328d4d7f60",
      "hex"
    );
    const outcome = publicKey.verify(hash, req.headers.signature);

    // If the signature is not valid, return invalid signature
    if (!outcome) {
      Logger.getInstance().warn("Invalid signature");
    }

    return outcome;
  }

  /**
   * Prepares a delegated transaction without sending it.
   * This function creates the necessary data for a delegated transaction that can be sent later.
   * 
   * @param transactions - The transactions to send
   * @param opts - Optional parameters for the delegated transaction
   * @returns An object implementing ISendDelegatedTransactionsRequest
   * @throws If no account is connected or no chainId is available
   */
  public async prepareDelegatedTransactions(
    transactions: ICall[],
    opts?: IDelegatedTransactionOptions
  ): Promise<ISendDelegatedTransactionsRequest> {
    let chainId = opts?.chainId || this.chainId;
    if (chainId === undefined || chainId === 0) {
      throw new Error("No chainId provided, either pass chainId in options or connect to a provider");
    }
    if (this.account.address === "0x") {
      throw new Error("No account available, create or connect account first");
    }

    const calldataMulticall = this.account.module.getCalldataMulticall(
      this.account.address,
      transactions,
      opts?.doNotRevertOnTxFailure
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

    return {
      accountAddress: this.account.address,
      chainId: chainId.toString(),
      moduleAddress: this.account.module.address,
      data: calldataMulticall,
      nonce: nonce,
      deadline: deadline,
      sigs: signature,
      webhookData: opts?.webhookData
    };
  }

  /**
   * Prepares contract deployment transactions and calculates their addresses
   * @param params Array of objects containing bytecode and optional salt
   * @returns Object containing arrays of calculated addresses and deployment transactions
   * These can be used with either prepareSendTransactions or prepareDelegatedTransactions
   * @throws If provider is not connected
   */
  public async prepareContractDeploymentTransactions(
    params: Array<{
      bytecode: string;
      salt?: string;
    }>
  ): Promise<{
    expectedAddresses: string[];
    deployTxs: ICall[];
  }> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }

    const deployer = new IndidDeployer(Number(this.chainId));
    const deployerAddress = deployer.address;

    const results = await Promise.all(
      params.map(async ({ bytecode, salt }) => {
        // Use provided salt or default to "0"
        const finalSalt = salt || "0";

        // Calculate the expected deployment address
        const calculatedAddress = await this.provider!.call({
          to: deployerAddress,
          data: deployer.calculateExpectedDeployAddress(finalSalt, bytecode)
        }).then(result => {
          // Extract address from result (skip '0x' prefix and take last 40 chars)
          return `0x${result.slice(-40)}`;
        });

        // Create deployment transaction data
        const deployTransaction: ICall = {
          to: deployerAddress,
          value: 0,
          data: deployer.getDeployTxCalldata(finalSalt, bytecode)
        };

        return {
          calculatedAddress,
          deployTransaction
        };
      })
    );

    // Separate results into arrays of addresses and transactions
    return {
      expectedAddresses: results.map(r => r.calculatedAddress),
      deployTxs: results.map(r => r.deployTransaction)
    };
  }
}
