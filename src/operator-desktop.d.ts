import type { OperatorState, OperatorCommand } from './operatorProtocol';
declare global { interface Window { orquestraOperator?: { isOperator: boolean; open(): Promise<boolean>; close(): Promise<void>; publish(state: OperatorState): Promise<void>; onState(callback: (state: OperatorState) => void): () => void; onClosed(callback: () => void): () => void; onCommand(callback: (command: OperatorCommand) => void): () => void; command(command: OperatorCommand): void; minimize(): Promise<void>; setExpanded(expanded: boolean): Promise<void> } } }
export {};
