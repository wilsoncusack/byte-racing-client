import type { SolcError } from "../page";

interface ErrorDisplayProps {
  errors: SolcError[];
}

const CompileErrorDisplay: React.FC<ErrorDisplayProps> = ({ errors }) => {
  if (errors.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-red-100 rounded-lg">
      <h3 className="text-lg font-semibold text-red-800 mb-2">
        Compilation Issues:
      </h3>
      {errors.map((error, index) => (
        <div
          key={index}
          className={`mb-2 p-2 rounded ${error.errorType === "Error" ? "bg-red-200" : "bg-yellow-200"}`}
        >
          <p className="font-semibold">
            {error.errorType}: {error.message}
          </p>
          {error.details.line && <p>Line: {error.details.line}</p>}
          {error.details.column && <p>Column: {error.details.column}</p>}
          {error.details.codeSnippet && (
            <pre className="mt-2 p-2 bg-gray-100 rounded">
              <code>{error.details.codeSnippet}</code>
            </pre>
          )}
        </div>
      ))}
    </div>
  );
};

export default CompileErrorDisplay;
