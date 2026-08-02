import Button from './Button.jsx';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div style={styles.container}>
      <Button
        variant="secondary"
        size="small"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={currentPage <= 1 ? styles.disabledBtn : null}
      >
        Previous
      </Button>
      <span style={styles.pageInfo}>
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="small"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        style={currentPage >= totalPages ? styles.disabledBtn : null}
      >
        Next
      </Button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  pageInfo: {
    fontSize: 14,
    color: 'var(--color-grey-light)',
  },
  disabledBtn: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};
