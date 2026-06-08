interface ConnectBtnProps {
  provider: 'google' | 'stripe' | 'pixieset';
  label: string;
  connected?: boolean;
}

export function ConnectButton({ provider, label, connected }: ConnectBtnProps) {
  const urls: Record<string, string> = {
    google: '/api/oauth/google',
    stripe: '/api/oauth/stripe',
    pixieset: '/api/oauth/pixieset',
  };

  return connected ? (
    <div className="flex items-center gap-2 w-full py-3 px-4 bg-green-50 border border-green-200 rounded-full text-sm">
      <span className="text-green-600">✅</span>
      <span className="text-green-700 font-medium">{label}</span>
      <span className="text-green-500 text-xs ml-auto">Connected</span>
    </div>
  ) : (
    <a
      href={urls[provider]}
      className="flex items-center gap-2 w-full py-3 px-4 bg-white border border-gray-200 rounded-full text-sm hover:border-sage-300 hover:bg-sage-50 transition"
    >
      <span className="text-gray-400">+</span>
      <span className="text-gray-700">{label}</span>
    </a>
  );
}
