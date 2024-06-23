'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Abi, Address, DecodeEventLogReturnType, Hex, decodeEventLog, decodeFunctionResult, encodeFunctionData, trim } from 'viem';
import { useDebounce } from './hooks/useDebounce';

const defaultSolidityCode = `
contract SimpleStorage {
    uint256 public storedData;
    event StoredDataUpdated(uint);

    function set(uint256 x) public {
        storedData = x;
        emit StoredDataUpdated(x);
    }

    function get() public view returns (uint256) {
        return storedData;
    }

    function getBlockNumber() public view returns (uint256) {
      return block.number;
  }
}
`;

type Log = {
  address: Address, 
  data: Hex, 
  topics: Hex[]
}

type ExecutionResponse = {
  exitReason: string,
  reverted: boolean,
  result: Hex,
  gasUsed: string,
  logs: any[]
}

type ContractData = {
  name: string, 
  abi: string,
  bytecode: string
}

const IndexPage = () => {
  const [solidityCode, setSolidityCode] = useState(defaultSolidityCode);
  const [functionCalls, setFunctionCalls] = useState<string[]>([
    'get()',
    'set(1)',
    'get()',
    'getBlockNumber()',
  ]);
  const [bytecode, setBytecode] = useState('');
  const [abi, setAbi] = useState<Abi>([]);
  const [result, setResult] = useState<Array<{ call: string; gasUsed: string, response: string | undefined, logs: DecodeEventLogReturnType[]}>>([]);

  useEffect(() => {
    const compileSolidity = async () => {
      const updatedCode = `pragma solidity 0.8.26;\n${solidityCode}`;
      try {
        const response = await axios.post<ContractData[]>(process.env.NEXT_PUBLIC_SERVER + '/compile_solidity', { code: updatedCode });
        if (response.data.length > 0) {
          const last = response.data.length - 1;
          setBytecode(response.data[last].bytecode);
          setAbi(JSON.parse(response.data[last].abi));
        }
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
    //  const functionCallsArray = functionCalls.split('\n');
     const calls: { name: string; args: string[] }[] = []
     functionCalls.forEach((line, index) => {
       const call = line.match(/(\w+)\((.*)\)/);
       if (call) {
         const name = call[1];
         const args = call[2].split(',').map((arg) => arg.trim()).filter(arg => arg !== '');
         calls.push({ name, args });
       }
     });
     if (bytecode && calls.length > 0) {
      debouncedHandleFunctionCalls(calls);
    }
  }, [bytecode, functionCalls])

  const handleFunctionCalls = async (parsedCalls: { name: string; args: string[] }[]) => {
    if (!abi.length) return;
    console.log('in handle function calls')

    const calls: {calldata: Hex, value: String, caller: Address}[] = []
    for (const call of parsedCalls) {
      calls.push({
        calldata: encodeFunctionData({
          abi,
          functionName: call.name,
          args: call.args,
        }),
        value: '0',
        caller: '0x0000000000000000000000000000000000000000'
      })
    }

    try {
      const response = await axios.post<
      ExecutionResponse[]
      >(process.env.NEXT_PUBLIC_SERVER + '/execute_calldatas_fork', {
        bytecode,
        calls
      });
      const results = response.data;

      const output = []
      for (const i in results) {
        const result = results[i]
        const returned = decodeFunctionResult({
          abi,
          functionName: parsedCalls[i].name,
          data: result.result
        })
        const logs: DecodeEventLogReturnType[] = []
        for (const log of result.logs) {
          logs.push(decodeEventLog({
            abi,
            data: log.data,
            topics: log.topics as any
          }))
        }
        output.push({ 
              call: parsedCalls[i].name, 
              gasUsed: result.gasUsed, 
              response: returned != undefined ? String(returned) : undefined,
              logs
            })
      }

      setResult(output)
    } catch (error) {
      console.error('Execution error:', error);
    }
  };

  const debouncedHandleFunctionCalls = useDebounce(handleFunctionCalls, 500);

  const addFunctionCall = () => {
    setFunctionCalls(prev => [...prev, '']);
  };

  const handleFunctionCallsChange = (e: React.ChangeEvent<HTMLTextAreaElement> | null, index: number) => {
    setFunctionCalls(prev => {
      const newCalls = [...prev];
      if (e === null) {
        // Delete operation
        newCalls.splice(index, 1);
      } else {
        // Update operation
        newCalls[index] = e.target.value;
      }
      return newCalls;
    });
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
    <div className="flex flex-col md:flex-row h-screen bg-gray-100">
      {/* Solidity Code Editor */}
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

      {/* Function Calls and Results */}
      <div className="w-full md:w-1/2 p-4 overflow-y-auto">
        <div className="space-y-4">
        {functionCalls.map((call, index) => (
          <div key={index} className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="flex items-center p-2 bg-gray-50">
              <div className="flex-grow relative">
                <textarea
                  className="w-full p-2 bg-white text-gray-800 resize-none focus:outline-none font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={call}
                  onChange={(e) => handleFunctionCallsChange(e, index)}
                  rows={1}
                  placeholder="Enter function call (e.g., set(1))"
                />
              </div>
              <button
                className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded"
                onClick={() => handleFunctionCallsChange(null, index)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
              {result[index] && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                  
                  <div className="flex items-baseline">
                    <span className="text-sm font-semibold text-gray-600 w-20">Returned:</span>
                    <span className="font-mono text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {result[index].response}
                    </span>
                  </div>
                  
                  <div className="flex items-baseline">
                    <span className="text-sm font-semibold text-gray-600 w-20">Gas used:</span>
                    <span className="font-mono text-sm text-green-600">
                      {result[index].gasUsed}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-gray-600">Logs:</span>
                    {result[index].logs.map((log, i) => (
                      <div key={i} className="ml-5 p-2 bg-yellow-50 rounded-md">
                        <span className="font-mono text-sm text-yellow-700">
                          {log.eventName}
                        </span>
                        <span className="font-mono text-xs text-yellow-600">
                          ({log.args?.join(', ')})
                        </span>
                      </div>
                    ))}
                  </div>
                  
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
          onClick={addFunctionCall}
        >
          Add Function Call
        </button>
      </div>
    </div>
  );
};

export default IndexPage;
