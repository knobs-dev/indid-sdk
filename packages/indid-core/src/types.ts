// import { UserOperationEventEvent } from "@indid/indid-typechains/dist/EntryPoint";
import { BigNumberish, BytesLike } from "ethers";
import { LogLevel } from "./utils";

export interface IUserOperation {
  sender: string;
  nonce: BigNumberish;
  initCode: BytesLike;
  callData: BytesLike;
  callGasLimit: BigNumberish;
  verificationGasLimit: BigNumberish;
  preVerificationGas: BigNumberish;
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
  paymasterAndData: BytesLike;
  signature: BytesLike;
  chainId?: BigNumberish;
}


export interface IUserOperationBuilder {
  // get methods.
  getSender: () => string;
  getNonce: () => BigNumberish;
  getInitCode: () => BytesLike;
  getCallData: () => BytesLike;
  getCallGasLimit: () => BigNumberish;
  getVerificationGasLimit: () => BigNumberish;
  getPreVerificationGas: () => BigNumberish;
  getMaxFeePerGas: () => BigNumberish;
  getMaxPriorityFeePerGas: () => BigNumberish;
  getPaymasterAndData: () => BytesLike;
  getSignature: () => BytesLike;
  getOp: () => IUserOperation;

  // set methods.
  setSender: (address: string) => IUserOperationBuilder;
  setNonce: (nonce: BigNumberish) => IUserOperationBuilder;
  setInitCode: (code: BytesLike) => IUserOperationBuilder;
  setCallData: (data: BytesLike) => IUserOperationBuilder;
  setCallGasLimit: (gas: BigNumberish) => IUserOperationBuilder;
  setVerificationGasLimit: (gas: BigNumberish) => IUserOperationBuilder;
  setPreVerificationGas: (gas: BigNumberish) => IUserOperationBuilder;
  setMaxFeePerGas: (fee: BigNumberish) => IUserOperationBuilder;
  setMaxPriorityFeePerGas: (fee: BigNumberish) => IUserOperationBuilder;
  setPaymasterAndData: (data: BytesLike) => IUserOperationBuilder;
  setSignature: (bytes: BytesLike) => IUserOperationBuilder;
  setPartial: (partialOp: Partial<IUserOperation>) => IUserOperationBuilder;

  // Sets the default values that won't be wiped on reset.
  useDefaults: (partialOp: Partial<IUserOperation>) => IUserOperationBuilder;
  resetDefaults: () => IUserOperationBuilder;

  // Some fields may require arbitrary logic to build an op.
  // Middleware functions allow you to set custom logic for building op fragments.
  useMiddleware: (fn: UserOperationMiddlewareFn) => IUserOperationBuilder;
  resetMiddleware: () => IUserOperationBuilder;

  // This will construct a UserOperation that can be sent to a client.
  // It will run through your entire middleware stack in the process.
  buildOp: (
    entryPoint: string,
    chainId: BigNumberish
  ) => Promise<IUserOperation>;

  // Will reset all fields back to default value.
  resetOp: () => IUserOperationBuilder;
}

export type UserOperationMiddlewareFn = (
  context: IUserOperationMiddlewareCtx
) => Promise<void>;

export interface IUserOperationMiddlewareCtx {
  op: IUserOperation;
  entryPoint: string;
  chainId: BigNumberish;

  // A userOpHash is a unique hash of op + entryPoint + chainId.
  getUserOpHash: () => string;
}

export interface IClientConfig {
  apiKey: string;
  rpcUrl?: string;
  chainId?: BigNumberish;
  overrideBundlerRpc?: string;
  overrideBackendUrl?: string;
  overrideEntryPoint?: string;
  logLevel?: LogLevel
}


export interface ICreateAccountOpts {
  storageType: string;
  moduleType: string;
  factoryAddress: string;
  moduleAddress: string;
  guardians: string[];
  guardiansHash?: BytesLike;
  beaconId?: BytesLike;
}

export interface IConnectAccountOpts {
  moduleType: string;
  moduleAddress: string;
  storageType: string;
  factoryAddress: string;
  accountVersion: string;
  moduleVersion: string;
  chainId?: BigNumberish;
}

export interface ISendUserOperationOpts {
  dryRun?: boolean;
  onBuild?: (op: IUserOperation) => Promise<any> | any;
}

export interface IUserOperationEvent {
  userOpHash: string;
  sender: string;
  paymaster: string;
  nonce: BigNumberish;
  success: boolean;
  actualGasCost: BigNumberish;
  actualGasUsed: BigNumberish;
}

export interface ISendUserOperationResponse {
  userOpHash: string;
  wait: () => Promise<IUserOperationEvent | null>;
}

export interface IPresetBuilderOpts {
  entryPoint?: string;
  factory?: string;
  paymasterMiddleware?: UserOperationMiddlewareFn;
  overrideBundlerRpc?: string;
}

export interface ICall {
  to: string;
  value: BigNumberish;
  data: BytesLike;
}

export interface IInitCodeRequest {
  owner: string;
  factoryAddress?: string;
  guardiansHash?: BytesLike;
  guardianId?: BytesLike;
  moduleAddress?: string;
  salt?: string;
  chainId: BigNumberish;
}

export interface IGetCounterfactualAddressResponse {
  accountAddress: string;
  error?: string;
}

export interface IWebHookRequest {
  tag: string;
  metadata?: Record<string, unknown>;
}

export interface IRecoverAccountRequest {
  newOwner: string;
  walletAddress: string;
  chainId: BigNumberish;
  signature: string;
  nonce: string;
  deadline: number;
  webhookData?: IWebHookRequest;
}

export interface IRecoverAccountResponse {
  taskId: string;
  error?: string;
}

export interface ICreateAccountRequest {
  factoryAddress?: string;
  owner: string;
  _guardians?: string[];
  _guardianId?: BytesLike;
  _module?: string;
  salt?: string;
  webhookData?: IWebHookRequest;
  chainId: BigNumberish;
}

export interface ICreateAccountResponse {
  accountAddress: string;
  taskId: string;
  error?: string;
}

export interface ICreateAndConnectAccountResponse {
  accountAddress: string;
  taskId: string;
  seed?: string;
  error?: string;
}

export interface IInitCodeResponse {
  initCode: string;
  error?: string;
}

export interface IGetTaskFromUserOpHashResponse {
  taskId: string;
  error?: string;
}

export interface IUserOpSponsorshipResponse {
  paymasterAndData: string;
  error?: string;
}

export interface IOPStatusRequest {
  opHash: string;
  chainId: BigNumberish;
}

export interface IOpStatusResponse {
  receipt: IUserOperationReceipt;
  error?: string;
}

export interface ISendUserOpRequest {
  builder: IUserOperationBuilder;
  webhookData?: IWebHookRequest;
}

export interface IBSendUserOpRequest extends IUserOperation {
  chainId: BigNumberish;
  webhookData?: IWebHookRequest;
}
export interface ISendUserOpResponse {
  userOpHash: string;
  taskId: string;
  error?: string;
}

export interface IRetrieveSdkDefaultsResponse {
  factoryAddress: string;
  _module: string;
  moduleType: string;
  _guardians: string[];
  _guardiansHash: string;
  _guardianId: string;
  storageType: string;
  accountVersion: string;
  error?: string;
}

export interface IGetAccountInfoRequest {
  accountAddress: string;
  chainId: BigNumberish;
}

export interface IGetAccountInfoResponse {
  factoryAddress: string;
  moduleAddress: string;
  storageType: string;
  moduleType: string;
  initCode: string;
  accountVersion: string;
  moduleVersion: string;
  owners?: string[];
  ownersHash?: string;
  guardians?: string[];
  guardiansHash?: string;
  guardianStructId?: string;
  error?: string;
}

export interface IConnectAccountResponse {
  error?: string;
}

export interface IWebHookSignatureRequest {
  headers: {
    signature: string;
    encodedMessage: string;
  };
  body: Record<string, unknown>;
}

export enum TaskUserOperationStatus {
  PENDING = "PENDING",
  EXECUTED = "EXECUTED",
  REVERTED = "REVERTED",
  UNHANDLED = "UNHANDLED",
  FAILED = "FAILED",
  TIMEOUT = "TIMEOUT",
}

export interface IWaitTaskResponse {
  operationStatus: TaskUserOperationStatus;
  receipt?: JSON;
  reason?: string;
}

export interface IUserOperationReceipt {
  blockHash: string;
  logsBloom: string;
  contractAddress: string;
  transactionIndex: number;
  transactionHash: string;
  gasUsed: BigNumberish;
  blockNumber: BigNumberish;
  cumulativeGasUsed: BigNumberish;
  from: string;
  blockTimestamp: string;
  to: string;
  logs: [{}];
  status: number;
}

export interface IUserOperationReceiptResponse {
  receipt: IUserOperationReceipt;
  error?: string;
}

export interface IGetNonceResponse {
  nonce: BigNumberish;
  error?: string;
}

export interface IGetUserOperationHashResponse {
  userOpHash: string;
  error?: string;
}

export interface ISignUserOperationResponse {
  userOpHash: string;
  signature: string;
  error?: string;
}

export interface IUserOperationOptions {
  initCode?: string;
  nonceOP?: BigNumberish;
  doNotRevertOnTxFailure?: boolean;
  deadlineSeconds?: number;
  callGasLimit?: BigNumberish;
  verificationGasLimit?: BigNumberish
  preVerificationGas?: BigNumberish;
  maxFeePerGas?: BigNumberish;
  maxPriorityFeePerGas?: BigNumberish;
}

export interface IDelegatedTransactionOptions {
  chainId?: BigNumberish;
  doNotRevertOnTxFailure?: boolean;
  deadlineSeconds?: number;
  webhookData?: IWebHookRequest;
}

export interface ISendDelegatedTransactionsRequest {
  accountAddress: string;
  chainId: BigNumberish;
  moduleAddress: string;
  data: BytesLike;
  nonce: BigNumberish;
  deadline: number;
  sigs: BytesLike;
  webhookData?: IWebHookRequest;
}

export interface ISendDelegatedTransactionsResponse {
  taskId: string;
  error?: string;
}


//minimal abis
//TODO: move this to separate location

// Add this minimal EntryPoint ABI with only the functions used in client.ts
export const EntryPointMinimalABI = [
  // For getNonce method
  {
    "inputs": [
      { "name": "sender", "type": "address" },
      { "name": "key", "type": "uint192" }
    ],
    "name": "getNonce",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // For getAddress method
  {
    "name": "getAddress",
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  // For UserOperationEvent
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "userOpHash", "type": "bytes32" },
      { "indexed": true, "name": "sender", "type": "address" },
      { "indexed": false, "name": "paymaster", "type": "address" },
      { "indexed": false, "name": "nonce", "type": "uint256" },
      { "indexed": false, "name": "success", "type": "bool" },
      { "indexed": false, "name": "actualGasCost", "type": "uint256" },
      { "indexed": false, "name": "actualGasUsed", "type": "uint256" }
    ],
    "name": "UserOperationEvent",
    "type": "event"
  }
];


export const ModuleMinimalABIV1 = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_wallet",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
          }
        ],
        "internalType": "struct EnterpriseTransactionManager.Call[]",
        "name": "_transactions",
        "type": "tuple[]"
      }
    ],
    "name": "multiCall",
    "outputs": [
      {
        "internalType": "bytes[]",
        "name": "",
        "type": "bytes[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_wallet",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
          }
        ],
        "internalType": "struct EnterpriseTransactionManager.Call[]",
        "name": "_transactions",
        "type": "tuple[]"
      }
    ],
    "name": "multiCallNoRevert",
    "outputs": [
      {
        "internalType": "bytes[]",
        "name": "",
        "type": "bytes[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // For ownership transfer
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_wallet",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
];
