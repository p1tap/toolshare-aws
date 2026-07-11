import { Route, Routes, Link } from "react-router";
import { Nav, Protected } from "./components/ui";
import Browse from "./pages/Browse";
import ToolDetail from "./pages/ToolDetail";
import MyRentals from "./pages/MyRentals";
import MyTools from "./pages/MyTools";
import NewTool from "./pages/NewTool";
import { Login, Signup, Verify } from "./pages/AuthPages";

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-5xl">🔍</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-amber-600 hover:underline">
        Back to browse
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <div className="min-h-dvh">
      <Nav />
      <Routes>
        <Route path="/" element={<Browse />} />
        <Route path="/tools/new" element={<Protected><NewTool /></Protected>} />
        <Route path="/tools/:toolId" element={<ToolDetail />} />
        <Route path="/rentals" element={<Protected><MyRentals /></Protected>} />
        <Route path="/my-tools" element={<Protected><MyTools /></Protected>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="mt-16 border-t border-stone-200 py-8 text-center text-xs text-stone-400 dark:border-stone-800">
        ToolShare — a serverless rental marketplace demo ·{" "}
        <a href="https://github.com/p1tap/toolshare-aws" className="hover:underline">
          source
        </a>
      </footer>
    </div>
  );
}
