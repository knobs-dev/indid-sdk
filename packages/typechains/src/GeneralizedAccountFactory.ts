/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "./common";

export interface GeneralizedAccountFactoryInterface extends utils.Interface {
  functions: {
    "_entryPoint()": FunctionFragment;
    "accountImplementation()": FunctionFragment;
    "createAccount(address,address[],address,uint256)": FunctionFragment;
    "getAddress(address,uint256,bytes32,address)": FunctionFragment;
    "guardianStorage()": FunctionFragment;
    "init(address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "_entryPoint"
      | "accountImplementation"
      | "createAccount"
      | "getAddress"
      | "guardianStorage"
      | "init"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "_entryPoint",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "accountImplementation",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "createAccount",
    values: [string, string[], string, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "getAddress",
    values: [string, BigNumberish, BytesLike, string]
  ): string;
  encodeFunctionData(
    functionFragment: "guardianStorage",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "init", values: [string]): string;

  decodeFunctionResult(
    functionFragment: "_entryPoint",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "accountImplementation",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "createAccount",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getAddress", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "guardianStorage",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "init", data: BytesLike): Result;

  events: {};
}

export interface GeneralizedAccountFactory extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: GeneralizedAccountFactoryInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    _entryPoint(overrides?: CallOverrides): Promise<[string]>;

    accountImplementation(overrides?: CallOverrides): Promise<[string]>;

    createAccount(
      owner: string,
      _guardians: string[],
      _module: string,
      salt: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    getAddress(
      owner: string,
      salt: BigNumberish,
      guardians: BytesLike,
      _module: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    guardianStorage(overrides?: CallOverrides): Promise<[string]>;

    init(_wallet: string, overrides?: CallOverrides): Promise<[void]>;
  };

  _entryPoint(overrides?: CallOverrides): Promise<string>;

  accountImplementation(overrides?: CallOverrides): Promise<string>;

  createAccount(
    owner: string,
    _guardians: string[],
    _module: string,
    salt: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  getAddress(
    owner: string,
    salt: BigNumberish,
    guardians: BytesLike,
    _module: string,
    overrides?: CallOverrides
  ): Promise<string>;

  guardianStorage(overrides?: CallOverrides): Promise<string>;

  init(_wallet: string, overrides?: CallOverrides): Promise<void>;

  callStatic: {
    _entryPoint(overrides?: CallOverrides): Promise<string>;

    accountImplementation(overrides?: CallOverrides): Promise<string>;

    createAccount(
      owner: string,
      _guardians: string[],
      _module: string,
      salt: BigNumberish,
      overrides?: CallOverrides
    ): Promise<string>;

    getAddress(
      owner: string,
      salt: BigNumberish,
      guardians: BytesLike,
      _module: string,
      overrides?: CallOverrides
    ): Promise<string>;

    guardianStorage(overrides?: CallOverrides): Promise<string>;

    init(_wallet: string, overrides?: CallOverrides): Promise<void>;
  };

  filters: {};

  estimateGas: {
    _entryPoint(overrides?: CallOverrides): Promise<BigNumber>;

    accountImplementation(overrides?: CallOverrides): Promise<BigNumber>;

    createAccount(
      owner: string,
      _guardians: string[],
      _module: string,
      salt: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    getAddress(
      owner: string,
      salt: BigNumberish,
      guardians: BytesLike,
      _module: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    guardianStorage(overrides?: CallOverrides): Promise<BigNumber>;

    init(_wallet: string, overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    _entryPoint(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    accountImplementation(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    createAccount(
      owner: string,
      _guardians: string[],
      _module: string,
      salt: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    getAddress(
      owner: string,
      salt: BigNumberish,
      guardians: BytesLike,
      _module: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    guardianStorage(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    init(
      _wallet: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
