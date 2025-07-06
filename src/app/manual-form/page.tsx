"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const sanctionedCountries = ['IRN', 'PRK'];

export default function ManualFormPage() {
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
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
    
    setShowSuccess(true);
    setTimeout(() => {
      router.push('/submit-claim');
    }, 1800);
  };

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white">
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-blue-100 flex flex-col items-center animate-fade-in">
          <svg className="w-24 h-24 text-green-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l3 3 5-5" />
          </svg>
          <h2 className="text-2xl font-bold mt-6 mb-2 text-green-600">Verification Successful!</h2>
          <p className="text-lg text-gray-700 mb-4">Redirecting to submit claim...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="bg-white rounded-2xl shadow-xl p-10 border border-blue-100 flex flex-col items-center animate-fade-in">
        <h1 className="text-3xl font-bold mb-2 text-blue-900">Manual Verification</h1>
        <p className="text-gray-600 mb-8 text-center">Please provide the following information to continue:</p>
        
        <form
          className="space-y-6 w-full max-w-sm"
          onSubmit={handleSubmit}
        >
          <div>
            <label className="block mb-2 font-semibold text-blue-900">Country (ISO 3-letter code)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="e.g. USA, SGP"
              required
            />
          </div>
          
          <div>
            <label className="block mb-2 font-semibold text-blue-900">Age</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="number"
              value={age}
              onChange={e => setAge(e.target.value)}
              min="18"
              max="120"
              required
            />
          </div>
          
          <div>
            <label className="block mb-2 font-semibold text-blue-900">Gender</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={gender}
              onChange={e => setGender(e.target.value)}
              required
            >
              <option value="">Select gender...</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold hover:from-blue-600 hover:to-blue-800 transition shadow-lg"
          >
            Continue to Submit Claim
          </button>
        </form>
      </div>
    </div>
  );
} 