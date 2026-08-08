type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

/** Shared See / Back control - lives in the Sell/Use dock slot. */
export function PoolToggleButton({ open, onOpen, onClose }: Props) {
  return (
    <button
      type="button"
      className={`dock-action pool-toggle${open ? ' open' : ''}`}
      onClick={open ? onClose : onOpen}
    >
      {open ? 'Back to game' : 'See the items'}
    </button>
  );
}
