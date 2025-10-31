"use client";
import { useEffect, useState } from 'react';
export default function HomePage() {
  const [status, setStatus] = useState('checking...');
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
      .then(r => r.json())
      .then(d => setStatus(d.status))
      .catch(() => setStatus('unreachable'));
  }, []);
  return (
    <div>
      <h1 className='text-3xl font-bold mb-4'>🌀 MySpinBot Dashboard</h1>
      <p>Backend health: <span className='font-mono'>{status}</span></p>
    </div>
  );
}

