interface ImportMeta {
  env: {
    MODE: "ic" | "dev";
    VITE_STATISTICS_CANISTER_ID: string;
    VITE_ROOT_KEY: string;
    VITE_IC_HOST: string;
  };
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare enum QRCodeCorrectLevel {
  L = 1,
  M = 0,
  Q = 3,
  H = 2,
}

interface IQRCodeOpts {
  width?: number;
  height?: number;
  colorDark?: string;
  colorLight?: string;
  correctLevel?: QRCodeCorrectLevel;
}

declare class QRCode {
  constructor(el: HTMLElement, opt: string | IQRCodeOpts);
  clear(): void;
  makeCode(input: string): void;
}
