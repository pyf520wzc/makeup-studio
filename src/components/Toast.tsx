import { useEffect } from 'react';

export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return <div className="toast">{message}</div>;
}
