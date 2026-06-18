export interface PlayerCell {
  id: string;
  x: number;
  y: number;
  radius: number;
  mass: number;
}

export interface Player {
  id: string;
  name: string;
  cells: PlayerCell[];
  score: number;
  color: string;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface GameState {
  width: number;
  height: number;
  players: Player[];
  food: Food[];
}

export type ServerMessageType = "welcome" | "tick";
export type ClientMessageType = "join" | "input";

export interface ServerMessageWelcome {
  type: "welcome";
  playerId: string;
  width: number;
  height: number;
}

export interface ServerMessageTick {
  type: "tick";
  state: GameState;
}

export interface ClientMessageJoin {
  type: "join";
  name: string;
}

export interface ClientMessageInput {
  type: "input";
  angle: number;
  speed: number;
}

export type ServerMessage = ServerMessageWelcome | ServerMessageTick;
export type ClientMessage = ClientMessageJoin | ClientMessageInput;
