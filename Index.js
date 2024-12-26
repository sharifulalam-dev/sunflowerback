const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const cookieParser = require("cookie-parser");
const app = express();
const PORT = process.env.PORT || 5000;

const uri = "mongodb://localhost:27017";
//const uri = `mongodb+srv://${username}:${password}@cluster0.ey46t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);

app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "test-982fe.web.app",
      "test-982fe.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(cookieParser());

async function initializeMongoDB() {
  try {
    await client.connect();
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}
initializeMongoDB();

const getDatabase = () => client.db("bookstore");
const getBooksCollection = () => getDatabase().collection("books");
const getBorrowedBooksCollection = () =>
  getDatabase().collection("borrowedbooks");

const verifyToken = (req, res, next) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

app.get("/all-books", verifyToken, async (req, res) => {
  const userEmail = req.user.email;

  if (req.query.email !== userEmail)
    return res.status(401).json({ message: "Unauthorized" });
  try {
    const books = await getBooksCollection().find({}).toArray();
    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/books", async (req, res) => {
  const { cat } = req.query;
  try {
    const books = await getBooksCollection().find({ category: cat }).toArray();
    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching books by category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/book-details/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const book = await getBooksCollection().findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.status(200).json(book);
  } catch (error) {
    console.error("Error fetching book details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/addbook", verifyToken, async (req, res) => {
  const userEmail = req.user.email;
  if (req.query.email !== userEmail)
    return res.status(401).json({ message: "Unauthorized" });

  const bookData = req.body;

  if (!bookData.name || typeof bookData.quantity !== "number") {
    return res.status(400).json({
      message: "Book name and numeric quantity are required.",
    });
  }

  try {
    const result = await getBooksCollection().insertOne(bookData);
    res
      .status(201)
      .json({ message: "Book added successfully", bookId: result.insertedId });
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/available-books", async (req, res) => {
  try {
    const availableBooks = await getBooksCollection()
      .find({ quantity: { $gt: 0 } })
      .toArray();
    res.status(200).json(availableBooks);
  } catch (error) {
    console.error("Error fetching available books:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.patch("/all-books/:id", async (req, res) => {
  const { id } = req.params;
  const { _id, ...updateFields } = req.body;

  if (updateFields.quantity && typeof updateFields.quantity !== "number") {
    return res
      .status(400)
      .json({ message: "Quantity must be a numeric value." });
  }

  try {
    await getBooksCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    res.status(200).json({ message: "Book updated successfully" });
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/all-books/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await getBooksCollection().deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/borrow-book", async (req, res) => {
  const { bookId, userEmail, returnDate } = req.body;

  if (!bookId || !userEmail || !returnDate) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const booksCollection = getBooksCollection();
    const borrowedBooksCollection = getBorrowedBooksCollection();

    const borrowedBooks = await borrowedBooksCollection
      .find({ userEmail })
      .toArray();

    if (borrowedBooks.length >= 3) {
      return res
        .status(400)
        .json({ message: "You cannot borrow more than 3 books." });
    }

    const alreadyBorrowed = borrowedBooks.some(
      (borrowedBook) => borrowedBook.bookId.toString() === bookId
    );

    if (alreadyBorrowed) {
      return res
        .status(400)
        .json({ message: "You have already borrowed this book." });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });

    if (!book || typeof book.quantity !== "number" || book.quantity <= 0) {
      return res.status(400).json({ message: "Book is out of stock" });
    }

    const borrowedBookData = {
      ...book,
      bookId: book._id,
      userEmail,
      returnDate,
      borrowedAt: new Date(),
    };

    delete borrowedBookData._id;

    const result = await borrowedBooksCollection.insertOne(borrowedBookData);

    await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $inc: { quantity: -1 } }
    );

    res.status(200).json({
      message: "Book borrowed successfully",
      borrowedId: result.insertedId,
    });
  } catch (error) {
    console.error("Error borrowing book:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/return-book", async (req, res) => {
  const { bookId, userEmail } = req.body;
  if (!bookId || !userEmail) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const booksCollection = getBooksCollection();
    const borrowedBooksCollection = getBorrowedBooksCollection();

    const objectIdBookId = new ObjectId(bookId);

    const borrowedRecord = await borrowedBooksCollection.findOne({
      bookId: objectIdBookId,
      userEmail,
    });

    if (!borrowedRecord) {
      return res.status(404).json({ message: "No borrowed record found" });
    }

    await borrowedBooksCollection.deleteOne({ _id: borrowedRecord._id });

    await booksCollection.updateOne(
      { _id: objectIdBookId },
      { $inc: { quantity: 1 } }
    );

    res.status(200).json({ message: "Book returned successfully" });
  } catch (error) {
    console.error("Error returning book:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/borrowedbooks", async (req, res) => {
  const { email } = req.query;
  try {
    const borrowedBooks = await getBorrowedBooksCollection()
      .find({ userEmail: email })
      .toArray();
    res.status(200).json(borrowedBooks);
  } catch (error) {
    console.error("Error fetching borrowed books:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/auth", (req, res) => {
  const user = req.body;
  const token = jwt.sign({ email: user.email }, process.env.SECRET_KEY, {
    expiresIn: "1h",
  });

  res.cookie("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  });

  res.status(200).json({ message: "JWT token set in cookie" });
});

app.post("/logout", (req, res) => {
  try {
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.status(200).json({ message: "Cookie cleared" });
  } catch (error) {
    res.status(500).json({ message: "Error clearing the cookie" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
