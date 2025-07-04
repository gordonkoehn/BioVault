'use client';

import { usePrivy } from '@privy-io/react-auth';

export default function LoginButton() {
  const { login, logout, authenticated, user, ready } = usePrivy();

  if (!ready) {
    return (
      <button className="w-full py-3 rounded-lg border border-gray-300 text-lg font-semibold bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition mb-2">
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
          className="w-full py-3 rounded-lg border border-gray-300 text-lg font-semibold bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition"
        >
          Disconnect Wallet
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={login}
      className="w-full py-3 rounded-lg border border-gray-300 text-lg font-semibold bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition mb-2"
    >
      Log in with Wallet
    </button>
  );
} 