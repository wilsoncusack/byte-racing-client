interface SolidityEditorProps {
  solidityCode: string;
  setSolidityCode: (code: string) => void;
}

const SolidityEditor: React.FC<SolidityEditorProps> = ({ solidityCode, setSolidityCode }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
  
      setSolidityCode(value.substring(0, start) + '\t' + value.substring(end));
  
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
    }
  };

  return (
    <div className="w-full md:w-1/2 p-4">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-gray-200 py-2 px-4 font-mono">
          pragma solidity 0.8.26;
        </div>
        <textarea
          className="w-full h-[calc(100vh-10rem)] p-4 bg-gray-50 text-gray-800 border-none resize-none focus:ring-2 focus:ring-blue-500 font-mono"
          value={solidityCode}
          onChange={(e) => setSolidityCode(e.target.value)}
          onKeyDown={handleKeyDown}
          wrap="off"
        />
      </div>
    </div>
  );
};

export default SolidityEditor;