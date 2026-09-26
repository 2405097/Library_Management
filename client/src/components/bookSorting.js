export const SORT_OPTIONS = [
  { value: "price-asc", label: "Price ascending" },
  { value: "price-desc", label: "Price descending" },
  { value: "popularity", label: "Popularity" },
  { value: "rating", label: "Rating" },
];

const numericValue = (value) => Number(value) || 0;
const titleValue = (book) => String(book.title || "").trim().toLocaleLowerCase();

const compareRatingTieBreakers = (left, right) => (
  numericValue(right.avgRating) - numericValue(left.avgRating)
  || numericValue(right.ratingCount) - numericValue(left.ratingCount)
  || titleValue(left).localeCompare(titleValue(right), undefined, { sensitivity: "base" })
);

export function sortBooks(books = [], sortBy = "popularity") {
  if (!Array.isArray(books)) return [];
  return [...books].sort((left, right) => {
    if (sortBy === "price-asc") {
      return numericValue(left.price) - numericValue(right.price)
        || titleValue(left).localeCompare(titleValue(right), undefined, { sensitivity: "base" });
    }

    if (sortBy === "price-desc") {
      return numericValue(right.price) - numericValue(left.price)
        || titleValue(left).localeCompare(titleValue(right), undefined, { sensitivity: "base" });
    }

    if (sortBy === "rating") {
      return compareRatingTieBreakers(left, right);
    }

    const popularityDifference = (
      numericValue(right.borrowCount) + numericValue(right.soldCount)
    ) - (
      numericValue(left.borrowCount) + numericValue(left.soldCount)
    );

    return popularityDifference || compareRatingTieBreakers(left, right);
  });
}
