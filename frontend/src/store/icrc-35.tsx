import { createContext, createSignal, useContext } from "solid-js";
import { IICRC1TransferRequest, IMSQPayRequest, unreacheable } from "@fort-major/msq-shared";
import { IChildren } from "../utils";
import { ICRC35AsyncRequest } from "@fort-major/msq-client";

export type TLoginRequest = undefined;
type TICRC35Request = IICRC1TransferRequest | IMSQPayRequest | TLoginRequest;
type IMSQICRC35Request = ICRC35AsyncRequest<TICRC35Request>;

interface IICRC35Context {
  getIcrc35Request: <T extends TICRC35Request>() => ICRC35AsyncRequest<T> | undefined;
  setIcrc35Request: (request: ICRC35AsyncRequest<TICRC35Request>) => void;
}

const ICRC35Context = createContext<IICRC35Context>();

export function useICRC35Store(): IICRC35Context {
  const ctx = useContext(ICRC35Context);

  if (!ctx) {
    unreacheable("ICRC35 context is uninitialized");
  }

  return ctx;
}

export function ICRC35Store(props: IChildren) {
  const [getIcrc35Request, setIcrc35Request] = createSignal<IMSQICRC35Request | undefined>();

  return (
    <ICRC35Context.Provider
      value={{
        getIcrc35Request: getIcrc35Request as <T extends TICRC35Request>() => ICRC35AsyncRequest<T> | undefined,
        setIcrc35Request,
      }}
    >
      {props.children}
    </ICRC35Context.Provider>
  );
}
