import { configureChains, createConfig } from 'wagmi'
import { polygonMumbai, mainnet } from 'wagmi/chains'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'

import { infuraProvider } from 'wagmi/providers/infura'


const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet, ...(process.env.NODE_ENV === 'development' ? [polygonMumbai] : [])],
  [
    infuraProvider({ apiKey: process.env.NEXT_PUBLIC_INFURA_API_KEY! }),
  ],
)

export const config = createConfig({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId:  process.env.NEXT_PUBLIC_WALLETCONNECT_API_KEY!,
      },
    })
    
  ],
  publicClient,
  webSocketPublicClient,
})
