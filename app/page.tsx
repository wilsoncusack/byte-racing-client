'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Abi, Address, DecodeEventLogReturnType, Hex, decodeEventLog, decodeFunctionResult, encodeFunctionData } from 'viem';

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
}
`;

interface CompileResponse {
  Con
}

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
  const [functionCalls, setFunctionCalls] = useState('');
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
     const functionCallsArray = functionCalls.split('\n');
     const calls: { name: string; args: string[] }[] = []
     functionCallsArray.forEach((line, index) => {
       const call = line.match(/(\w+)\((.*)\)/);
       if (call) {
         const name = call[1];
         const args = call[2].split(',').map((arg) => arg.trim()).filter(arg => arg !== '');
         calls.push({ name, args });
       }
     });
     handleFunctionCalls(calls)
  }, [bytecode, functionCalls])

  const handleFunctionCalls = async (parsedCalls: { name: string; args: string[] }[]) => {
    if (!abi.length) return;

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

  const handleFunctionCallsChange = (e: React.ChangeEvent<HTMLTextAreaElement>, index: number) => {
    const newFunctionCalls = functionCalls.split('\n');
    newFunctionCalls[index] = e.target.value;
    setFunctionCalls(newFunctionCalls.join('\n'));
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
          className="w-full h-full p-4 bg-gray-800 text-gray-300 border border-gray-700 rounded resize-none whitespace-pre overflow-x-auto"
          value={solidityCode}
          onChange={(e) => setSolidityCode(e.target.value)}
          onKeyDown={handleKeyDown}
          wrap="off"
        />
      </div>
      <div className="w-1/2 flex flex-col space-y-2">
        {functionCalls.split('\n').map((line, index) => (
          <div key={index}>
          <div className="flex items-center">
            <textarea
              className="w-3/4 h-10 p-2 bg-gray-800 text-gray-300 resize-none"
              value={line}
              onChange={(e) => handleFunctionCallsChange(e, index)}
            />
            <div className="w-1/4 h-10 p-2 bg-gray-700 text-gray-300">
              {result[index] ? `gas: ${result[index].gasUsed}` : ''}
            </div>
          </div>
          <div className="flex flex-row justify-between bg-gray-300">
          {result[index] && <p className="font-mono">Returned: {result[index].response}</p>}
          {/* {result[index] &&
            <div className="w-1/2 float-right font-mono">Logs: 
              {result[index]?.logs.map((l, i) => <p key={i}>{l.eventName}({l.args?.join(', ')})</p>)}
            </div>
          } */}
          </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndexPage;
