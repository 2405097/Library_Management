import "./BookDetailModal.css";

export default function BookDetailModal({ book, onClose }) {
  if (!book) return null;

  const coverUrl = book.ISBN
    ? `https://covers.openlibrary.org/b/isbn/${book.ISBN}-L.jpg`
    : null;

  return (
    <div className="bdm-overlay" onClick={onClose}>
      <div className="bdm-panel" onClick={(e) => e.stopPropagation()}>
        <button className="bdm-close" onClick={onClose} aria-label="Close" type="button">
          ✕
        </button>
        <div className="bdm-body">
          <div className="bdm-cover-col">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={book.title}
                className="bdm-cover-img"
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className="bdm-cover-placeholder"
              style={{ display: coverUrl ? "none" : "flex" }}
            >
              <span>{book.title}</span>
            </div>
          </div>

          <div className="bdm-info-col">
            <h2 className="bdm-title">{book.title}</h2>
            {book.authorName && <p className="bdm-author">{book.authorName}</p>}
            <div className="bdm-meta-grid">
              {book.genre && (
                <div className="bdm-meta-item">
                  <span>Genre</span>
                  <strong>{book.genre}</strong>
                </div>
              )}
              {book.publicationYear && (
                <div className="bdm-meta-item">
                  <span>Published</span>
                  <strong>{book.publicationYear}</strong>
                </div>
              )}
              {book.publisher && (
                <div className="bdm-meta-item">
                  <span>Publisher</span>
                  <strong>{book.publisher}</strong>
                </div>
              )}
              {book.ISBN && (
                <div className="bdm-meta-item">
                  <span>ISBN</span>
                  <strong>{book.ISBN}</strong>
                </div>
              )}
              {book.price != null && (
                <div className="bdm-meta-item">
                  <span>Price</span>
                  <strong>${Number(book.price).toFixed(2)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
