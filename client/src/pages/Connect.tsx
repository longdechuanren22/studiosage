import { useState, useEffect } from 'react';
import { ConnectButton } from '../components/ConnectButtons';

export default function Connect() {
  const [status, setStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setStatus({
        google: s.googleCalendar?.configured || false,
        stripe: s.stripe?.configured || false,
        pixieset: s.pixieset?.configured || false,
      });
    });
  }, []);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Connect Your Tools</h2>
        <p className="text-sm text-gray-500 mt-1">StudioSage works with what you already use.</p>
      </div>

      <div className="space-y-2">
        <ConnectButton provider="google" label="Google Calendar + Gmail" connected={status.google} />
        <ConnectButton provider="stripe" label="Stripe Payments" connected={status.stripe} />
        <ConnectButton provider="pixieset" label="Pixieset Galleries" connected={status.pixieset} />
      </div>

      {Object.values(status).every(v => v) && (
        <div className="bg-green-50 rounded-xl p-4 text-center text-sm text-green-700">
          🎉 All tools connected! Head to the Dashboard.
        </div>
      )}
    </div>
  );
}
