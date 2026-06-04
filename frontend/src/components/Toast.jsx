import {
  CheckCircle,
  Info,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import './Toast.css';

const TOAST_ICONS = {
  success: CheckCircle,
  warning: WarningCircle,
  error: XCircle,
  info: Info,
};

/**
 * Toast — ephemeral notification (Task 8.10)
 * @param {{ message: string, type: 'info'|'warning'|'error'|'success' }} props
 */
const Toast = ({ message, type = 'info' }) => {
  if (!message) return null;
  const Icon = TOAST_ICONS[type] || Info;

  return (
    <div className={`toast toast--${type}`} role="alert">
      <Icon size={18} weight="bold" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
