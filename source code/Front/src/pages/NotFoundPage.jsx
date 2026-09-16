import { Link } from "react-router-dom";
import { EmptyState } from "../components/Feedback";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <div className="page">
      <div className="card">
        <EmptyState
          icon="search"
          title="Page not found"
          message="The page you are looking for does not exist or has been moved."
          action={
            <Link to="/" className="btn btn-primary">
              Back to dashboard
            </Link>
          }
        />
      </div>
    </div>
  );
}
