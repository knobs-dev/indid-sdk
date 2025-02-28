import { BigNumberish, BytesLike, ethers } from "ethers";
import { OpToJSON } from "./utils";
import { UserOperationMiddlewareCtx } from "./context";
import {
  IUserOperation,
  IUserOperationBuilder,
  UserOperationMiddlewareFn,
} from "./types";

export const DEFAULT_VERIFICATION_GAS_LIMIT = BigInt(150000);
export const DEFAULT_CALL_GAS_LIMIT = BigInt(35000);
export const DEFAULT_PRE_VERIFICATION_GAS = BigInt(60000);
export const MAX_PRIORITY_FEE_PER_GAS = BigInt(1e9);

export const DEFAULT_USER_OP: IUserOperation = {
  sender: ethers.ZeroAddress,
  nonce: BigInt(0),
  initCode: ethers.hexlify("0x"),
  callData: ethers.hexlify("0x"),
  callGasLimit: DEFAULT_CALL_GAS_LIMIT,
  verificationGasLimit: DEFAULT_VERIFICATION_GAS_LIMIT,
  preVerificationGas: DEFAULT_PRE_VERIFICATION_GAS,
  maxFeePerGas: BigInt(0),
  maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
  paymasterAndData: ethers.hexlify("0x"),
  signature: ethers.hexlify("0x"),
};

export class UserOperationBuilder implements IUserOperationBuilder {
  private defaultOp: IUserOperation;
  private currOp: IUserOperation;
  private middlewareStack: Array<UserOperationMiddlewareFn>;

  constructor() {
    this.defaultOp = { ...DEFAULT_USER_OP };
    this.currOp = { ...this.defaultOp };
    this.middlewareStack = [];
  }

  private resolveFields(op: Partial<IUserOperation>): Partial<IUserOperation> {
    const obj = {
      sender:
        op.sender !== undefined
          ? ethers.getAddress(op.sender)
          : undefined,
      nonce:
        op.nonce !== undefined ? BigInt(op.nonce) : undefined,
      initCode:
        op.initCode !== undefined
          ? ethers.hexlify(op.initCode)
          : undefined,
      callData:
        op.callData !== undefined
          ? ethers.hexlify(op.callData)
          : undefined,
      callGasLimit:
        op.callGasLimit !== undefined
          ? BigInt(op.callGasLimit)
          : undefined,
      verificationGasLimit:
        op.verificationGasLimit !== undefined
          ? BigInt(op.verificationGasLimit)
          : undefined,
      preVerificationGas:
        op.preVerificationGas !== undefined
          ? BigInt(op.preVerificationGas)
          : undefined,
      maxFeePerGas:
        op.maxFeePerGas !== undefined
          ? BigInt(op.maxFeePerGas)
          : undefined,
      maxPriorityFeePerGas:
        op.maxPriorityFeePerGas !== undefined
          ? BigInt(op.maxPriorityFeePerGas)
          : undefined,
      paymasterAndData:
        op.paymasterAndData !== undefined
          ? ethers.hexlify(op.paymasterAndData)
          : undefined,
      signature:
        op.signature !== undefined
          ? ethers.hexlify(op.signature)
          : undefined,
    };
    return Object.keys(obj).reduce(
      (prev, curr) =>
        (obj as any)[curr] !== undefined
          ? { ...prev, [curr]: (obj as any)[curr] }
          : prev,
      {}
    );
  }

  getSender() {
    return this.currOp.sender;
  }
  getNonce() {
    return this.currOp.nonce;
  }
  getInitCode() {
    return this.currOp.initCode;
  }
  getCallData() {
    return this.currOp.callData;
  }
  getCallGasLimit() {
    return this.currOp.callGasLimit;
  }
  getVerificationGasLimit() {
    return this.currOp.verificationGasLimit;
  }
  getPreVerificationGas() {
    return this.currOp.preVerificationGas;
  }
  getMaxFeePerGas() {
    return this.currOp.maxFeePerGas;
  }
  getMaxPriorityFeePerGas() {
    return this.currOp.maxPriorityFeePerGas;
  }
  getPaymasterAndData() {
    return this.currOp.paymasterAndData;
  }
  getSignature() {
    return this.currOp.signature;
  }
  getOp() {
    return this.currOp;
  }

  setSender(val: string) {
    this.currOp.sender = ethers.getAddress(val);
    return this;
  }
  setNonce(val: BigNumberish) {
    this.currOp.nonce = BigInt(val);
    return this;
  }
  setInitCode(val: BytesLike) {
    this.currOp.initCode = ethers.hexlify(val);
    return this;
  }
  setCallData(val: BytesLike) {
    this.currOp.callData = ethers.hexlify(val);
    return this;
  }
  setCallGasLimit(val: BigNumberish) {
    this.currOp.callGasLimit = BigInt(val);
    return this;
  }
  setVerificationGasLimit(val: BigNumberish) {
    this.currOp.verificationGasLimit = BigInt(val);
    return this;
  }
  setPreVerificationGas(val: BigNumberish) {
    this.currOp.preVerificationGas = BigInt(val);
    return this;
  }
  setMaxFeePerGas(val: BigNumberish) {
    this.currOp.maxFeePerGas = BigInt(val);
    return this;
  }
  setMaxPriorityFeePerGas(val: BigNumberish) {
    this.currOp.maxPriorityFeePerGas = BigInt(val);
    return this;
  }
  setPaymasterAndData(val: BytesLike) {
    this.currOp.paymasterAndData = ethers.hexlify(val);
    return this;
  }
  setSignature(val: BytesLike) {
    this.currOp.signature = ethers.hexlify(val);
    return this;
  }
  setPartial(partialOp: Partial<IUserOperation>) {
    this.currOp = { ...this.currOp, ...this.resolveFields(partialOp) };
    return this;
  }

  useDefaults(partialOp: Partial<IUserOperation>) {
    const resolvedOp = this.resolveFields(partialOp);
    this.defaultOp = { ...this.defaultOp, ...resolvedOp };
    this.currOp = { ...this.currOp, ...resolvedOp };

    return this;
  }
  resetDefaults() {
    this.defaultOp = { ...DEFAULT_USER_OP };
    return this;
  }

  useMiddleware(fn: UserOperationMiddlewareFn) {
    this.middlewareStack = [...this.middlewareStack, fn];
    return this;
  }
  resetMiddleware() {
    this.middlewareStack = [];
    return this;
  }

  async buildOp(entryPoint: string, chainId: BigNumberish) {
    const ctx = new UserOperationMiddlewareCtx(
      this.currOp,
      entryPoint,
      chainId
    );

    for (const fn of this.middlewareStack) {
      await fn(ctx);
    }
    this.setPartial(ctx.op);

    return OpToJSON(this.currOp);
  }

  resetOp() {
    this.currOp = { ...this.defaultOp };
    return this;
  }
}
