import { X } from '@phosphor-icons/react';
import DialogFrame from './DialogFrame.jsx';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, message, children, onAction, actionText }) => {
    if (!isOpen) return null;

    return (
        <DialogFrame
            isOpen={isOpen}
            onClose={onClose}
            overlayClassName="modal-overlay"
            contentClassName="modal-content"
            labelledBy={title ? 'modal-title' : undefined}
        >
                {title && <h2 className="modal-title" id="modal-title">{title}</h2>}
                {children || (message && <p className="modal-message">{message}</p>)}
                <div className="modal-actions">
                    {onAction && actionText && (
                        <button className="modal-btn primary" type="button" onClick={onAction}>
                            {actionText}
                        </button>
                    )}
                    <button className="modal-btn secondary" type="button" onClick={onClose}>
                        <X size={16} weight="bold" aria-hidden="true" />
                        Close
                    </button>
                </div>
        </DialogFrame>
    );
};

export default Modal;
