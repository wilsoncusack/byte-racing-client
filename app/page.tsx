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
import generateRandomMap from "./utils/generateRandomMap";
import { pressStart2P } from "./lib/fonts";
import ArcadeModal from "./components/ArcadeModal";

const defaultSolidityCode = `pragma solidity 0.8.26;

/// @notice Write your byteracing car and compete to be 
/// the most gas efficient to solve the mazes. 
contract Car {
  /// @dev Represents a move on the game map 
  /// NOTE Arrays are 0 indexed and so (0,0) is top left
  /// Up = y - 1, x
  /// Down = y + 1, x
  /// Left = y, x - 1
  /// Right = y, x + 1
  enum Move { Up, Down, Left, Right }

  struct Position {
    uint64 x;
    uint64 y;
  }

  /// @dev Struct used for example solution
  struct Context {
    Position position;
    Move lastMove;
    uint64 visitedCount;
  }

  /// @dev Convenience value for checkPosition
  int8 constant OUT_OF_BOUNDS = type(int8).max;

  /// @dev This is the core function for the game. Do not delete or change function signature
  /// @param map The game map, where 
  /// 0 = open space 
  /// 1 = wall / obstacle 
  /// -1 = finish line
  /// @param prevContext The nextContext from the previous call
  /// NOTE on first call is abi.encode(Position(<start position>))
  /// @return move The move to make
  /// @return nextContext The next context
  function getNextMove(int8[][] calldata map, bytes calldata prevContext)
  external pure
  returns (Move move, bytes memory nextContext)
  {
    // Example implementation, please edit

    Position memory position;
    Context memory context;
    bool isInitialMove = prevContext.length == 64;
    
    if (isInitialMove) {
        position = abi.decode(prevContext, (Position));
        context = Context(position, Move.Up, 0);
    } else {
        context = abi.decode(prevContext, (Context));
    }
    
    int8 up = checkPosition(Move.Up, context.position, map);
    int8 right = checkPosition(Move.Right, context.position, map);
    int8 down = checkPosition(Move.Down, context.position, map);
    int8 left = checkPosition(Move.Left, context.position, map);
    
    // Check if we've reached the finish
    if (up == -1) return (Move.Up, abi.encode(updateContext(context, Move.Up)));
    if (right == -1) return (Move.Right, abi.encode(updateContext(context, Move.Right)));
    if (down == -1) return (Move.Down, abi.encode(updateContext(context, Move.Down)));
    if (left == -1) return (Move.Left, abi.encode(updateContext(context, Move.Left)));
    
    // Array to store valid moves
    Move[4] memory validMoves;
    uint8 validMoveCount = 0;
    
    // Check each direction and add to valid moves if it's open
    if (up == 0 && context.lastMove != Move.Down) {
        validMoves[validMoveCount++] = Move.Up;
    }
    if (right == 0 && context.lastMove != Move.Left) {
        validMoves[validMoveCount++] = Move.Right;
    }
    if (down == 0 && context.lastMove != Move.Up) {
        validMoves[validMoveCount++] = Move.Down;
    }
    if (left == 0 && context.lastMove != Move.Right) {
        validMoves[validMoveCount++] = Move.Left;
    }
    
    // If there are valid moves, choose the first one
    if (validMoveCount > 0) {
        Move chosenMove = validMoves[0];
        return (chosenMove, abi.encode(updateContext(context, chosenMove)));
    }
    
    // If no valid moves, try to backtrack
    if (up == 0) return (Move.Up, abi.encode(updateContext(context, Move.Up)));
    if (right == 0) return (Move.Right, abi.encode(updateContext(context, Move.Right)));
    if (down == 0) return (Move.Down, abi.encode(updateContext(context, Move.Down)));
    if (left == 0) return (Move.Left, abi.encode(updateContext(context, Move.Left)));
    
    // If completely stuck, reset visited count and move up (or another default direction)
    context.visitedCount = 0;
    return (Move.Up, abi.encode(updateContext(context, Move.Up)));
  }

  /// @dev Helper function for example solution
  function updateContext(Context memory context, Move newMove) private pure returns (Context memory) {
      context.lastMove = newMove;
      context.visitedCount++;
      
      if (newMove == Move.Up && context.position.y > 0) context.position.y--;
      else if (newMove == Move.Down) context.position.y++;
      else if (newMove == Move.Left && context.position.x > 0) context.position.x--;
      else if (newMove == Move.Right) context.position.x++;
      
      return context;
  }

  /// @dev Helper function for example solution
  function checkPosition(Move move, Position memory position, int8[][] memory map) private pure returns (int8) {
      if (move == Move.Up) {
          if (position.y == 0) return OUT_OF_BOUNDS;
          return map[position.y - 1][position.x];
      }
      if (move == Move.Down) {
          if (position.y >= map.length - 1) return OUT_OF_BOUNDS;
          return map[position.y + 1][position.x];
      }
      if (move == Move.Left) {
          if (position.x == 0) return OUT_OF_BOUNDS;
          return map[position.y][position.x - 1];
      }
      if (move == Move.Right) {
          if (position.x >= map[0].length - 1) return OUT_OF_BOUNDS;
          return map[position.y][position.x + 1];
      }
      return OUT_OF_BOUNDS;
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

export type Outcome = "Finish" | "Crash" | "Revert" | "Halt" | "MaxGas";

export interface RaceResult {
  path: { x: number; y: number }[];
  outcome: Outcome;
  gas_used: number;
  message?: string;
}

const IndexPage = () => {
  const [solidityCode, setSolidityCode] = useState(defaultSolidityCode);
  const [functionCalls, setFunctionCalls] = useState<string[]>([
    `getNextMove([[1, 0, 0, 0], [0, 0, 0, 0]], "")`,
  ]);
  const [bytecode, setBytecode] = useState("");
  const [abi, setAbi] = useState<Abi>([]);
  const [result, setResult] = useState<Array<FunctionCallResult>>([]);
  const [compilationErrors, setCompilationErrors] = useState<SolcError[]>([]);
  const [map, setMap] = useState([
    [0, 0, 0, 1, 1, 1],
    [1, 1, 0, 0, 1, -1],
    [1, 0, 0, 0, 1, 0],
    [1, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 1, 0],
  ]);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);

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
    setRaceResult(null);
    const updateRaceResponse = async () => {
      if (bytecode == "") return;
      const raceResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_SERVER}/byterace`,
        {
          map: map,
          bytecode: bytecode,
        },
      );

      setRaceResult(raceResponse.data);
    };
    updateRaceResponse();
  }, [bytecode, map]);

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

  const regenerateMap = () => {
    setMap(generateRandomMap(6, 5));
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
      <ArcadeModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        title="What is This?"
        content={
          <p>
            Since the dawn of time, programmers have competed to write the most
            efficient code. The
            <a
              href="https://ethereum.org/en/developers/docs/evm/"
              className="underline"
            >
              {" "}
              Ethereum Virtual Machine (EVM)
            </a>
            , where every operation has a "gas" accounting, offers a new
            frontier in this contest.
            <br />
            <br />
            The goal of this game is to produce the most efficient EVM bytecode
            for navigating mazes.
            <br />
            <br />
            Today, this site is a playground, but more is coming soon.
            <br />
            <br />
            Credit to{" "}
            <a href="https://speedtracer.com/" className="underline">
              Speedtracer{" "}
            </a>
            and{" "}
            <a
              href="https://x.com/transmissions11/status/1561100140160593920"
              className="underline"
            >
              0xManaco
            </a>{" "}
            for inspiring many of the ideas here.
          </p>
        }
      />
      <div className=" p-10">
        <button
          className={`arcade-button p-10 ${pressStart2P.className}`}
          onClick={() => setModalIsOpen(true)}
        >
          What is This?
        </button>
      </div>
      <div className="flex flex-col md:flex-row h-screen">
        <SolidityEditor
          solidityCode={solidityCode}
          setSolidityCode={setSolidityCode}
          errors={compilationErrors}
        />
        <div>
          <div className="mt-5 flex flex-col ">
            <div className="">
              {raceResult && (
                <div className="flex flex-col items-center space-y-4">
                  <div
                    className={`bg-gradient-to-r from-purple-900 to-indigo-900 p-4 rounded-lg shadow-lg border border-pink-500 w-full max-w-md ${pressStart2P.className}`}
                  >
                    <p
                      className={`text-cyan-400 ${pressStart2P.className} text-md mb-2`}
                    >
                      Outcome:{" "}
                      <span className="text-pink-500 font-bold">
                        {raceResult.outcome}
                      </span>
                    </p>
                    {raceResult.message && (
                      <p className="text-cyan-400 text-md mb-2">
                        Failure reason:{" "}
                        <span className="text-yellow-400">
                          {raceResult.message}
                        </span>
                      </p>
                    )}
                    <p className="text-cyan-400 text-md">
                      Gas Used:{" "}
                      <span className="text-green-400 font-bold">
                        {raceResult.gas_used}
                      </span>
                    </p>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 blur opacity-25"></div>
                    <div className="relative">
                      <GameMap
                        cellSize={40}
                        outcome={raceResult.outcome}
                        path={raceResult.path}
                        map={map}
                      />
                    </div>
                  </div>
                  <button
                    onClick={regenerateMap}
                    className={`arcade-button arcade-button-orange ${pressStart2P.className}`}
                  >
                    Regenerate Map
                  </button>
                </div>
              )}
            </div>
            {/* <FunctionCallsPanel
          functionCalls={functionCalls}
          result={result}
          addFunctionCall={addFunctionCall}
          handleFunctionCallsChange={handleFunctionCallsChange}
        /> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndexPage;
