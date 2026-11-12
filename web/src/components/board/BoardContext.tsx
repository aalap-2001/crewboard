import { createContext, useContext } from "react";
import type { BoardDoc, ColumnDoc, TaskDoc, UserDoc } from "@/lib/types";

export interface BoardData {
  board: BoardDoc;
  columns: ColumnDoc[];
  tasks: TaskDoc[];
  tasksById: Map<string, TaskDoc>;
  columnsById: Map<string, ColumnDoc>;
  /** Board members in name order (may include deactivated people). */
  members: UserDoc[];
  usersById: Map<string, UserDoc>;
  /** Admin or manager: can edit board details, members and columns. */
  canManage: boolean;
}

export const BoardContext = createContext<BoardData | null>(null);

export function useBoard(): BoardData {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside a board page");
  return ctx;
}
