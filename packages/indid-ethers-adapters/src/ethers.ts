'use client'
import * as React from 'react'
import { type WalletClient, useWalletClient } from 'wagmi'
import { providers } from 'ethers'

//TODO: update this to use the new sdk

export function walletClientToSigner(walletClient: WalletClient): providers.JsonRpcSigner {
  const { account, chain, transport } = walletClient
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new providers.Web3Provider(transport as providers.Web3Provider["provider"], network)
  const signer = provider.getSigner(account.address)
  return signer
}


type UseEthersSigner = Omit<ReturnType<typeof useWalletClient>, "data"> & {data: providers.JsonRpcSigner | undefined }

/** Hook to convert a viem Wallet Client to an ethers.js Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}): UseEthersSigner  {
  const { data: walletClient, ...rest } = useWalletClient({ chainId })
  const signer : providers.JsonRpcSigner | undefined = React.useMemo<any>(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient],
  )

  return {data: signer, ...rest}
}
