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
  EntryPointMinimalABI
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
  UserOperationBuilder,
} from "./builder";

import { ec as EC } from "elliptic";
import * as crypto from "crypto";
import { IndidSigner } from "./signer";

export class Client {
  public provider?: BundlerJsonRpcProvider;
  public backendCaller: BackendCaller;

  public entryPointAddress: string;
  // public guardiansHash: ethers.BytesLike;
  // public guardianStructId: ethers.BytesLike;
  // public guardians: string[];

  public entryPoint: ethers.Contract;
  public chainId: BigNumberish;
  public account: IndidAccount;

  protected constructor(config: IClientConfig) {
    // if (config.overrideBundlerRpc) {
    //   this.provider = new BundlerJsonRpcProvider(config.overrideBundlerRpc).setBundlerRpc(
    //     config.overrideBundlerRpc
    //     // "http://localhost:3000/rpc"
    //   );
    // }

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

  public static async init(config: IClientConfig) {
    const instance = new Client(config);
    await this.initialize(instance, config);
    return instance;
  }

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

    instance.backendCaller.backendUrl =
      config.overrideBackendUrl || "https://api.indid.io";

    Logger.getInstance().setLogLevel(config.logLevel || LogLevel.NONE);
    Logger.getInstance().debug(`EntryPointAddress: ${instance.entryPointAddress}`);
    Logger.getInstance().debug(`Backend url: ${instance.backendCaller.backendUrl}`);

  }

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

  public async getCounterfactualAddress(
    owner: string,
    salt: string = "0",
    opts?: ICreateAccountOpts
  ): Promise<IGetCounterfactualAddressResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    let response = await this.getInitCode(owner, salt, opts);

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
      //TODO: owners and ownersHash should probably be passed here
      this.account = new IndidAccount({
        signer: signer,
        version: opts.accountVersion as AccountVersion,
        address: accountAddress,
        module: module,
        factoryAddress: opts.factoryAddress
      });
      //TODO: factoryAddress is only useful is the account is a counterfactual
      // this.guardians = opts.guardians;
      // this.guardiansHash = opts.guardiansHash;
      // this.guardianStructId = opts.guardianStructId;
      return {};
    }
    else {
      const response = await this.backendCaller.getAccountInfo({ accountAddress: accountAddress, chainId: chainId.toString() });
      Logger.getInstance().debug("response backend caller getAccountInfo: ", response);
      //TODO: check that response.owners should contain the signer address
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

  public async prepareSendTransactions(
    transactions: ICall[],
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    //TODO: check that signer or account address is set

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

  public async prepareEnterpriseRecoveryOperation(
    accountAddress: string,
    newOwner: string,
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    if (this.account.signer === undefined) {
      throw new Error("No signer available, create or connect account first");
    }
    if (this.account.module.moduleType !== "enterprise") {
      throw new Error("Only enterprise module is supported");
    }


    const calldataRecovery = this.account.module.getCalldataTransferOwnership(accountAddress, newOwner);

    const deadline = Date.now() + (opts?.deadlineSeconds || 60 * 60);
    let { signature, nonce } = await this.account.signer.signEIP712Transaction(
      accountAddress,
      this.account.module.address,
      calldataRecovery,
      deadline,
      this.chainId
    );

    const builder = await this.prepareSendModuleOperation(
      calldataRecovery,
      nonce,
      deadline,
      signature,
      opts
    );
    return builder;
  }

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


  //TODO: the owner should be passed prefixed, is this ok?
  public async getInitCode(
    owner?: string,
    salt: string = "0",
    opts?: ICreateAccountOpts
  ): Promise<IInitCodeResponse> {
    // If account already exists, fetch its init code from backend
    if (this.account.address !== "0x") {
      const response = await this.backendCaller.getAccountInfo({
        accountAddress: this.account.address, 
        chainId: this.chainId.toString()
      });
      return { initCode: response.initCode, error: response.error };
    }

    // Handle case when owner address is not provided
    if (owner === undefined) {
      if (!this.account.signer) {
        return {
          initCode: "",
          error: "No signer available, provide owner address",
        };
      }
      
      try {
        owner = await this.account.signer.getAddress();
      } catch (error) {
        return {
          initCode: "",
          error: "Unable to retrieve signer address, please provide owner address",
        };
      }
      
      if (!owner) {
        return {
          initCode: "",
          error: "Unable to retrieve signer address, please provide owner address",
        };
      }
    }

    // Set up configuration using options or defaults from account
    const config: ICreateAccountOpts = opts ? { ...opts } : {
      factoryAddress: this.account.factoryAddress,
      moduleAddress: this.account.module.address,
      guardians: this.account.guardians,
      moduleType: this.account.module.moduleType,
      storageType: this.account.module.storageType
    };
    
    const storageType = config.storageType;

    let requestData: IInitCodeRequest;


    //TODO: revisit storage handling
    // Handle standard storage type
    if (storageType === "standard") {
      // Determine guardians hash
      if (opts?.guardiansHash) {
        config.guardiansHash = opts.guardiansHash;
      } else if (opts?.guardians) {
        // Pack and hash guardians using ethers v6 methods
        const packedGuardiansArray = ethers.solidityPacked(
          ["address[]"],
          [opts.guardians]
        );
        config.guardiansHash = ethers.keccak256(packedGuardiansArray);
      } else if (!opts && this.account.module) {
        // Try to use guards hash from account module
        const guardians = this.account.guardians;
        if (guardians && guardians.length > 0) {
          const packedGuardiansArray = ethers.solidityPacked(
            ["address[]"],
            [guardians]
          );
          config.guardiansHash = ethers.keccak256(packedGuardiansArray);
        } else {
          return {
            initCode: "",
            error: "No guardians available in account",
          };
        }
      } else {
        return {
          initCode: "",
          error: "No guardiansHash or guardians provided",
        };
      }

      requestData = {
        owner: owner,
        factoryAddress: config.factoryAddress,
        guardiansHash: config.guardiansHash,
        moduleAddress: config.moduleAddress,
        salt: salt,
        chainId: this.chainId,
      };
    } 
    // Handle shared storage type
    else if (storageType === "shared") {
      if (opts?.beaconId) {
        config.beaconId = opts.beaconId;
      } else if (!opts && this.account.beaconId) {
        config.beaconId = this.account.beaconId;
      } else {
        return { 
          initCode: "", 
          error: "No beaconId provided" 
        };
      }

      requestData = {
        owner: owner,
        factoryAddress: config.factoryAddress,
        guardianId: config.beaconId,
        moduleAddress: config.moduleAddress,
        salt: salt,
        chainId: this.chainId,
      };
    } 
    // Handle invalid storage type
    else {
      return { 
        initCode: "", 
        error: "Invalid storage type" 
      };
    }

    // Call backend to retrieve init code
    const response = await this.backendCaller.retrieveInitCode(requestData);
    return { 
      initCode: response.initCode, 
      error: response.error 
    };
  }

  public async sendUserOperation(
    builder: IUserOperationBuilder,
    webhookData?: IWebHookRequest
  ): Promise<ISendUserOpResponse> {
    const response = await this.backendCaller.sendUserOp({
      ...builder.getOp(),
      webhookData,
      chainId: this.chainId,
    });

    return {
      userOpHash: response.userOpHash,
      taskId: response.taskId,
      error: response.error,
    };
  }

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

  async buildUserOperation(builder: IUserOperationBuilder) {
    return builder.buildOp(await this.entryPoint.getAddress(), this.chainId);
  }

  async fillUserOperation(
    callData: string,
    opts?: IUserOperationOptions
  ): Promise<UserOperationBuilder> {
    //TODO: all the gas part should be rewritten to use the native estimateGas from the bundler
    if (!this.provider) {
      //TODO: the provider is only needed for the sequential nonce if we use the bundler for the estimateGas
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    let builder = new UserOperationBuilder();
    builder.setSender(this.account.address);
    builder.setCallData(callData);
    let verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT;
    let callGasLimit = BigInt(0);

    if (opts?.initCode !== undefined) {
      builder.setInitCode(opts.initCode);
      builder.setNonce(0);
      const factoryAddr = dataSlice(opts.initCode, 0, 20);
      const initCallData = dataSlice(opts.initCode, 20);

      const initEstimate = await this.provider.estimateGas({
        from: await this.entryPoint.getAddress(),
        to: factoryAddr,
        data: initCallData,
        gasLimit: 10e6,
      });

      verificationGasLimit = verificationGasLimit + initEstimate;

      //GAS: adding a flat 1e6 gas to the callGasLimit because the estimate when using initCode is not always accurate
      callGasLimit = callGasLimit + BigInt(1e6);
    } else {
      //No init code case
      let internalNonce;
      if (opts?.nonceOP !== undefined) {
        internalNonce = opts.nonceOP;
      } else {
        internalNonce = (await this.getNonSequentialAccountNonce()).nonce;
      }
      builder.setNonce(internalNonce);
      Logger.getInstance().debug("nonceSDK inside fillUserOperation", internalNonce);

      //TODO: this should change depending on the curve, 
      //specifically if the precompile is used or not
      verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT;
      if (opts?.callGasLimit === undefined) {
        // callGasLimit = await this.provider.estimateGas({
        //   from: await this.entryPoint.getAddress(),
        //   to: this.accountAddress,
        //   data: callData,
        // });
        callGasLimit = BigInt(1e6)//TODO: get gaslimit from bundler through backend
      }
    }

    if (opts?.callGasLimit) {
      builder.setCallGasLimit(opts.callGasLimit);
    } else {
      builder.setCallGasLimit(callGasLimit);
    }
    if (opts?.preVerificationGas) {
      builder.setPreVerificationGas(opts.preVerificationGas);
    } else {
      builder.setPreVerificationGas(DEFAULT_PRE_VERIFICATION_GAS);
    }
    if (opts?.verificationGasLimit) {
      builder.setVerificationGasLimit(opts.verificationGasLimit);
    } else {
      builder.setVerificationGasLimit(verificationGasLimit);
    }
    if (opts?.maxFeePerGas) {
      builder.setMaxFeePerGas(opts.maxFeePerGas);
    } else {
      if (builder.getMaxFeePerGas() == BigInt(0)) {
        const block = await this.provider.getBlock("latest");
        builder.setMaxFeePerGas(
          block?.baseFeePerGas! + BigInt(builder.getMaxPriorityFeePerGas())
        );
      }
    }
    if (opts?.maxPriorityFeePerGas) {
      builder.setMaxPriorityFeePerGas(opts.maxPriorityFeePerGas);
    }

    if (builder.getMaxFeePerGas() == BigInt(0)) {
      const block = await this.provider.getBlock("latest");
      Logger.getInstance().debug(
        "block.baseFeePerGas",
        Number(block?.baseFeePerGas?.toString() ?? "0")
      );

      Logger.getInstance().debug("maxPriorityFeePerGas", builder.getMaxPriorityFeePerGas());
      builder.setMaxFeePerGas(
        block?.baseFeePerGas! + BigInt(builder.getMaxPriorityFeePerGas())
      );
    }

    return builder;
  }

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

  public static verifyWebhookSignature(
    req: IWebHookSignatureRequest,
    verifyingKey?: string
  ): boolean {
    //TODO: maybe add log level to the static methods params
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
}
