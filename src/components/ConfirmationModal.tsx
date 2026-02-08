import { Theme } from '../types';
import clsx from 'clsx';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme: Theme;
}

export function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel, theme }: ConfirmationModalProps) {
  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={clsx(
        "w-full max-w-md p-6 rounded-lg shadow-xl transform transition-all border",
        isDark ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
      )}>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className={clsx("mb-6 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className={clsx(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            )}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
