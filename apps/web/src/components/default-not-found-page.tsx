import { ErrorPage } from "#components/error-page";

export function DefaultNotFoundPage() {
  return (
    <ErrorPage
      title="Not Found"
      description="The page you are looking for does not exist."
    />
  );
}
