"use client";
import { useEffect, useState } from 'react';
export default function StatusCard() {
  const [status, setStatus] = useState('checking...');
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
      .then(r => r.json())
      .then(d => setStatus(d.status))
      .catch(() => setStatus('unreachable'));
  }, []);
  return (
    <div className='rounded-2xl bg-gray-800 p-4 shadow-lg'>
      <h2 className='text-lg font-semibold'>Backend Status</h2>
      <p className='mt-2 text-sm'>Current state: <b>{status}</b></p>
    </div>
  );
}

