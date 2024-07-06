import { pressStart2P } from "../lib/fonts";

const ArcadeModal = ({
  isOpen,
  onClose,
  title,
  content,
  color = "pink",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: React.ReactNode;
  color?: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className={`arcade-modal arcade-modal-${color}`}>
      <button className="modal-close" onClick={onClose}>
        X
      </button>
      <h2 className={`modal-title ${pressStart2P.className}`}>{title}</h2>
      <div className={`modal-content`}>{content}</div>
    </div>
  );
};

export default ArcadeModal;
