import * as SecureStore from 'expo-secure-store';
import {
  createPublicClient,
  http,
  Hex,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  isAddress,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { ERC20_ABI, REMITTANCE_ESCROW_ABI, YIELD_VAULT_ABI } from '@repo/contracts-sdk';
import { WEB3_CONFIG } from '../config/env';
import * as LocalAuthentication from 'expo-local-authentication';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import * as WebBrowser from 'expo-web-browser';

// Web3Auth is imported lazily to avoid side-effect crashes at module load time
let _Web3Auth: any = null;
let _AUTH_CONNECTION: any = null;

// SecureStore key definitions
const EOA_PRIVATE_KEY_KEY = 'remitchain_eoa_private_key';
const USERNAME_KEY = 'remitchain_username';
const SMART_ADDRESS_KEY = 'remitchain_smart_address';

export interface WalletState {
  eoaAddress: string;
  smartAccountAddress: string;
  username: string;
  isSimulated: boolean;
  isCloudSynced?: boolean;
}

class WalletService {
  private activeWallet: WalletState | null = null;
  private web3auth: any = null;
  private cachedKernelClient: any = null;
  private cachedKernelOwner: string | null = null;

  private async getKernelClient(onStatusChange?: (status: string) => void) {
    onStatusChange?.("Retrieving device credentials...");
    const authOptions = await this.getAuthOptions('Authorize transaction');
    const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, authOptions);
    if (!privKey) throw new Error("Owner private key not found in storage.");

    const ownerAccount = privateKeyToAccount(privKey as Hex);
    if (this.cachedKernelClient && this.cachedKernelOwner === ownerAccount.address) {
      return this.cachedKernelClient;
    }

    onStatusChange?.("Connecting to RPC Network...");
    const bundlerRpcUrl = WEB3_CONFIG.BUNDLER_URL(WEB3_CONFIG.ZERODEV_PROJECT_ID);
    const publicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(WEB3_CONFIG.PUBLIC_RPC_URL),
    });

    onStatusChange?.("Initializing Smart Account...");
    const entryPoint = getEntryPoint("0.7");
    const kernelVersion = KERNEL_V3_1;

    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer: ownerAccount,
      entryPoint,
      kernelVersion,
    });

    const account = await createKernelAccount(publicClient, {
      plugins: { sudo: ecdsaValidator },
      entryPoint,
      kernelVersion,
    });

    onStatusChange?.("Setting up gasless paymaster...");
    const paymasterClient = createZeroDevPaymasterClient({
      chain: polygonAmoy,
      transport: http(bundlerRpcUrl),
    });

    const kernelClient = createKernelAccountClient({
      account,
      chain: polygonAmoy,
      bundlerTransport: http(bundlerRpcUrl),
      paymaster: {
        getPaymasterData: async (userOperation) => {
          return paymasterClient.sponsorUserOperation({ userOperation });
        },
      },
    });

    this.cachedKernelClient = kernelClient;
    this.cachedKernelOwner = ownerAccount.address;
    return kernelClient;
  }

  private async getWeb3Auth(): Promise<any> {
    if (this.web3auth) return this.web3auth;

    // Lazy import to avoid side-effect crashes during module initialization
    if (!_Web3Auth) {
      console.log('[Web3Auth] Loading SDK module...');
      const sdk = await import('@web3auth/react-native-sdk');
      _Web3Auth = sdk.default;
      _AUTH_CONNECTION = sdk.AUTH_CONNECTION;
      console.log('[Web3Auth] SDK module loaded successfully');
    }

    const web3auth = new _Web3Auth(WebBrowser, SecureStore, {
      clientId: WEB3_CONFIG.WEB3AUTH_CLIENT_ID,
      network: WEB3_CONFIG.WEB3AUTH_NETWORK as any,
      redirectUrl: WEB3_CONFIG.WEB3AUTH_REDIRECT_URL,
    });

    await web3auth.init();
    this.web3auth = web3auth;
    return web3auth;
  }

  /**
   * Helper: Get SecureStore authentication options dynamically based on biometrics availability.
   * Prevents rejection crashes on emulators with no biometrics enrolled.
   */
  async getAuthOptions(prompt: string) {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return {
        requireAuthentication: hasHardware && isEnrolled,
        authenticationPrompt: prompt,
      };
    } catch {
      return {
        requireAuthentication: false,
        authenticationPrompt: prompt,
      };
    }
  }

  /**
   * Helper: Get or create an EOA private key from SecureStore.
   * On production, this acts as the signer key backed by biometrics or social authentication.
   */
  async getOrCreatePrivateKey(): Promise<Hex> {
    const authOptions = await this.getAuthOptions('Verify your identity to unlock your secure vault key');
    let privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, authOptions);
    if (!privKey) {
      privKey = generatePrivateKey();
      await SecureStore.setItemAsync(EOA_PRIVATE_KEY_KEY, privKey, authOptions);
    }
    return privKey as Hex;
  }

  async clearWallet(): Promise<void> {
    if (this.web3auth) {
      try {
        await this.web3auth.logout();
      } catch {}
    }
    await SecureStore.deleteItemAsync(EOA_PRIVATE_KEY_KEY);
    await SecureStore.deleteItemAsync(USERNAME_KEY);
    await SecureStore.deleteItemAsync('remitchain_auth_method');
    await SecureStore.deleteItemAsync(SMART_ADDRESS_KEY);
    await SecureStore.deleteItemAsync('remitchain_custom_txs');
    this.activeWallet = null;
    this.cachedKernelClient = null;
    this.cachedKernelOwner = null;
  }

  /**
   * Registration / Sign Up Flow:
   * Derive the user's Smart Wallet address using Account Abstraction.
   */
  async initializeWallet(
    username: string,
    loginMethod: 'passkey' | 'google',
    onProgress?: (status: string) => void
  ): Promise<WalletState> {
    let privateKey: Hex;

    if (loginMethod === 'passkey') {
      onProgress?.("Triggering biometric scan...");
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock or create your secure wallet key',
            fallbackLabel: 'Use device passcode',
          });
          if (!authResult.success) {
            throw new Error("Biometric scan was cancelled or failed.");
          }
        } else {
          console.warn("Biometrics hardware not available or not enrolled, skipping prompt.");
        }
      } catch (err) {
        console.warn("Biometric authentication error, proceeding with passcode/fallback:", err);
      }

      onProgress?.("Generating secure device keys...");
      privateKey = await this.getOrCreatePrivateKey();
    } else {
      // Google Login via Web3Auth MPC
      onProgress?.("Initializing Web3Auth Client...");
      try {
        const web3auth = await this.getWeb3Auth();

        onProgress?.("Signing into Google account...");
        const result = await web3auth.connectTo({
          authConnection: _AUTH_CONNECTION.GOOGLE,
          extraLoginOptions: {
            connection: WEB3_CONFIG.WEB3AUTH_CONNECTION_ID,
          },
        });

        if (!result || !result.signer || !('privateKey' in result.signer)) {
          throw new Error("Failed to retrieve private key from Web3Auth.");
        }

        privateKey = result.signer.privateKey as Hex;

        const storeAuthOptions = await this.getAuthOptions('Secure your restored wallet with biometrics');
        await SecureStore.setItemAsync(EOA_PRIVATE_KEY_KEY, privateKey, storeAuthOptions);
      } catch (err: any) {
        throw new Error(`Google login failed: ${err?.message || err}`);
      }
    }

    const ownerAccount = privateKeyToAccount(privateKey);
    const ownerAddress = ownerAccount.address;

    await SecureStore.setItemAsync(USERNAME_KEY, username);
    await SecureStore.setItemAsync('remitchain_auth_method', loginMethod);

    const isMock = WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      // Mock / Simulation Mode
      onProgress?.("Deriving counterfactual Smart Account address (Polygon Amoy)...");
      await new Promise((r) => setTimeout(r, 1200));

      // Deterministically mock a Smart Wallet address based on the ownerAddress
      const mockSmartAccountAddress = `0x3a4b${ownerAddress.slice(6, 38)}7f89` as Hex;

      onProgress?.("Registering gasless Paymaster policy...");
      await new Promise((r) => setTimeout(r, 1000));

      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress: mockSmartAccountAddress,
        username,
        isSimulated: true,
        isCloudSynced: loginMethod === 'google',
      };

      await SecureStore.setItemAsync(SMART_ADDRESS_KEY, mockSmartAccountAddress);
      return this.activeWallet;
    }

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
        isCloudSynced: loginMethod === 'google',
      };

      await SecureStore.setItemAsync(SMART_ADDRESS_KEY, smartAccountAddress);
      return this.activeWallet;
    } catch (error: any) {
      console.error("Live ZeroDev AA derivation failed, falling back to simulated mode:", error);
      if (error?.stack) console.error("ZeroDev error stack:", error.stack);
      if (error?.cause?.stack) console.error("ZeroDev error cause stack:", error.cause.stack);
      
      // Graceful fallback to simulated mode if bundler/paymaster URL fails
      onProgress?.("Fallback: Generating simulated Smart Account address...");
      await new Promise((r) => setTimeout(r, 1000));
      
      const mockSmartAccountAddress = `0x7f3e${ownerAddress.slice(6, 38)}9c4d` as Hex;
      
      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress: mockSmartAccountAddress,
        username,
        isSimulated: true,
        isCloudSynced: loginMethod === 'google',
      };
      
      await SecureStore.setItemAsync(SMART_ADDRESS_KEY, mockSmartAccountAddress);
      return this.activeWallet;
    }
  }

  /**
   * Check if there's a stored session on the device
   */
  async getStoredSession(): Promise<WalletState | null> {
    try {
      const username = await SecureStore.getItemAsync(USERNAME_KEY);
      const authOptions = await this.getAuthOptions('Unlock your RemitChain session with biometrics');
      const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, authOptions);

      if (username && privKey) {
        const authMethod = await SecureStore.getItemAsync('remitchain_auth_method');
        const savedSmartAddr = await SecureStore.getItemAsync(SMART_ADDRESS_KEY);
        const ownerAccount = privateKeyToAccount(privKey as Hex);
        const isMock = WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");
        
        let smartAddr: Hex;
        if (savedSmartAddr) {
          smartAddr = savedSmartAddr as Hex;
        } else {
          smartAddr = isMock
            ? (`0x3a4b${ownerAccount.address.slice(6, 38)}7f89` as Hex)
            : (`0x7f3e${ownerAccount.address.slice(6, 38)}9c4d` as Hex);
        }

        // Set simulated flag if we are using a mock address prefix
        const isSimulated = isMock || smartAddr.startsWith("0x3a4b") || smartAddr.startsWith("0x7f3e");

        this.activeWallet = {
          eoaAddress: ownerAccount.address,
          smartAccountAddress: smartAddr,
          username,
          isSimulated,
          isCloudSynced: authMethod === 'google',
        };
        return this.activeWallet;
      }
    } catch (e) {
      console.warn("Could not retrieve stored session", e);
    }
    return null;
  }

  /**
   * Performs an on-chain gasless USDC transaction sponsored via our paymaster
   */
  async simulateGaslessTransfer(
    recipientAddress: string,
    amount: string,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      onStatusChange?.("Preparing simulated transaction...");
      await new Promise((r) => setTimeout(r, 1000));
      onStatusChange?.("Sponsoring simulated gas...");
      await new Promise((r) => setTimeout(r, 1200));
      onStatusChange?.("Signing simulated UserOperation...");
      await new Promise((r) => setTimeout(r, 800));
      onStatusChange?.("Submitting simulated transaction...");
      await new Promise((r) => setTimeout(r, 1200));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return {
        txHash: mockHash,
        gasSaved: "0.015 POL (~$0.02 USD)",
      };
    }

    try {
      if (!isAddress(recipientAddress)) {
        throw new Error("Invalid recipient address.");
      }
      const amountInUnits = parseUnits(amount, 6);
      if (amountInUnits <= 0n) {
        throw new Error("Transfer amount must be greater than zero.");
      }

      const kernelClient = await this.getKernelClient(onStatusChange);

      onStatusChange?.("Encoding USDC transfer transaction...");
      const usdcTokenAddress = WEB3_CONFIG.USDC_ADDRESS as Hex;

      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipientAddress as Hex, amountInUnits],
      });

      onStatusChange?.("Signing and sending gasless transaction...");
      const txHash = await kernelClient.sendTransaction({
        to: usdcTokenAddress,
        data: transferData,
      });

      return {
        txHash,
        gasSaved: "0.015 POL (~$0.02 USD)",
      };
    } catch (e: any) {
      console.error("Real transfer error:", e);
      throw new Error(`Real on-chain transfer failed: ${e.message || e}`);
    }
  }

  /**
   * Performs an on-chain gasless batched USDC transaction split between two recipients
   */
  async simulateGaslessSplitTransfer(
    recipientA: string,
    recipientB: string,
    totalAmount: string,
    pctA: number,
    pctB: number,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    const amountA = (parseFloat(totalAmount) * pctA) / 100;
    const amountB = (parseFloat(totalAmount) * pctB) / 100;

    if (isMock) {
      onStatusChange?.("Preparing simulated batched transaction...");
      await new Promise((r) => setTimeout(r, 1000));
      onStatusChange?.("Sponsoring simulated gas...");
      await new Promise((r) => setTimeout(r, 1200));
      onStatusChange?.("Signing batched UserOperation...");
      await new Promise((r) => setTimeout(r, 800));
      onStatusChange?.("Submitting batched transaction...");
      await new Promise((r) => setTimeout(r, 1200));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return {
        txHash: mockHash,
        gasSaved: "0.025 POL (~$0.03 USD)",
      };
    }

    try {
      if (!isAddress(recipientA) || !isAddress(recipientB)) {
        throw new Error("Invalid recipient address.");
      }
      const amountInUnitsA = parseUnits(amountA.toFixed(6), 6);
      const amountInUnitsB = parseUnits(amountB.toFixed(6), 6);

      const kernelClient = await this.getKernelClient(onStatusChange);

      onStatusChange?.("Encoding batched USDC transfer transactions...");
      const usdcTokenAddress = WEB3_CONFIG.USDC_ADDRESS as Hex;

      const transferDataA = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipientA as Hex, amountInUnitsA],
      });

      const transferDataB = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipientB as Hex, amountInUnitsB],
      });

      onStatusChange?.("Signing and sending batched UserOperation...");
      const txHash = await kernelClient.sendTransaction({
        calls: [
          {
            to: usdcTokenAddress,
            data: transferDataA,
          },
          {
            to: usdcTokenAddress,
            data: transferDataB,
          },
        ],
      });

      return {
        txHash,
        gasSaved: "0.025 POL (~$0.03 USD)",
      };
    } catch (e: any) {
      console.error("Real batched transfer error:", e);
      throw new Error(`Real on-chain batched transfer failed: ${e.message || e}`);
    }
  }

  /**
   * Reads the real USDC token balance of the counterfactual Smart Account on-chain.
   */
  async getUSDCBalance(address: string, isSimulated = false): Promise<string> {
    const isMock = isSimulated || 
                   address.startsWith("0x3a4b") || 
                   address.startsWith("0x7f3e") ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");
    if (isMock) {
      return "0.00";
    }

    try {
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(WEB3_CONFIG.PUBLIC_RPC_URL),
      });

      const usdcAddress = WEB3_CONFIG.USDC_ADDRESS as Hex;

      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as Hex],
      }) as bigint;

      return Number(formatUnits(balance, 6)).toFixed(2);
    } catch (e) {
      console.warn("Failed to fetch live USDC balance:", e);
      return "0.00";
    }
  }

  async createCashOutOrder(
    boothAddress: string,
    amount: string,
    pickupCode: string,
    ttlSeconds = 86400,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000") ||
                   WEB3_CONFIG.REMITTANCE_ESCROW_ADDRESS === "0x0000000000000000000000000000000000000000";

    if (isMock) {
      onStatusChange?.("Simulated escrow cash-out order...");
      await new Promise((r) => setTimeout(r, 1500));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return { txHash: mockHash, gasSaved: "0.022 POL (~$0.03 USD)" };
    }

    if (!isAddress(boothAddress)) {
      throw new Error("Invalid booth address.");
    }
    const amountInUnits = parseUnits(amount, 6);
    if (amountInUnits <= 0n) {
      throw new Error("Order amount must be greater than zero.");
    }
    if (!pickupCode.trim()) {
      throw new Error("Pickup code is required.");
    }

    const kernelClient = await this.getKernelClient(onStatusChange);
    const escrowAddress = WEB3_CONFIG.REMITTANCE_ESCROW_ADDRESS as Hex;
    const usdcAddress = WEB3_CONFIG.USDC_ADDRESS as Hex;
    const pickupCodeHash = keccak256(toBytes(pickupCode.trim()));

    onStatusChange?.("Encoding approve + escrow order batch...");
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [escrowAddress, amountInUnits],
    });

    const createOrderData = encodeFunctionData({
      abi: REMITTANCE_ESCROW_ABI,
      functionName: 'createOrder',
      args: [boothAddress as Hex, amountInUnits, pickupCodeHash, BigInt(ttlSeconds)],
    });

    onStatusChange?.("Signing & sending gasless escrow order...");
    const txHash = await kernelClient.sendTransaction({
      calls: [
        { to: usdcAddress, data: approveData },
        { to: escrowAddress, data: createOrderData },
      ],
    });

    return { txHash, gasSaved: "0.022 POL (~$0.03 USD)" };
  }

  // ─── Yield Vault Integration ─────────────────────────────────────────
  // Contract Address: deployed on Polygon Amoy testnet.
  // On mainnet, swap this for the Aave V3 Pool address.
  private YIELD_VAULT_ADDRESS = WEB3_CONFIG.YIELD_VAULT_ADDRESS as Hex;
  private USDC_ADDRESS = WEB3_CONFIG.USDC_ADDRESS as Hex;

  private YIELD_VAULT_ABI = YIELD_VAULT_ABI;

  /**
   * Deposit USDC into the on-chain YieldVault.
   * Uses a batched gasless UserOperation: approve + deposit in one click.
   */
  async depositToYield(
    amount: string,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      onStatusChange?.("Simulated yield deposit...");
      await new Promise((r) => setTimeout(r, 2000));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return { txHash: mockHash, gasSaved: "0.020 POL (~$0.03 USD)" };
    }

    try {
      const amountInUnits = parseUnits(amount, 6);
      if (amountInUnits <= 0n) throw new Error("Deposit amount must be greater than zero.");

      const kernelClient = await this.getKernelClient(onStatusChange);

      onStatusChange?.("Encoding approve + deposit batch...");

      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [this.YIELD_VAULT_ADDRESS, amountInUnits],
      });

      const depositData = encodeFunctionData({
        abi: this.YIELD_VAULT_ABI,
        functionName: 'deposit',
        args: [amountInUnits],
      });

      onStatusChange?.("Signing & sending gasless batch transaction...");
      const txHash = await kernelClient.sendTransaction({
        calls: [
          { to: this.USDC_ADDRESS, data: approveData },
          { to: this.YIELD_VAULT_ADDRESS, data: depositData },
        ],
      });

      return { txHash, gasSaved: "0.020 POL (~$0.03 USD)" };
    } catch (e: any) {
      console.error("Yield deposit error:", e);
      throw new Error(`Yield deposit failed: ${e.message || e}`);
    }
  }

  /**
   * Withdraw USDC (principal + interest) from the on-chain YieldVault.
   */
  async withdrawFromYield(
    amount: string,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      onStatusChange?.("Simulated yield withdrawal...");
      await new Promise((r) => setTimeout(r, 2000));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return { txHash: mockHash, gasSaved: "0.015 POL (~$0.02 USD)" };
    }

    try {
      const kernelClient = await this.getKernelClient(onStatusChange);

      onStatusChange?.("Encoding withdrawal transaction...");
      const amountInUnits = amount === 'MAX'
        ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        : parseUnits(amount, 6);

      const withdrawData = encodeFunctionData({
        abi: this.YIELD_VAULT_ABI,
        functionName: 'withdraw',
        args: [amountInUnits],
      });

      onStatusChange?.("Signing & sending gasless withdrawal...");
      const txHash = await kernelClient.sendTransaction({
        to: this.YIELD_VAULT_ADDRESS,
        data: withdrawData,
      });

      return { txHash, gasSaved: "0.015 POL (~$0.02 USD)" };
    } catch (e: any) {
      console.error("Yield withdrawal error:", e);
      throw new Error(`Yield withdrawal failed: ${e.message || e}`);
    }
  }

  /**
   * Query the on-chain YieldVault for a user's yield balance, principal, and interest.
   */
  async getYieldBalance(address: string, isSimulated = false): Promise<{
    total: string;
    principal: string;
    interest: string;
    apyBps: number;
  }> {
    const isMock = isSimulated ||
                   address.startsWith("0x3a4b") ||
                   address.startsWith("0x7f3e") ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000") ||
                   this.YIELD_VAULT_ADDRESS === "0x0000000000000000000000000000000000000000";

    if (isMock) {
      return { total: "0.00", principal: "0.00", interest: "0.000000", apyBps: 450 };
    }

    try {
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(WEB3_CONFIG.PUBLIC_RPC_URL),
      });

      const [totalRaw, principalRaw, interestRaw, apyBpsRaw] = await Promise.all([
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'balanceOf',
          args: [address as Hex],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'principalOf',
          args: [address as Hex],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'interestOf',
          args: [address as Hex],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'apyBps',
        }) as Promise<bigint>,
      ]);

      return {
        total: (Number(totalRaw) / 1_000_000).toFixed(6),
        principal: (Number(principalRaw) / 1_000_000).toFixed(2),
        interest: (Number(interestRaw) / 1_000_000).toFixed(6),
        apyBps: Number(apyBpsRaw),
      };
    } catch (e) {
      console.warn("Failed to fetch yield balance:", e);
      return { total: "0.00", principal: "0.00", interest: "0.000000", apyBps: 450 };
    }
  }
}

export const walletService = new WalletService();

