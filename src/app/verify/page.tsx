"use client";

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { SelfQRcodeWrapper, SelfAppBuilder } from '@selfxyz/qrcode';
import { v4 as uuidv4 } from 'uuid';

const sanctionedCountries = ['IRN', 'PRK'];

export default function VerifyPage() {
  const { authenticated, user, ready } = usePrivy();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authenticated && user) {
      setUserId(user.wallet?.address || '0x1234567890123456789012345678901234567890');
    }
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
  const selfApp = new SelfAppBuilder({
    appName: "Biovault",
    scope: "biovault",
    endpoint: process.env.NEXT_PUBLIC_SELF_ENDPOINT || "",
    userIdType: 'hex',
    userId,
    disclosures: {
      minimumAge: 18,
      excludedCountries: ['IRN', 'PRK'],
      ofac: true,
      nationality: true,
      name: true,
      // dateOfBirth: true
    },
    userDefinedData: "test"
  }).build();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-2">Scan to Verify ZK Proof</h1>
      <p className="mb-4">Scan this QR code with the Self app to verify your identity</p>
      <SelfQRcodeWrapper
        selfApp={selfApp}
        onSuccess={() => {
          console.log('Verification successful');
        }}
        onError={err => {
          console.error('Verification error:', err);
        }}
        size={350}
      />
      <p className="text-sm text-gray-500 mt-4">
        User ID: {userId.substring(0, 8)}...
      </p>
    </div>
  );
} 