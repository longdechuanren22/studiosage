import { useState, useEffect } from 'react';

interface SetupStatus {
  ai: { configured: boolean };
  pixieset: { configured: boolean };
  googleCalendar: { configured: boolean };
  stripe: { configured: boolean };
  setupComplete: boolean;
}

export default function Settings() {
  const [status, setStatus] = useState<SetupStatus | null>(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setStatus);
  }, []);

  if (!status) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <h2 className="text-sm font-semibold text-gray-700">Setup</h2>

      {!status.setupComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Complete setup to activate StudioSage. You need at least the AI engine + Stripe.
        </div>
      )}

      {status.setupComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          ✅ Setup complete. StudioSage is active.
        </div>
      )}

      <div className="space-y-2">
        <SettingRow label="AI Engine (Claude)" configured={status.ai.configured} help="ANTHROPIC_API_KEY" />
        <SettingRow label="Stripe" configured={status.stripe.configured} help="STRIPE_SECRET_KEY" />
        <SettingRow label="Pixieset" configured={status.pixieset.configured} help="PIXIESET_API_KEY" />
        <SettingRow label="Google Calendar" configured={status.googleCalendar.configured} help="GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET" />
      </div>

      {!status.setupComplete && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            Set these as environment variables in your server's <code className="bg-gray-100 px-1 rounded">.env</code> file,
            then restart.
          </p>
          <pre className="text-[11px] bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
{`ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
PIXIESET_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...`}
          </pre>
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, configured, help }: { label: string; configured: boolean; help: string }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-100">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-gray-400">{help}</p>
      </div>
      <span className={configured ? 'text-green-500' : 'text-gray-300'}>
        {configured ? '✅' : '⬜'}
      </span>
    </div>
  );
}
