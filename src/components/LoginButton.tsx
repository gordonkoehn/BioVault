'use client';

import { usePrivy } from '@privy-io/react-auth';

export default function LoginButton() {
  const { login, logout, authenticated, user, ready } = usePrivy();

  if (!ready) {
    return (
      <button className="px-6 py-2 rounded-lg bg-black text-white text-lg font-semibold shadow hover:bg-gray-900 transition">
        Loading...
      </button>
    );
  }

  if (authenticated && user) {
    return (
      <div className="w-full flex flex-col gap-2">
        <div className="text-sm text-gray-600 mb-2">
          Connected: {user.wallet?.address ? 
            `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : 
            user.email?.address || 'Unknown'
          }
        </div>
        <button 
          onClick={logout}
          className="px-6 py-2 rounded-lg bg-black text-white text-lg font-semibold shadow hover:bg-gray-900 transition"
        >
          Disconnect Wallet
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={login}
      className="px-6 py-2 rounded-lg bg-black text-white text-lg font-semibold shadow hover:bg-gray-900 transition"
    >
      Log in with Wallet
    </button>
  );
} 