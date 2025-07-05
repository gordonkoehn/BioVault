'use client';

import { PrivyProvider as Privy } from '@privy-io/react-auth';

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Privy
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'test'}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#000000',
          showWalletLoginFirst: true,
        },
        defaultChain: { 
          id: 1, 
          name: 'Ethereum',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: ['https://ethereum.rpc.thirdweb.com'] } }
        },
      }}
    >
      {children}
    </Privy>
  );
} 