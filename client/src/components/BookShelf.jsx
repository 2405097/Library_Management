import { useEffect, useState } from "react";
import "./BookShelf.css";

function colorFromString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 45%, 55%)`;
}

export default function BookShelf({ genre, label, onBookClick }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/books/search?field=genre&keyword=${encodeURIComponent(genre)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setBooks(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [genre]);

  if (!loading && books.length === 0) return null;

  return (
    <section className="shelf">
      <h2 className="shelf-label">{label}</h2>
      <div className="shelf-track">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shelf-card shelf-card--skeleton" />
            ))
          : books.slice(0, 20).map((book) => (
              <button
                key={book.bookID}
                className="shelf-card"
                onClick={() => onBookClick(book)}
                title={book.title}
                type="button"
              >
                <div className="shelf-card-cover-wrap">
                  {book.ISBN ? (
                    <img
                      src={`https://covers.openlibrary.org/b/isbn/${book.ISBN}-M.jpg`}
                      alt={book.title}
                      className="shelf-card-img"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = "none";
                        if (e.target.nextElementSibling) {
                          e.target.nextElementSibling.style.display = "flex";
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="shelf-card-placeholder"
                    style={{
                      backgroundColor: colorFromString(book.title),
                      display: book.ISBN ? "none" : "flex",
                    }}
                  >
                    <span className="shelf-card-placeholder-title">{book.title}</span>
                  </div>
                </div>
                <div className="shelf-card-info">
                  <p className="shelf-card-title">{book.title}</p>
                  <p className="shelf-card-author">{book.authorName ?? "Unknown"}</p>
                </div>
              </button>
            ))}
      </div>
    </section>
  );
}
