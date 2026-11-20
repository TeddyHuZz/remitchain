/**
 * Environment and Web3 configuration settings for RemitChain.
 * Replace placeholders with your actual ZeroDev/Biconomy dashboard credentials.
 */

// We target Polygon Amoy Testnet for development Micro-remittances
export const WEB3_CONFIG = {
  // Polygon Amoy Chain ID is 80002
  CHAIN_ID: 80002,
  
  // Default to a placeholder project ID. Users can paste their actual ZeroDev Project ID here.
  ZERODEV_PROJECT_ID: process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID || "00000000-0000-0000-0000-000000000000",
  
  // Web3Auth Client ID, Redirect URL, and Network for Google login
  WEB3AUTH_CLIENT_ID: process.env.EXPO_PUBLIC_WEB3AUTH_CLIENT_ID || "",
  WEB3AUTH_REDIRECT_URL: "remitchain://auth",
  WEB3AUTH_CONNECTION_ID: process.env.EXPO_PUBLIC_WEB3AUTH_CONNECTION_ID || "",
  WEB3AUTH_NETWORK: process.env.EXPO_PUBLIC_WEB3AUTH_NETWORK || "sapphire_devnet",
  GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
  
  // RPC configurations for ZeroDev v3 Multi-Chain API
  BUNDLER_URL: (projectId: string, chainId = 80002) => `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}?selfFunded=true`,
  PAYMASTER_URL: (projectId: string, chainId = 80002) => `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}?selfFunded=true`,
  
  PUBLIC_RPC_URL: process.env.EXPO_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology/",

  BOOTH_REGISTRY_ADDRESS: process.env.EXPO_PUBLIC_BOOTH_REGISTRY_ADDRESS || "0x7bCB577350e600c1372036094f7F7464e54E90b6",
  USDC_ADDRESS: process.env.EXPO_PUBLIC_USDC_ADDRESS || "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  YIELD_VAULT_ADDRESS: process.env.EXPO_PUBLIC_YIELD_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000",
  REMITTANCE_ESCROW_ADDRESS: process.env.EXPO_PUBLIC_REMITTANCE_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000",

  USE_SIMULATION: true,
};
