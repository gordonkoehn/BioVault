import { create } from 'zustand';

interface VerificationState {
  verifiedWallets: Set<string>;
  markVerified: (wallet: string) => void;
  isVerified: (wallet: string) => boolean;
}

export const useVerificationStore = create<VerificationState>((set, get) => ({
  verifiedWallets: new Set(),
  markVerified: (wallet: string) =>
    set(state => ({
      verifiedWallets: new Set(state.verifiedWallets).add(wallet),
    })),
  isVerified: (wallet: string) => get().verifiedWallets.has(wallet),
}));