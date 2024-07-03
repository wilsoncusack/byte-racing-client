import type React from "react";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { SolcError } from "../page";
import CompileErrorDisplay from "./CompileErrorDisplay";

interface SolidityEditorProps {
  solidityCode: string;
  setSolidityCode: (code: string) => void;
  errors: SolcError[];
}

const SolidityEditor: React.FC<SolidityEditorProps> = ({
  solidityCode,
  setSolidityCode,
  errors,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  const relevantErrors = useMemo(() => {
    if (!errors) return [];
    return errors.filter((e) => e.errorType !== "Warning");
  }, [errors]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      setSolidityCode(`${value.substring(0, start)}\t${value.substring(end)}`);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
    }
  };

  const updateLineNumbers = useCallback(() => {
    if (textareaRef.current) {
      const lines = textareaRef.current.value.split("\n");
      setLineCount(lines.length);
    }
  }, []);

  useEffect(() => {
    updateLineNumbers();
  }, [updateLineNumbers]);

  return (
    <div className="w-full md:w-1/2 p-4">
      {relevantErrors.length > 0 && (
        <CompileErrorDisplay errors={relevantErrors} />
      )}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="relative flex">
          <div className="bg-gray-800 pl-6 text-gray-500 font-mono text-sm p-4 text-right select-none">
            1
          </div>
          <div className="bg-gray-800 text-gray-200 py-2 px-4 font-mono flex-grow">
            pragma solidity 0.8.26;
          </div>
        </div>
        <div className="relative flex">
          <div
            ref={lineNumbersRef}
            className="bg-gray-100 text-gray-500 font-mono text-sm p-4 text-right select-none"
            style={{ minWidth: "3em" }}
          >
            {Array.from({ length: lineCount }, (_, i: number) => (
              <div key={i + 2}>{i + 2}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="flex-grow h-[calc(100vh-10rem)] p-4 bg-gray-50 text-gray-800 border-none resize-none focus:ring-2 focus:ring-blue-500 font-mono leading-5"
            value={solidityCode}
            onChange={(e) => {
              setSolidityCode(e.target.value);
              updateLineNumbers();
            }}
            onKeyDown={handleKeyDown}
            wrap="off"
          />
        </div>
      </div>
    </div>
  );
};

export default SolidityEditor;
