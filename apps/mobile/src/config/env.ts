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
  WEB3AUTH_CLIENT_ID: process.env.EXPO_PUBLIC_WEB3AUTH_CLIENT_ID || "BPi5EEz5yocg37rxOBw4F67-CGRLR8443FfC6cEw4A2I5x88f8V_c7D",
  WEB3AUTH_REDIRECT_URL: "remitchain://auth",
  WEB3AUTH_CONNECTION_ID: process.env.EXPO_PUBLIC_WEB3AUTH_CONNECTION_ID || "",
  WEB3AUTH_NETWORK: process.env.EXPO_PUBLIC_WEB3AUTH_NETWORK || "sapphire_devnet",
  
  // RPC configurations
  BUNDLER_URL: (projectId: string) => `https://rpc.zerodev.app/api/v2/bundler/${projectId}`,
  PAYMASTER_URL: (projectId: string) => `https://rpc.zerodev.app/api/v2/paymaster/${projectId}`,
  
  // Public Polygon Amoy RPC for read-only actions
  PUBLIC_RPC_URL: "https://rpc-amoy.polygon.technology",
  
  // Mock fallback flag: true if we use local/simulated wallet derivation when ZeroDev Project ID is default/missing
  USE_SIMULATION: true,
};
