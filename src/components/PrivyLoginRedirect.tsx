'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

export default function PrivyLoginRedirect() {
  const { authenticated, ready, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    // Disabled automatic redirect to verify
    // if (ready && authenticated && user?.wallet?.address) {
    //   const key = `biovault_verified_${user.wallet.address}`;
    //   if (!localStorage.getItem(key)) {
    //     router.push('/verify');
    //   }
    // }
  }, [ready, authenticated, user, router]);

  return null;
} 