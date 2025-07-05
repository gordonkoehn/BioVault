"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { v4 as uuidv4 } from 'uuid';
import { countries, getUniversalLink } from "@selfxyz/core";
import {
  SelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
} from "@selfxyz/qrcode";
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// const SelfQRcodeWrapper = dynamic(
//   () => import("@selfxyz/qrcode").then(mod => mod.SelfQRcodeWrapper),
//   { ssr: false }
// );

const sanctionedCountries = ['IRN', 'PRK'];

export default function VerifyPage() {
  const { authenticated, user, ready } = usePrivy();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (authenticated && user) {
      setUserId(user.wallet?.address || '0x1234567890123456789012345678901234567890');
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [authenticated, user]);

  if (!ready) return <div>Loading...</div>;
  if (!authenticated) return <div>Please log in with your wallet to verify your identity.</div>;
  if (!userId) return null;

  // Step 1: Questions
  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-2">Pre-Verification</h1>
        <p className="mb-4">Please provide the following information:</p>
        <form
          className="space-y-4 w-full max-w-xs"
          onSubmit={e => {
            e.preventDefault();
            setError('');
            if (sanctionedCountries.includes(country.toUpperCase())) {
              setError('Sorry, users from sanctioned countries are not allowed.');
              return;
            }
            if (!age || isNaN(Number(age)) || Number(age) < 18) {
              setError('You must be at least 18 years old.');
              return;
            }
            if (!gender) {
              setError('Please select your gender.');
              return;
            }
            setStep(2);
          }}
        >
          <div>
            <label className="block mb-1 font-semibold">Country (ISO 3-letter code)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="e.g. USA, SGP"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Age</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              value={age}
              onChange={e => setAge(e.target.value)}
              min={0}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Gender</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={gender}
              onChange={e => setGender(e.target.value)}
              required
            >
              <option value="">Select...</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          {error && <div className="text-red-600">{error}</div>}
          <button
            type="submit"
            className="w-full py-2 rounded bg-black text-white font-semibold mt-2"
          >
            Continue to ZK Proof Verification
          </button>
        </form>
      </div>
    );
  }

  // Step 2: Show QR code for ZK proof verification
  if (showSuccess) {
    // Animated checkmark and success message
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <svg className="w-24 h-24 text-green-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l3 3 5-5" />
        </svg>
        <h2 className="text-2xl font-bold mt-6 mb-2 text-green-600">Verification Successful!</h2>
        <p className="text-lg text-gray-700 mb-4">Redirecting to submit claim...</p>
      </div>
    );
  }

  try {
    const selfApp = new SelfAppBuilder({
      version: 2,
      appName: "BioVault",
      scope: "biovault",
      endpoint: '0x49C5AB3F168BBbE50630b194476c51Bd6F252db3',
      logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
      userId: userId,
      endpointType: "staging_celo",
      userIdType: "hex",
      userDefinedData: "test",
      disclosures: {
        minimumAge: 18,
        ofac: true,
        excludedCountries: [countries.NORTH_KOREA, countries.IRAN],
        nationality: true,
        date_of_birth: true,
        gender: true,
      }
    }).build();
    console.log(selfApp);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-2">Scan to Verify ZK Proof</h1>
        <p className="mb-4">Scan this QR code with the Self app to verify your identity</p>
        <SelfQRcodeWrapper
          selfApp={selfApp}
          onSuccess={() => {
            console.log('Verification successful');
            setQrError(null);
            setShowSuccess(true);
            timeoutRef.current = setTimeout(() => {
              router.push('/submit-claim');
            }, 1800);
          }}
          onError={(err) => {
            console.error('Verification error:', err);
            setQrError(err.reason || err.error_code || 'Verification failed');
          }}
          size={350}
        />
        {qrError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {qrError}
          </div>
        )}
        <p className="text-sm text-gray-500 mt-4">
          User ID: {userId.substring(0, 8)}...
        </p>
      </div>
    );
  } catch (error) {
    console.error('Error creating Self app:', error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-2">Error</h1>
        <p className="mb-4 text-red-600">
          Failed to create verification QR code. Please try again.
        </p>
        <button
          onClick={() => setStep(1)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }
}