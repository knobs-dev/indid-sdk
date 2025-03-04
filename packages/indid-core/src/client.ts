import { BigNumber, BigNumberish, ethers } from "ethers";
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
} from "./types";
import { LogLevel, Logger, OpToJSON, signEIP712Transaction } from "./utils";
import { UserOperationMiddlewareCtx } from "./context";
import { EntryPointAddress } from "./constants";
import { BundlerJsonRpcProvider } from "./provider";
import { BackendCaller } from "./backendCaller";
import {
  solidityKeccak256,
  solidityPack,
  arrayify,
  hexDataSlice,
} from "ethers/lib/utils";
import WebSocket from "isomorphic-ws";

import {
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  UserOperationBuilder,
} from "./builder";

import {
  EnterpriseModule__factory,
  ERC20__factory,
  EntryPoint,
  EntryPoint__factory,
  SimpleAccount__factory,
  UsersModule__factory,
} from "@indid/indid-typechains";

import { ec as EC } from "elliptic";
import * as crypto from "crypto";

export class Client {
  public provider?: BundlerJsonRpcProvider;
  public backendCaller: BackendCaller;
  public signer?: ethers.providers.JsonRpcSigner | ethers.Wallet | any;
  public entryPointAddress: string;
  public accountAddress: string;
  public moduleAddress: string;
  public factoryAddress: string;
  public guardiansHash: ethers.utils.BytesLike;
  public guardianStructId: ethers.utils.BytesLike;
  public storageType: string;
  public moduleType: string;
  public guardians: string[];

  public entryPoint: EntryPoint;
  public chainId: BigNumberish;

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
    this.accountAddress = "0x";
    this.moduleAddress = "0x";
    this.factoryAddress = "0x";
    this.guardiansHash = "0x";
    this.guardianStructId = "0x";
    this.storageType = "";
    this.moduleType = "";
    this.guardians = [];
    this.chainId = 0;
    this.entryPoint = "0x" as any;
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
        .then((network) => ethers.BigNumber.from(network.chainId));

      //This line of code is setting entryPointAddress based on the first truthy value found among the following, in order:
      instance.entryPointAddress = config.overrideEntryPoint || EntryPointAddress[Number(instance.chainId)] || EntryPointAddress[137];

      instance.entryPoint = EntryPoint__factory.connect(
        instance.entryPointAddress,
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

    const response = await instance.backendCaller.retrieveSdkDefaults(instance.chainId);

    if (response.error) {
      throw new Error(response.error);
    }
    else {

      instance.moduleAddress = response._module;
      instance.factoryAddress = response.factoryAddress;
      instance.storageType = response.storageType;
      instance.guardians = response._guardians;
      if (instance.storageType === "standard") {
        instance.guardiansHash = response._guardiansHash;
      }
      if (instance.storageType === "shared") {
        instance.guardianStructId = response._guardianId;
      }
      instance.moduleType = response.moduleType;
    }
  }

  public async connectProvider(rpcUrl: string) {
    this.provider = new BundlerJsonRpcProvider(rpcUrl);
    this.entryPoint = EntryPoint__factory.connect(
      this.entryPointAddress,
      this.provider
    );
    this.chainId = await this.provider
      .getNetwork()
      .then((network) => ethers.BigNumber.from(network.chainId));

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
      if (this.accountAddress === "0x") {
        return {
          nonce: "",
          error:
            "No account address available, provide one or connect a smart contract account first",
        };
      }
      accountAddress = this.accountAddress;
    }

    const account = SimpleAccount__factory.connect(
      accountAddress,
      this.provider
    );
    return { nonce: await account.getNonce() };
  }


  public async getNonSequentialAccountNonce(
    accountAddress?: string
  ): Promise<IGetNonceResponse> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    if (accountAddress === undefined) {
      if (this.accountAddress === "0x") {
        return {
          nonce: "",
          error:
            "No account address available, provide one or connect a smart contract account first",
        };
      }
      accountAddress = this.accountAddress;
    }

    const entryPoint = EntryPoint__factory.connect(
      this.entryPointAddress,
      this.provider
    );

    //generate 192 random bits for the key
    const key = ethers.utils.hexlify(ethers.utils.randomBytes(24));

    return { nonce: await entryPoint.getNonce(this.accountAddress, key) };
  }

  public async connectAccount(
    signer: ethers.Wallet | ethers.providers.JsonRpcSigner,
    accountAddress: string,
    opts?: IConnectAccountOpts
  ): Promise<IConnectAccountResponse> {
    this.signer = signer;
    this.accountAddress = accountAddress;
    if (this.chainId === 0 && opts?.chainId === undefined) {
      return {
        error: "No chainId provided, either pass chainId in options or connect to a provider",
      }
    }
    let chainId = opts?.chainId || this.chainId;

    if (opts != null) {
      this.moduleAddress = opts.moduleAddress;
      this.moduleType = opts.moduleType;
      this.storageType = opts.storageType;
      this.factoryAddress = opts.factoryAddress;
      //TODO: factoryAddress is only useful is the account is a counterfactual
      // this.guardians = opts.guardians;
      // this.guardiansHash = opts.guardiansHash;
      // this.guardianStructId = opts.guardianStructId;
      return {};
    }
    else {
      const response = await this.backendCaller.getAccountInfo({ accountAddress: accountAddress, chainId: chainId.toString() });
      Logger.getInstance().debug("response backend caller getAccountInfo: ", response);
      this.moduleAddress = response.moduleAddress;
      this.moduleType = response.moduleType;
      this.storageType = response.storageType;
      this.factoryAddress = response.factoryAddress;
      // this.guardians = response.guardians;
      // this.guardiansHash = response.guardiansHash;
      // this.guardianStructId = response.guardianStructId;

      return {
        error: response.error,
      };
    }
  }

  public async prepareSendTransactions(
    to: string[],
    value: BigNumberish[],
    calldata: string[],
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const transactions: ICall[] = [];
    for (let i = 0; i < to.length; i++) {
      transactions.push({
        to: to[i],
        value: value[i],
        data: calldata[i],
      });
    }



    const account = SimpleAccount__factory.connect(
      this.accountAddress,
      this.provider
    );

    Logger.getInstance().debug("moduleType: ", this.moduleType);
    let module;
    let multiCallGasEstimated;
    if (this.moduleType === "enterprise") {
      module = EnterpriseModule__factory.connect(
        this.moduleAddress,
        this.provider
      );
    } else if (this.moduleType === "users") {
      module = UsersModule__factory.connect(this.moduleAddress, this.provider);
    }

    else {
      throw new Error("Invalid module type");
    }

    const calldataMulticall = (
      await module!.populateTransaction[
        opts?.doNotRevertOnTxFailure ? "multiCallNoRevert" : "multiCall"
      ](this.accountAddress, transactions)
    ).data!;

    if (opts?.initCode === undefined && opts?.callGasLimit === undefined) {
      let totalGasEstimated = BigNumber.from(0);
      for (let i = 0; i < transactions.length; i++) {
        const gasEstimated = await this.provider.estimateGas({
          from: this.accountAddress,
          to: to[i],
          data: calldata[i],
          value: value[i],
        });

        totalGasEstimated = totalGasEstimated.add(gasEstimated);
        Logger.getInstance().debug(
          "inner transaction gasEstimated for tx: ",
          i,
          gasEstimated.toString()
        );
      }

      Logger.getInstance().debug(
        "total inner transactions estimated gas:",
        totalGasEstimated.toString()
      );

      multiCallGasEstimated = await this.provider.estimateGas({
        from: this.moduleAddress,
        to: this.moduleAddress,
        data: calldataMulticall,
      });

      Logger.getInstance().debug(
        "multicall transaction gasEstimated",
        multiCallGasEstimated.toString()
      );
    }

    const currentTime = Math.round(new Date().getTime() / 1000);
    const deadline = currentTime + (opts?.deadlineSeconds || 60 * 60);
    const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));

    const calldataOp = (
      await account.populateTransaction.invokeModule(
        this.moduleAddress,
        calldataMulticall,
        nonce,
        deadline,
        "0x"
      )
    ).data!;

    let builder = await this.fillUserOperation(
      calldataOp,
      multiCallGasEstimated,
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
    if (this.signer === undefined) {
      throw new Error("No signer available, create or connect account first");
    }
    if (this.moduleType !== "enterprise") {
      throw new Error("Only enterprise module is supported");
    }

    const module = EnterpriseModule__factory.connect(
      this.moduleAddress,
      this.signer
    );

    const calldataRecovery = (
      await module.populateTransaction.transferOwnership(
        accountAddress,
        newOwner
      )
    ).data!;

    const deadline = Date.now() + (opts?.deadlineSeconds || 60 * 60);
    let { signature, nonce } = await signEIP712Transaction(
      accountAddress,
      this.moduleAddress,
      calldataRecovery,
      deadline,
      this.chainId,
      [this.signer]
    );

    const builder = await this.prepareSendModuleOperation(
      calldataRecovery,
      nonce,
      deadline.toString(),
      signature,
      opts
    );
    return builder;
  }

  public async prepareSendModuleOperation(
    calldata: string,
    nonce: string,
    deadline: string,
    signatures: string,
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    const account = SimpleAccount__factory.connect(
      this.accountAddress,
      this.provider
    );

    let sigs = "0x";
    if (signatures !== undefined) {
      sigs = signatures;
    }

    const calldataOp = (
      await account.populateTransaction.invokeModule(
        this.moduleAddress,
        calldata,
        nonce,
        deadline,
        sigs
      )
    ).data!;

    let builder = await this.fillUserOperation(calldataOp, undefined, opts);

    return builder;
  }

  public async getInitCode(
    owner?: string,
    salt: string = "0",
    opts?: ICreateAccountOpts
  ): Promise<IInitCodeResponse> {
    if (this.accountAddress !== "0x") {

      const response = await this.backendCaller.getAccountInfo({ accountAddress: this.accountAddress, chainId: this.chainId.toString() })

      return { initCode: response.initCode, error: response.error };
    }


    if (owner === undefined) {
      if (this.signer === undefined) {
        return {
          initCode: "",
          error: "No signer available, provide owner address",
        };
      } else {
        owner = await this.signer.getAddress();
        if (owner === undefined) {
          return {
            initCode: "",
            error:
              "Unable to retrieve signer address, signer might not have getAddress method, please provide owner address",
          };
        }
      }
    }

    let config = { ...opts };

    if (opts == null) {

      config.factoryAddress = this.factoryAddress;
      config.moduleAddress = this.moduleAddress;
      config.guardians = this.guardians;
      config.moduleType = this.moduleType;
      config.storageType = this.storageType;
    }

    let requestData: IInitCodeRequest;

    if (config.storageType === "standard") {
      if (opts != null) {
        if (opts.guardiansHash !== undefined) {
          config.guardiansHash = opts.guardiansHash;
        } else if (opts.guardians !== undefined) {
          const packedGuardiansArray = solidityPack(
            ["address[]"],
            this.guardians
          );
          config.guardiansHash = solidityKeccak256(
            ["bytes"],
            [packedGuardiansArray]
          );
        } else {
          return {
            initCode: "",
            error: "No guardiansHash or guardians provided",
          };
        }
      } else {
        config.guardiansHash = this.guardiansHash;
      }
      requestData = {
        owner: owner!,
        factoryAddress: config.factoryAddress,
        guardiansHash: config.guardiansHash,
        moduleAddress: config.moduleAddress,
        salt: salt,
        chainId: this.chainId,
      };

    } else if (this.storageType === "shared") {
      if (opts != null) {
        if (opts.guardianStructId === undefined) {
          return { initCode: "", error: "No guardianStructId provided" };
        }
        config.guardianStructId = opts.guardianStructId;
      } else {
        config.guardianStructId = this.guardianStructId;
      }
      requestData = {
        owner: owner!,
        factoryAddress: config.factoryAddress,
        guardianId: config.guardianStructId,
        moduleAddress: config.moduleAddress,
        salt: salt,
        chainId: this.chainId,
      };

    } else {
      return { initCode: "", error: "Invalid storage type" };
    }
    //TODO: if the owner/salt combo already exist in the db all other request data is ignored by the backend
    const response = await this.backendCaller.retrieveInitCode(requestData);
    return { initCode: response.initCode, error: response.error };

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
    if (this.signer === undefined) {
      throw new Error("No signer available, create or connect account first");
    }

    const builder = await this.prepareSendTransactions(
      [recipientAddress],
      [amount],
      ["0x"],
      opts
    );

    return builder;
  }

  public async prepareSendERC20(
    contractAddress: string,
    recipientAddress: string,
    amount: BigNumberish,
    opts?: IUserOperationOptions
  ): Promise<IUserOperationBuilder> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    if (this.signer === undefined) {
      throw new Error("No signer available, create or connect account first");
    }

    const erc20 = ERC20__factory.connect(contractAddress, this.provider);
    const calldata = (
      await erc20.populateTransaction.transfer(recipientAddress, amount)
    ).data!;

    const builder = await this.prepareSendTransactions(
      [contractAddress],
      [0],
      [calldata],
      opts
    );

    return builder;
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
    return builder.buildOp(this.entryPoint.address, this.chainId);
  }

  async fillUserOperation(
    callData: string,
    multiCallGasEstimated?: BigNumber,
    opts?: IUserOperationOptions
  ): Promise<UserOperationBuilder> {
    if (!this.provider) {
      throw new Error("Provider has not been connected, please use the connectProvider function");
    }
    let builder = new UserOperationBuilder();
    builder.setSender(this.accountAddress);
    builder.setCallData(callData);
    let verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT;
    let callGasLimit = ethers.constants.Zero;

    if (opts?.initCode !== undefined) {
      builder.setInitCode(opts.initCode);
      builder.setNonce(ethers.BigNumber.from(0));
      const factoryAddr = hexDataSlice(opts.initCode, 0, 20);
      const initCallData = hexDataSlice(opts.initCode, 20);

      const initEstimate = await this.provider.estimateGas({
        from: this.entryPoint.address,
        to: factoryAddr,
        data: initCallData,
        gasLimit: 10e6,
      });

      verificationGasLimit = verificationGasLimit.add(initEstimate);

      //GAS: adding a flat 1e6 gas to the callGasLimit because the estimate when using initCode is not always accurate
      callGasLimit = callGasLimit.add(1e6);
    } else {
      //No init code case
      const account = SimpleAccount__factory.connect(
        this.accountAddress,
        this.signer!
      );
      let internalNonce;
      if (opts?.nonceOP !== undefined) {
        internalNonce = opts.nonceOP;
      } else {
        internalNonce = (await this.getNonSequentialAccountNonce()).nonce;
      }
      builder.setNonce(internalNonce);
      Logger.getInstance().debug("nonceSDK inside fillUserOperation", internalNonce);

      verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT;
      if (opts?.callGasLimit === undefined) {
        const gasEstimated = await this.provider.estimateGas({
          from: this.entryPoint.address,
          to: this.accountAddress,
          data: callData,
        });
        Logger.getInstance().debug("outer gasEstimated", gasEstimated.toString());
        if (
          multiCallGasEstimated !== undefined &&
          multiCallGasEstimated.gt(gasEstimated)
        ) {
          callGasLimit = multiCallGasEstimated;
        } else {
          callGasLimit = gasEstimated;
        }
        //GAS: adding a flat 5e5 gas to the callGasLimit because the estimate is not always accurate
        callGasLimit = callGasLimit.add(5e5);
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
      if (builder.getMaxFeePerGas() == ethers.constants.Zero) {
        const block = await this.provider.getBlock("latest");
        builder.setMaxFeePerGas(
          block.baseFeePerGas!.add(builder.getMaxPriorityFeePerGas())
        );
      }
    }
    if (opts?.maxPriorityFeePerGas) {
      builder.setMaxPriorityFeePerGas(opts.maxPriorityFeePerGas);
    }

    if (builder.getMaxFeePerGas() == ethers.constants.Zero) {
      const block = await this.provider.getBlock("latest");
      Logger.getInstance().debug(
        "block.baseFeePerGas",
        Number(block.baseFeePerGas!.toString())
      );

      Logger.getInstance().debug("maxPriorityFeePerGas", builder.getMaxPriorityFeePerGas());
      builder.setMaxFeePerGas(
        block.baseFeePerGas!.add(builder.getMaxPriorityFeePerGas())
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
      this.entryPoint.address,
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
    if (this.signer === undefined) {
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
      this.entryPoint.address,
      chainId
    ).getUserOpHash();

    const signature = await this.signer!.signMessage(arrayify(message));

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
        this.entryPoint.address,
        this.chainId
      ).getUserOpHash()
      : ((await this.provider.send("eth_sendUserOperation", [
        OpToJSON(op),
        this.entryPoint.address,
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
            Math.max(0, block.number - 100)
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

    //FIXME: add "changed default webhook key to prod key" to the commit message
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
