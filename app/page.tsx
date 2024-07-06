"use client";

import { useState, useEffect } from "react";
import axios, { type AxiosError } from "axios";
import {
  type Abi,
  type Address,
  type DecodeEventLogReturnType,
  type Hex,
  decodeEventLog,
  decodeFunctionResult,
  encodeFunctionData,
  trim,
} from "viem";
import { useDebounce } from "./hooks/useDebounce";
import SolidityEditor from "./components/SolidityEditor";
import FunctionCallsPanel, {
  type FunctionCallResult,
} from "./components/FunctionCallsPanel";
import GameMap from "./components/GameMap";

const defaultSolidityCode = `pragma solidity 0.8.26;

contract Car {
  enum Move { Up, Down, Left, Right }

  struct Position {
    uint64 x;
    uint64 y;
  }

  function getNextMove(int8[][] calldata map, bytes calldata prevContext) 
      external 
      returns (Move move, bytes memory nextContext) 
  {
    // Implementation here
    return (Move.Right, "");
  }
}
`;

interface SolcCompileResponse {
  data: ContractData[];
  errors: SolcError[];
}

interface ContractData {
  name: string;
  abi: string;
  bytecode: string;
}

export interface SolcError {
  errorType: "Error" | "Warning";
  message: string;
  details: {
    line?: number;
    column?: number;
    codeSnippet?: string;
  };
}

type ExecutionResponse = {
  exitReason: string;
  reverted: boolean;
  result: Hex;
  gasUsed: string;
  logs: any[];
  traces: FunctionCallResult["traces"];
};

const IndexPage = () => {
  const [solidityCode, setSolidityCode] = useState(defaultSolidityCode);
  const [functionCalls, setFunctionCalls] = useState<string[]>([
    `getNextMove([[1, 0, 0, 0], [0, 0, 0, 0]], "")`,
  ]);
  const [bytecode, setBytecode] = useState("");
  const [abi, setAbi] = useState<Abi>([]);
  const [result, setResult] = useState<Array<FunctionCallResult>>([]);
  const [compilationErrors, setCompilationErrors] = useState<SolcError[]>([]);

  useEffect(() => {
    const compileSolidity = async () => {
      try {
        const response = await axios.post<SolcCompileResponse>(
          `${process.env.NEXT_PUBLIC_SERVER}/compile_solidity`,
          { code: solidityCode },
        );

        if (response.data.data.length > 0) {
          const lastContract =
            response.data.data[response.data.data.length - 1];
          setBytecode(lastContract.bytecode);
          setAbi(JSON.parse(lastContract.abi));
        }

        // Update compilation errors state
        setCompilationErrors(response.data.errors);
      } catch (error) {
        console.error("Compilation error:", error);
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError<{ message: string }>;
          if (axiosError.response) {
            setCompilationErrors([
              {
                errorType: "Error",
                message:
                  axiosError.response.data.message || "Unknown error occurred",
                details: {},
              },
            ]);
          }
        }
      }
    };

    const delayDebounceFn = setTimeout(() => {
      compileSolidity();
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [solidityCode]);

  useEffect(() => {
    const parseArgument = (arg: string): any => {
      try {
        return JSON.parse(arg);
      } catch {
        return arg;
      }
    };

    const calls: { name: string; args: any[] }[] = [];
    functionCalls.forEach((line) => {
      const match = line.match(/(\w+)\((.*)\)/);
      if (match) {
        const name = match[1];
        const argsString = match[2];

        // Split args, respecting nested structures
        const args = [];
        let currentArg = "";
        let nestLevel = 0;
        for (let char of argsString) {
          if (char === "," && nestLevel === 0) {
            args.push(parseArgument(currentArg.trim()));
            currentArg = "";
          } else {
            if (char === "[" || char === "{") nestLevel++;
            if (char === "]" || char === "}") nestLevel--;
            currentArg += char;
          }
        }
        if (currentArg) {
          args.push(parseArgument(currentArg.trim()));
        }

        calls.push({ name, args });
      }
    });
    console.log("calls", calls);
    if (bytecode && calls.length > 0) {
      debouncedHandleFunctionCalls(calls);
    }
  }, [bytecode, functionCalls]);

  const handleFunctionCalls = async (
    parsedCalls: { name: string; args: string[] }[],
  ) => {
    if (!abi.length) return;
    console.log("in handle function calls");

    const calls: { calldata: Hex; value: string; caller: Address }[] = [];
    for (const call of parsedCalls) {
      calls.push({
        calldata: encodeFunctionData({
          abi,
          functionName: call.name,
          args: call.args,
        }),
        value: "0",
        caller: "0x0000000000000000000000000000000000000000",
      });
    }

    try {
      const response = await axios.post<ExecutionResponse[]>(
        `${process.env.NEXT_PUBLIC_SERVER}/execute_calldatas_fork`,
        {
          bytecode,
          calls,
        },
      );
      const results = response.data;

      const output = [];
      for (const i in results) {
        const result = results[i];
        const returned = decodeFunctionResult({
          abi,
          functionName: parsedCalls[i].name,
          data: result.result,
        });
        const logs: DecodeEventLogReturnType[] = [];
        for (const log of result.logs) {
          logs.push(
            decodeEventLog({
              abi,
              data: log.data,
              topics: log.topics as any,
            }),
          );
        }
        output.push({
          call: parsedCalls[i].name,
          gasUsed: result.gasUsed,
          response: returned != undefined ? String(returned) : undefined,
          logs,
          traces: result.traces,
        });
      }

      setResult(output);
    } catch (error) {
      console.error("Execution error:", error);
    }
  };

  const debouncedHandleFunctionCalls = useDebounce(handleFunctionCalls, 500);

  const addFunctionCall = () => {
    setFunctionCalls((prev) => [...prev, ""]);
  };

  const handleFunctionCallsChange = (
    e: React.ChangeEvent<HTMLTextAreaElement> | null,
    index: number,
  ) => {
    setFunctionCalls((prev) => {
      const newCalls = [...prev];
      if (e === null) {
        // Delete operation
        newCalls.splice(index, 1);
        result.splice(index, 1);
      } else {
        // Update operation
        newCalls[index] = e.target.value;
      }
      return newCalls;
    });
  };

  return (
    <div className="bg-container">
      <div className="flex flex-col md:flex-row h-screen">
        <SolidityEditor
          solidityCode={solidityCode}
          setSolidityCode={setSolidityCode}
          errors={compilationErrors}
        />
        <FunctionCallsPanel
          functionCalls={functionCalls}
          result={result}
          addFunctionCall={addFunctionCall}
          handleFunctionCallsChange={handleFunctionCallsChange}
        />
      </div>
    </div>
  );
};

export default IndexPage;
