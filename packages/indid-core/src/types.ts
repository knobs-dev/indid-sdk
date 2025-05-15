// import { UserOperationEventEvent } from "@indid/indid-typechains/dist/EntryPoint";
import { BigNumberish, BytesLike } from "ethers";
import { LogLevel } from "./utils";
import { IndidAddress } from "./address";

/**
 * Interface for user operation structure compliant with EIP-4337.
 * @param sender The account making the operation
 * @param nonce Account nonce
 * @param initCode Code to be deployed for account creation
 * @param callData The data passed to the sender during execution
 * @param callGasLimit Gas limit for the main execution
 * @param verificationGasLimit Gas limit for the verification step
 * @param preVerificationGas Gas to compensate bundlers for pre-verification
 * @param maxFeePerGas Maximum total fee per gas (similar to EIP-1559)
 * @param maxPriorityFeePerGas Maximum priority fee per gas (similar to EIP-1559)
 * @param paymasterAndData Paymaster contract address and additional data
 * @param signature Signature authorizing the operation
 * @param chainId Optional chain ID to prevent replay attacks
 */
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


/**
 * Interface for building user operations with a fluent API.
 * Provides methods to get/set fields, use middleware, and build operations.
 */
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

/**
 * Function type for middleware that can modify user operations during building.
 * @param context The middleware context containing the operation and related data
 */
export type UserOperationMiddlewareFn = (
  context: IUserOperationMiddlewareCtx
) => Promise<void>;

/**
 * Context provided to middleware functions when building user operations.
 * @param op The user operation being built
 * @param entryPoint The entry point address
 * @param chainId The blockchain chain ID
 * @param getUserOpHash Function to get the operation's unique hash
 */
export interface IUserOperationMiddlewareCtx {
  op: IUserOperation;
  entryPoint: string;
  chainId: BigNumberish;

  // A userOpHash is a unique hash of op + entryPoint + chainId.
  getUserOpHash: () => string;
}

/**
 * Configuration options for the Indid client.
 * @param apiKey API key for authentication
 * @param rpcUrl Optional RPC URL for blockchain connection
 * @param chainId Optional blockchain chain ID
 * @param overrideBundlerRpc Optional custom bundler RPC endpoint
 * @param overrideBackendUrl Optional custom backend URL
 * @param overrideEntryPoint Optional custom entry point address
 * @param logLevel Optional logging verbosity level
 */
export interface IClientConfig {
  apiKey: string;
  rpcUrl?: string;
  chainId?: BigNumberish;
  overrideBundlerRpc?: string;
  overrideBackendUrl?: string;
  overrideEntryPoint?: string;
  logLevel?: LogLevel
}


/**
 * Options for creating an account.
 * @param storageType: the storage type of the account, either "standard" or "shared"
 * @param moduleType: the module type of the account, either "user" or "enterprise"
 * @param factoryAddress: the factory address of the account
 * @param moduleAddress: the module address of the account
 * @param guardians: the guardians of the account
 * @param beaconId: the beacon id for shared storage accounts
 */
export interface ICreateAccountOpts {
  storageType: string;
  moduleType: string;
  factoryAddress: string;
  moduleAddress: string;
  guardians: IndidAddress[];
  beaconId?: BytesLike;
}

/**
 * Options for connecting to an existing account.
 * @param moduleType The module type of the account, either "user" or "enterprise"
 * @param moduleAddress The module address of the account
 * @param storageType The storage type of the account, either "standard" or "shared"
 * @param factoryAddress The factory address of the account
 * @param accountVersion The version of the account contract
 * @param moduleVersion The version of the module contract
 * @param chainId Optional blockchain chain ID
 */
export interface IConnectAccountOpts {
  moduleType: string;
  moduleAddress: string;
  storageType: string;
  factoryAddress: string;
  accountVersion: string;
  moduleVersion: string;
  chainId?: BigNumberish;
}

/**
 * Options for sending user operations.
 * @param dryRun Whether to simulate the operation without executing
 * @param onBuild Optional callback function executed after building the operation
 */
export interface ISendUserOperationOpts {
  dryRun?: boolean;
  onBuild?: (op: IUserOperation) => Promise<any> | any;
}

/**
 * Event data structure for user operations.
 * @param userOpHash Unique hash of the user operation
 * @param sender Address of the account that initiated the operation
 * @param paymaster Address of the paymaster that sponsored the operation, if any
 * @param nonce The account nonce used for the operation
 * @param success Whether the operation executed successfully
 * @param actualGasCost The actual cost of gas used for the operation
 * @param actualGasUsed The amount of gas used for the operation
 */
export interface IUserOperationEvent {
  userOpHash: string;
  sender: string;
  paymaster: string;
  nonce: BigNumberish;
  success: boolean;
  actualGasCost: BigNumberish;
  actualGasUsed: BigNumberish;
}

/**
 * Response object for sending a user operation.
 * @param userOpHash Unique hash of the submitted user operation
 * @param wait Function that returns a promise resolving to the operation event when completed
 */
export interface ISendUserOperationResponse {
  userOpHash: string;
  wait: () => Promise<IUserOperationEvent | null>;
}

/**
 * Options for preset operation builders.
 * @param entryPoint Optional entry point contract address
 * @param factory Optional factory contract address
 * @param paymasterMiddleware Optional middleware for handling paymaster operations
 * @param overrideBundlerRpc Optional custom bundler RPC endpoint
 */
export interface IPresetBuilderOpts {
  entryPoint?: string;
  factory?: string;
  paymasterMiddleware?: UserOperationMiddlewareFn;
  overrideBundlerRpc?: string;
}

/**
 * Structure representing a contract call.
 * @param to Target contract address
 * @param value Amount of native token to send with the call
 * @param data Encoded calldata
 */
export interface ICall {
  to: string;
  value: BigNumberish;
  data: BytesLike;
}

/**
 * Request parameters for generating initialization code.
 * @param owners Array of owner addresses
 * @param factoryAddress Optional factory contract address
 * @param guardiansHash Optional hash of the guardians' addresses
 * @param guardianId Optional ID of the guardian structure
 * @param moduleAddress Optional module address
 * @param salt Optional salt for address generation
 * @param chainId Blockchain chain ID
 */
export interface IInitCodeRequest {
  owner: string[];
  factoryAddress?: string;
  guardiansHash?: BytesLike;
  guardianId?: BytesLike;
  moduleAddress?: string;
  salt?: string;
  chainId: BigNumberish;
}

/**
 * Response for counterfactual address calculation.
 * @param accountAddress The calculated address
 * @param error Optional error message if calculation failed
 */
export interface IGetCounterfactualAddressResponse {
  accountAddress: string;
  error?: string;
}

/**
 * Request structure for webhook configuration.
 * @param tag Identifier tag for the webhook
 * @param metadata Optional additional data for the webhook
 */
export interface IWebHookRequest {
  tag: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request parameters for account recovery.
 * @param newOwner Address of the new owner
 * @param walletAddress Address of the wallet being recovered
 * @param chainId Blockchain chain ID
 * @param signature Authorization signature
 * @param nonce Nonce value to prevent replay attacks
 * @param deadline Number of seconds after which the request is invalid
 * @param webhookData Optional webhook configuration
 */
export interface IRecoverAccountRequest {
  newOwner: string;
  walletAddress: string;
  chainId: BigNumberish;
  signature: string;
  nonce: string;
  deadline: number;
  webhookData?: IWebHookRequest;
}

/**
 * Response for account recovery request.
 * @param taskId Unique identifier for tracking the recovery task
 * @param error Optional error message if recovery request failed
 */
export interface IRecoverAccountResponse {
  taskId: string;
  error?: string;
}

/**
 * Request parameters for creating an account.
 * @param factoryAddress Optional factory contract address
 * @param owners Array of owner addresses
 * @param _guardians Optional array of guardian addresses
 * @param _guardianId Optional ID , either guardians hash or beacon id
 * @param _module Optional module address
 * @param salt Optional salt for address generation
 * @param webhookData Optional webhook configuration
 * @param chainId Blockchain chain ID
 */
export interface ICreateAccountRequest {
  factoryAddress?: string;
  owner: string[];
  _guardians?: string[];
  _guardianId?: BytesLike;
  _module?: string;
  salt?: string;
  webhookData?: IWebHookRequest;
  chainId: BigNumberish;
}

/**
 * Response for account creation request.
 * @param accountAddress Address of the created account
 * @param taskId Unique identifier for tracking the creation task
 * @param error Optional error message if creation failed
 */
export interface ICreateAccountResponse {
  accountAddress: string;
  taskId: string;
  error?: string;
}

/**
 * Response for creating and connecting to an account.
 * @param accountAddress Address of the created account
 * @param taskId Unique identifier for tracking the creation task
 * @param error Optional error message if creation or connection failed
 */
export interface ICreateAndConnectAccountResponse {
  accountAddress: string;
  taskId: string;
  error?: string;
}

/**
 * Response for initialization code generation.
 * @param initCode The generated initialization code
 * @param error Optional error message if generation failed
 */
export interface IInitCodeResponse {
  initCode: string;
  error?: string;
}

/**
 * Response for retrieving task ID from a user operation hash.
 * @param taskId The task ID associated with the operation hash
 * @param error Optional error message if retrieval failed
 */
export interface IGetTaskFromUserOpHashResponse {
  taskId: string;
  error?: string;
}

/**
 * Response for user operation sponsorship request.
 * @param paymasterAndData Encoded paymaster data for the sponsored operation
 * @param error Optional error message if sponsorship failed
 */
export interface IUserOpSponsorshipResponse {
  paymasterAndData: string;
  error?: string;
}

/**
 * Request parameters for checking operation status.
 * @param opHash Hash of the operation to check
 * @param chainId Blockchain chain ID
 */
export interface IOPStatusRequest {
  opHash: string;
  chainId: BigNumberish;
}

/**
 * Response for operation status check.
 * @param receipt Receipt of the executed operation
 * @param error Optional error message if status check failed
 */
export interface IOpStatusResponse {
  receipt: IUserOperationReceipt;
  error?: string;
}

/**
 * Request parameters for sending a user operation.
 * @param builder The operation builder instance
 * @param webhookData Optional webhook configuration
 */
export interface ISendUserOpRequest {
  builder: IUserOperationBuilder;
  webhookData?: IWebHookRequest;
}

/**
 * Bundled request parameters for sending a user operation.
 * @param chainId Blockchain chain ID
 * @param webhookData Optional webhook configuration
 * (Plus all IUserOperation properties)
 */
export interface IBSendUserOpRequest extends IUserOperation {
  chainId: BigNumberish;
  webhookData?: IWebHookRequest;
}

/**
 * Response for user operation submission.
 * @param userOpHash Hash of the submitted operation
 * @param taskId Unique identifier for tracking the operation task
 * @param error Optional error message if submission failed
 */
export interface ISendUserOpResponse {
  userOpHash: string;
  taskId: string;
  error?: string;
}

/**
 * Response for retrieving SDK default values.
 * @param factoryAddress Default factory address
 * @param _module Default module address
 * @param moduleType Default module type
 * @param _guardians Default guardian addresses
 * @param _guardiansHash Default hash of guardians
 * @param _guardianId Default beacon ID
 * @param storageType Default storage type
 * @param accountVersion Default account contract version
 * @param error Optional error message if retrieval failed
 */
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

/**
 * Request parameters for retrieving account information.
 * @param accountAddress Address of the account
 * @param chainId Blockchain chain ID
 */
export interface IGetAccountInfoRequest {
  accountAddress: string;
  chainId: BigNumberish;
}

/**
 * Response for account information retrieval.
 * @param factoryAddress Factory address of the account
 * @param moduleAddress Module address of the account
 * @param storageType Storage type of the account
 * @param moduleType Module type of the account
 * @param initCode Initialization code of the account
 * @param accountVersion Version of the account contract
 * @param moduleVersion Version of the module contract
 * @param owners Optional array of owner addresses
 * @param ownersHash Optional hash of owner addresses
 * @param guardians Optional array of guardian addresses
 * @param guardiansHash Optional hash of guardian addresses
 * @param guardianStructId Optional ID of the guardian structure
 * @param error Optional error message if retrieval failed
 */
export interface IGetAccountInfoResponse {
  factoryAddress: string;
  moduleAddress: string;
  storageType: string;
  moduleType: string;
  initCode: string;
  accountVersion: string;
  moduleVersion: string;
  owner?: string[];
  ownersHash?: string;
  guardians?: string[];
  guardiansHash?: string;
  guardianStructId?: string;
  error?: string;
}

/**
 * Response for account connection request.
 * @param error Optional error message if connection failed
 */
export interface IConnectAccountResponse {
  error?: string;
}

/**
 * Request parameters for webhook signature verification.
 * @param headers HTTP headers containing signature and encoded message
 * @param body Request body data
 */
export interface IWebHookSignatureRequest {
  headers: {
    signature: string;
    encodedMessage: string;
  };
  body: Record<string, unknown>;
}

/**
 * Enumeration of possible user operation statuses.
 */
export enum TaskUserOperationStatus {
  PENDING = "PENDING",
  EXECUTED = "EXECUTED",
  REVERTED = "REVERTED",
  UNHANDLED = "UNHANDLED",
  FAILED = "FAILED",
  TIMEOUT = "TIMEOUT",
}

/**
 * Response for waiting on a task to complete.
 * @param operationStatus Current status of the operation
 * @param receipt Optional receipt of the executed operation
 * @param reason Optional reason for failure or reversion
 */
export interface IWaitTaskResponse {
  operationStatus: TaskUserOperationStatus;
  receipt?: JSON;
  reason?: string;
}

/**
 * Structure of a user operation receipt.
 * @param blockHash Hash of the block containing the operation
 * @param logsBloom Bloom filter of the logs
 * @param contractAddress Address of the contract emitting the logs
 * @param transactionIndex Index of the transaction in the block
 * @param transactionHash Hash of the transaction
 * @param gasUsed Amount of gas used by the transaction
 * @param blockNumber Number of the block containing the transaction
 * @param cumulativeGasUsed Cumulative gas used in the block
 * @param from Address that sent the transaction
 * @param blockTimestamp Timestamp of the block
 * @param to Recipient address of the transaction
 * @param logs Array of logs emitted by the transaction
 * @param status Execution status (1 for success, 0 for failure)
 */
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

/**
 * Response for user operation receipt retrieval.
 * @param receipt The operation receipt
 * @param error Optional error message if retrieval failed
 */
export interface IUserOperationReceiptResponse {
  receipt: IUserOperationReceipt;
  error?: string;
}

/**
 * Response for nonce retrieval.
 * @param nonce The retrieved nonce value
 * @param error Optional error message if retrieval failed
 */
export interface IGetNonceResponse {
  nonce: BigNumberish;
  error?: string;
}

/**
 * Response for user operation hash calculation.
 * @param userOpHash The calculated operation hash
 * @param error Optional error message if calculation failed
 */
export interface IGetUserOperationHashResponse {
  userOpHash: string;
  error?: string;
}

/**
 * Response for user operation signature.
 * @param userOpHash Hash of the signed operation
 * @param signature The generated signature
 * @param error Optional error message if signing failed
 */
export interface ISignUserOperationResponse {
  userOpHash: string;
  signature: string;
  error?: string;
}

/**
 * Options for customizing user operations.
 * @param initCode Optional initialization code
 * @param nonceOP Optional nonce value
 * @param doNotRevertOnTxFailure Optional flag to continue execution even if one of the transactions fails
 * @param deadlineSeconds Optional timeout in seconds
 * @param callGasLimit Optional gas limit for the main execution
 * @param verificationGasLimit Optional gas limit for verification
 * @param preVerificationGas Optional gas for pre-verification processes
 * @param maxFeePerGas Optional maximum fee per gas
 * @param maxPriorityFeePerGas Optional maximum priority fee per gas
 */
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

/**
 * Options for delegated transactions.
 * @param chainId Optional blockchain chain ID
 * @param doNotRevertOnTxFailure Optional flag to continue execution even if one of the transactions fails
 * @param deadlineSeconds Optional timeout in seconds
 * @param webhookData Optional webhook configuration
 */
export interface IDelegatedTransactionOptions {
  chainId?: BigNumberish;
  doNotRevertOnTxFailure?: boolean;
  deadlineSeconds?: number;
  webhookData?: IWebHookRequest;
}

/**
 * Request parameters for sending delegated transactions.
 * @param accountAddress Address of the account
 * @param chainId Blockchain chain ID
 * @param moduleAddress Address of the module
 * @param data Encoded transaction calldata
 * @param nonce Nonce value to prevent replay attacks
 * @param deadline Number of seconds after which the request is invalid
 * @param sigs Signatures authorizing the transaction
 * @param webhookData Optional webhook configuration
 */
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

/**
 * Response for delegated transaction submission.
 * @param taskId Unique identifier for tracking the transaction task
 * @param error Optional error message if submission failed
 */
export interface ISendDelegatedTransactionsResponse {
  taskId: string;
  error?: string;
}


//minimal abis
//TODO: move this to separate location

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
