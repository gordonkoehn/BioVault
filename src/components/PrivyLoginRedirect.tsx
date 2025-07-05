'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

export default function PrivyLoginRedirect() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.push('/verify');
    }
  }, [ready, authenticated, router]);

  return null;
} 