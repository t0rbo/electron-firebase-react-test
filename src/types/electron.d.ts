interface IpcBridge {
  logs?: {
    onMainProcessLog: (callback: (log: {type: string, message: string}) => void) => () => void;
  };
} 