'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Abi, Hex, encodeFunctionData } from 'viem';

const defaultSolidityCode = `
contract SimpleStorage {
    uint256 public storedData;

    function set(uint256 x) public {
        storedData = x;
    }

    function get() public view returns (uint256) {
        return storedData;
    }
}
`;

interface CompileResponse {
  abi: string;
  bytecode: string;
}

const IndexPage = () => {
  const [solidityCode, setSolidityCode] = useState(defaultSolidityCode);
  const [functionCalls, setFunctionCalls] = useState('');
  const [bytecode, setBytecode] = useState('');
  const [abi, setAbi] = useState<Abi>([]);
  const [result, setResult] = useState<Array<{ call: string; gasUsed: string }>>([]);

  useEffect(() => {
    const compileSolidity = async () => {
      const updatedCode = `pragma solidity 0.8.26;\n${solidityCode}`;
      try {
        const response = await axios.post<CompileResponse>(process.env.NEXT_PUBLIC_SERVER + '/compile_solidity', { code: updatedCode });
        setBytecode(response.data.bytecode);
        setAbi(JSON.parse(response.data.abi));
      } catch (error) {
        console.error('Compilation error:', error);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      compileSolidity();
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [solidityCode]);

  useEffect(() => {
     const functionCallsArray = functionCalls.split('\n');
     functionCallsArray.forEach((line, index) => {
       const call = line.match(/(\w+)\((.*)\)/);
       if (call) {
         const name = call[1];
         const args = call[2].split(',').map((arg) => arg.trim()).filter(arg => arg !== '');
         handleFunctionCall({ name, args }, index);
       }
     });
  }, [bytecode])

  const handleFunctionCall = async (call: { name: string; args: string[] }, index: number) => {
    if (!abi.length) return;

    const calldata = encodeFunctionData({
      abi,
      functionName: call.name,
      args: call.args,
    });

    try {
      const response = await axios.post<{
        Success: {gas_used: string, output: {Call: Hex}}
      }>(process.env.NEXT_PUBLIC_SERVER + '/execute_calldata', {
        bytecode,
        calldata,
        value: '0',
        caller: '0x0000000000000000000000000000000000000000',
      });
      const result = response.data;
      setResult((prevResult) => {
        const newResult = [...prevResult];
        newResult[index] = { call: call.name, gasUsed: result.Success.gas_used };
        return newResult;
      });
    } catch (error) {
      console.error('Execution error:', error);
    }
  };

  const handleFunctionCallsChange = (e: React.ChangeEvent<HTMLTextAreaElement>, index: number) => {
    const newFunctionCalls = functionCalls.split('\n');
    newFunctionCalls[index] = e.target.value;
    setFunctionCalls(newFunctionCalls.join('\n'));
  
    const call = e.target.value.match(/(\w+)\((.*)\)/);
    if (call) {
      const name = call[1];
      const args = call[2].split(',').map((arg) => arg.trim()).filter(arg => arg !== '');
      handleFunctionCall({ name, args }, index);
    }
  };

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
    <div className="flex justify-between p-6 space-x-4">
      <div className="w-1/2 flex flex-col p-6 space-y-4 bg-gray-800 h-screen rounded">
        <p className="text-gray-300">pragma solidity 0.8.26;</p>
        <textarea
          className="w-full h-full p-4 bg-gray-800 text-gray-300 border border-gray-700 rounded resize-none"
          value={solidityCode}
          onChange={(e) => setSolidityCode(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="w-1/2 flex flex-col space-y-2">
        {functionCalls.split('\n').map((line, index) => (
          <div key={index} className="flex items-center">
            <textarea
              className="w-3/4 h-10 p-2 bg-gray-800 text-gray-300 resize-none"
              value={line}
              onChange={(e) => handleFunctionCallsChange(e, index)}
            />
            <div className="w-1/4 h-10 p-2 bg-gray-700 text-gray-300">
              {result[index] ? `gas: ${result[index].gasUsed}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndexPage;
