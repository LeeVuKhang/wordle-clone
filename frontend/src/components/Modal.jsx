import { X } from '@phosphor-icons/react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, message, children, onAction, actionText }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {title && <h2 className="modal-title">{title}</h2>}
                {children || (message && <p className="modal-message">{message}</p>)}
                <div className="modal-actions">
                    {onAction && actionText && (
                        <button className="modal-btn primary" onClick={onAction}>
                            {actionText}
                        </button>
                    )}
                    <button className="modal-btn secondary" onClick={onClose}>
                        <X size={16} weight="bold" aria-hidden="true" />
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
