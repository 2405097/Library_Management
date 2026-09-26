import { useEffect, useState } from "react";
import "./BookShelf.css";
import { sortBooks } from "./bookSorting";

function colorFromString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 45%, 55%)`;
}

export default function BookShelf({
  genre,
  label,
  onBookClick,
  books: suppliedBooks,
  loading: suppliedLoading,
  sortBy = "popularity",
}) {
  const [fetchedBooks, setFetchedBooks] = useState([]);
  const [fetchedLoading, setFetchedLoading] = useState(true);

  const isSupplied = Array.isArray(suppliedBooks);

  useEffect(() => {
    if (isSupplied) return undefined;

    let cancelled = false;

    fetch(`/api/books/search?field=genre&keyword=${encodeURIComponent(genre)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load shelf");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setFetchedBooks(Array.isArray(data) ? data : []);
          setFetchedLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedBooks([]);
          setFetchedLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [genre, isSupplied]);

  const books = isSupplied ? suppliedBooks : fetchedBooks;
  const isLoading = isSupplied
    ? (typeof suppliedLoading === "boolean" ? suppliedLoading : false)
    : fetchedLoading;

  const sortedBooks = sortBooks(books, sortBy);

  if (!isLoading && books.length === 0) return null;

  return (
    <section className="shelf">
      <h2 className="shelf-label">{label}</h2>
      <div className="shelf-track">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shelf-card shelf-card--skeleton" />
            ))
          : sortedBooks.slice(0, 20).map((book) => (
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
