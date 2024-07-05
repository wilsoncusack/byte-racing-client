import React, { useRef, useEffect, useState, useMemo } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
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
  const editorRef = useRef<any>(null);

  const relevantErrors = useMemo(() => {
    if (!errors) return [];
    return errors.filter((e) => e.errorType !== "Warning");
  }, [errors]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  return (
    <div className="w-full md:w-3/4 p-4">
      {relevantErrors.length > 0 && (
        <CompileErrorDisplay errors={relevantErrors} />
      )}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        <div className="relative flex h-[calc(100vh-10rem)] p-4">
          <Editor
            height="100%"
            defaultLanguage="sol"
            value={solidityCode}
            onChange={(value) => setSolidityCode(value || "")}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: "on",
              glyphMargin: true,
              folding: true,
              lineNumbersMinChars: 0,
              overviewRulerBorder: false,
              language: "sol",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SolidityEditor;
