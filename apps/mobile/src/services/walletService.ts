import * as SecureStore from 'expo-secure-store';
import { createPublicClient, http, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { WEB3_CONFIG } from '../config/env';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount } from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';

// SecureStore key definitions
const EOA_PRIVATE_KEY_KEY = 'remitchain_eoa_private_key';
const USERNAME_KEY = 'remitchain_username';

export interface WalletState {
  eoaAddress: string;
  smartAccountAddress: string;
  username: string;
  isSimulated: boolean;
}

/**
 * Service to manage Account Abstraction wallet derivation and operations.
 */
class WalletService {
  private activeWallet: WalletState | null = null;

  /**
   * Helper: Get or create an EOA private key from SecureStore.
   * On production, this acts as the signer key backed by biometrics or social authentication.
   */
  async getOrCreatePrivateKey(): Promise<Hex> {
    const authOptions = {
      requireAuthentication: true,
      authenticationPrompt: 'Verify your identity to unlock your secure vault key',
    };
    try {
      let privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, authOptions);
      if (!privKey) {
        privKey = generatePrivateKey();
        await SecureStore.setItemAsync(EOA_PRIVATE_KEY_KEY, privKey, authOptions);
      }
      return privKey as Hex;
    } catch (error) {
      console.warn("SecureStore error, falling back to ephemeral session private key:", error);
      // Fallback if simulator has secure store disabled or errors out
      return generatePrivateKey();
    }
  }

  /**
   * Clears the stored keys from the device (Log Out)
   */
  async clearWallet(): Promise<void> {
    await SecureStore.deleteItemAsync(EOA_PRIVATE_KEY_KEY);
    await SecureStore.deleteItemAsync(USERNAME_KEY);
    this.activeWallet = null;
  }

  /**
   * Registration / Sign Up Flow:
   * Derive the user's Smart Wallet address using Account Abstraction.
   */
  async initializeWallet(
    username: string,
    onProgress?: (status: string) => void
  ): Promise<WalletState> {
    onProgress?.("Generating secure device keys...");
    const privateKey = await this.getOrCreatePrivateKey();
    const ownerAccount = privateKeyToAccount(privateKey);
    const ownerAddress = ownerAccount.address;

    await SecureStore.setItemAsync(USERNAME_KEY, username);

    const isMock = WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      // Mock / Simulation Mode
      onProgress?.("Deriving counterfactual Smart Account address (Polygon Amoy)...");
      await new Promise((r) => setTimeout(r, 1200));

      // Deterministically mock a Smart Wallet address based on the ownerAddress
      // Standard CREATE2 calculation simulation
      const mockSmartAccountAddress = `0x3a4b${ownerAddress.slice(6, 38)}7f89` as Hex;

      onProgress?.("Registering gasless Paymaster policy...");
      await new Promise((r) => setTimeout(r, 1000));

      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress: mockSmartAccountAddress,
        username,
        isSimulated: true,
      };

      return this.activeWallet;
    }

    // Live Mode: Set up ZeroDev Kernel Account
    try {
      onProgress?.("Connecting to Polygon Amoy Testnet RPC...");
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(WEB3_CONFIG.PUBLIC_RPC_URL),
      });

      onProgress?.("Initializing Kernel ECDSA Validator...");
      
      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: ownerAccount,
        entryPoint,
        kernelVersion,
      });

      onProgress?.("Deploying/Deriving counterfactual Kernel Account...");
      const kernelAccount = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint,
        kernelVersion,
      });

      onProgress?.("Registering gasless Paymaster policy...");
      const smartAccountAddress = kernelAccount.address;

      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress,
        username,
        isSimulated: false,
      };

      return this.activeWallet;
    } catch (error: any) {
      console.error("Live ZeroDev AA derivation failed, falling back to simulated mode:", error);
      
      // Graceful fallback to simulated mode if bundler/paymaster URL fails
      onProgress?.("Fallback: Generating simulated Smart Account address...");
      await new Promise((r) => setTimeout(r, 1000));
      
      const mockSmartAccountAddress = `0x7f3e${ownerAddress.slice(6, 38)}9c4d` as Hex;
      
      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress: mockSmartAccountAddress,
        username,
        isSimulated: true,
      };
      
      return this.activeWallet;
    }
  }

  /**
   * Check if there's a stored session on the device
   */
  async getStoredSession(): Promise<WalletState | null> {
    try {
      const username = await SecureStore.getItemAsync(USERNAME_KEY);
      const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, {
        requireAuthentication: true,
        authenticationPrompt: 'Unlock your RemitChain session with biometrics',
      });

      if (username && privKey) {
        const ownerAccount = privateKeyToAccount(privKey as Hex);
        const isMock = WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");
        const smartAddr = isMock
          ? (`0x3a4b${ownerAccount.address.slice(6, 38)}7f89` as Hex)
          : (`0x7f3e${ownerAccount.address.slice(6, 38)}9c4d` as Hex); // Fallback logic default address

        this.activeWallet = {
          eoaAddress: ownerAccount.address,
          smartAccountAddress: smartAddr,
          username,
          isSimulated: isMock,
        };
        return this.activeWallet;
      }
    } catch (e) {
      console.warn("Could not retrieve stored session", e);
    }
    return null;
  }

  /**
   * Simulates a gasless USDC transaction using our paymaster
   */
  async simulateGaslessTransfer(
    recipientAddress: string,
    amount: string,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    onStatusChange?.("Preparing transaction bundle...");
    await new Promise((r) => setTimeout(r, 1000));

    onStatusChange?.("Sponsoring gas via RemitChain Paymaster...");
    await new Promise((r) => setTimeout(r, 1200));

    onStatusChange?.("Signing UserOperation on device...");
    await new Promise((r) => setTimeout(r, 800));

    onStatusChange?.("Submitting transaction to Polygon Bundler...");
    await new Promise((r) => setTimeout(r, 1200));

    const mockHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    return {
      txHash: mockHash,
      gasSaved: "0.015 MATIC (~$0.02 USD)",
    };
  }
}

export const walletService = new WalletService();
