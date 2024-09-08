import { idlFactory } from "./declarations/statistics/statistics.did.js";
import { Actor, ActorMethod, ActorSubclass, Agent } from "@dfinity/agent";

export type { _SERVICE as StatisticsBackend } from "./declarations/statistics/statistics.did";
import type { _SERVICE as StatisticsBackend } from "./declarations/statistics/statistics.did";
import { bytesToHex, Principal } from "@fort-major/msq-shared";
import { getIcHostOrDefault, makeAnonymousAgent } from "./utils/index.js";

export function createStatisticsBackendActor(agent: Agent): ActorSubclass<StatisticsBackend> {
  return Actor.createActor(idlFactory, { agent, canisterId: import.meta.env.VITE_STATISTICS_CANISTER_ID });
}

export type Hex = string;
// text encoded bigint
export type Dec = string;
// icp account (hex) id or principal(text)+subaccount(hex) hashed as icp account
export type Account = string;

export type TxnKind = "Mint" | "Burn" | "Transfer" | "Approve";

export type TxnExternal = {
  id: Dec;
  kind: TxnKind;
  timestampNano: Dec;
  memo: Hex;
  amount?: Dec; // Mint, Burn, Transfer, Approve (allowance)
  from?: Account; // Burn, Transfer, Approve
  spender?: Account; // Burn, Transfer, Approve
  fee?: Dec; // Transfer, Approve
  to?: Account; // Mint, Transfer
  expiresAtNano?: Dec; // Approve
};

export type Txn = {
  id: bigint;
  sign: "+" | "-";
  timestampMs: number;
  amount: bigint;
  account:
    | {
        principalId: string;
        subaccount?: string;
      }
    | string;
  memo?: string;
};

function convertTxns(accountId: string, txns: TxnExternal[]): Txn[] {
  return txns
    .filter((txn) => txn.kind === "Transfer")
    .map((txn) => {
      const [sign, account] = accountId === txn.from ? ["-", txn.to] : ["+", txn.from];
      let accOrPair:
        | {
            principalId: string;
            subaccount?: string;
          }
        | string;

      if (account!.includes(":")) {
        let [prin, sub]: [string, string | undefined] = account!.split(":") as [string, string];

        // TODO: calculate default subaccount once
        if (sub === bytesToHex(new Uint8Array(32))) {
          sub = undefined;
        }

        accOrPair = { principalId: prin, subaccount: sub };
      } else {
        accOrPair = account!;
      }

      return {
        id: BigInt(txn.id),
        sign: sign as "-" | "+",
        account: accOrPair,
        amount: BigInt(txn.amount!),
        memo: txn.memo,
        timestampMs: Number(BigInt(txn.timestampNano) / 1000000n),
      };
    });
}

export const msqPayIdl = ({ IDL }: any) => {
  const EDs = IDL.Record({ val: IDL.Nat, decimals: IDL.Nat8 });
  const Token = IDL.Record({
    id: IDL.Principal,
    fee: EDs,
    ticker: IDL.Text,
    logo_src: IDL.Text,
    xrc_ticker: IDL.Text,
  });
  const GetExchangeRatesRequest = IDL.Record({ timestamp: IDL.Opt(IDL.Nat64) });
  const GetExchangeRatesResponse = IDL.Record({
    rates: IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat))),
  });
  const GetInvoiceRequest = IDL.Record({ invoice_id: IDL.Vec(IDL.Nat8) });
  const InvoiceStatus = IDL.Variant({
    Paid: IDL.Record({
      qty: EDs,
      token_id: IDL.Principal,
      timestamp: IDL.Nat64,
      exchange_rate: EDs,
    }),
    VerifyPayment: IDL.Null,
    Created: IDL.Record({ ttl: IDL.Nat8 }),
  });
  const Invoice = IDL.Record({
    id: IDL.Vec(IDL.Nat8),
    status: InvoiceStatus,
    creator: IDL.Principal,
    exchange_rates_timestamp: IDL.Nat64,
    created_at: IDL.Nat64,
    shop_id: IDL.Nat64,
    qty_usd: IDL.Nat,
  });
  const GetInvoiceResponse = IDL.Record({ invoice_opt: IDL.Opt(Invoice) });
  const GetSupportedTokensResponse = IDL.Record({
    supported_tokens: IDL.Vec(Token),
  });
  const GetShopByIdRequest = IDL.Record({ id: IDL.Nat64 });
  const PubShop = IDL.Record({
    id: IDL.Nat64,
    icon_base64: IDL.Text,
    name: IDL.Text,
    description: IDL.Text,
  });
  const GetShopByIdResponse = IDL.Record({ shop: IDL.Opt(PubShop) });
  return IDL.Service({
    get_shop_subaccount: IDL.Func([IDL.Nat64], [IDL.Vec(IDL.Nat8)], ["query"]),
    get_exchange_rates: IDL.Func([GetExchangeRatesRequest], [GetExchangeRatesResponse], ["query"]),
    get_invoice: IDL.Func([GetInvoiceRequest], [GetInvoiceResponse], ["query"]),
    get_supported_tokens: IDL.Func([IDL.Record({})], [GetSupportedTokensResponse], ["query"]),
    get_shop_by_id: IDL.Func([GetShopByIdRequest], [GetShopByIdResponse], ["query"]),
  });
};

export interface EDs {
  val: bigint;
  decimals: number;
}
export interface GetExchangeRatesRequest {
  timestamp: [] | [bigint];
}
export interface GetExchangeRatesResponse {
  rates: [] | [Array<[string, bigint]>];
}
export interface GetInvoiceRequest {
  invoice_id: Uint8Array | number[];
}
export interface GetInvoiceResponse {
  invoice_opt: [] | [Invoice];
}
export interface GetShopByIdRequest {
  id: bigint;
}
export interface GetShopByIdResponse {
  shop: [] | [PubShop];
}
export interface PubShop {
  id: bigint;
  icon_base64: string;
  name: string;
  description: string;
}
export interface GetSupportedTokensResponse {
  supported_tokens: Array<Token>;
}
export interface Invoice {
  id: Uint8Array | number[];
  status: InvoiceStatus;
  creator: Principal;
  exchange_rates_timestamp: bigint;
  created_at: bigint;
  shop_id: bigint;
  qty_usd: bigint;
}
export type InvoiceStatus =
  | {
      Paid: {
        qty: EDs;
        token_id: Principal;
        timestamp: bigint;
        exchange_rate: EDs;
      };
    }
  | { VerifyPayment: null }
  | { Created: { ttl: number } };

export interface Token {
  id: Principal;
  fee: EDs;
  ticker: string;
  logo_src: string;
  xrc_ticker: string;
}
export interface MsqPayActor {
  get_shop_subaccount: ActorMethod<[bigint], Uint8Array>;
  get_exchange_rates: ActorMethod<[GetExchangeRatesRequest], GetExchangeRatesResponse>;
  get_invoice: ActorMethod<[GetInvoiceRequest], GetInvoiceResponse>;
  get_supported_tokens: ActorMethod<[{}], GetSupportedTokensResponse>;
  get_shop_by_id: ActorMethod<[GetShopByIdRequest], GetShopByIdResponse>;
}

export const MSQ_PAY_PRINCIPAL = Principal.fromText("prlga-2iaaa-aaaak-akp4a-cai");

export async function newMsqPayActor() {
  const agent = await makeAnonymousAgent(getIcHostOrDefault());

  return Actor.createActor<MsqPayActor>(msqPayIdl, { canisterId: MSQ_PAY_PRINCIPAL, agent });
}

export const sonicInfoIdl = ({ IDL }: any) => {
  const Data = IDL.Record({
    id: IDL.Nat,
    volumeUSD1d: IDL.Float64,
    volumeUSD7d: IDL.Float64,
    totalVolumeUSD: IDL.Float64,
    name: IDL.Text,
    volumeUSD: IDL.Float64,
    feesUSD: IDL.Float64,
    priceUSDChange: IDL.Float64,
    address: IDL.Text,
    txCount: IDL.Int,
    priceUSD: IDL.Float64,
    standard: IDL.Text,
    symbol: IDL.Text,
  });

  return IDL.Service({
    getAllTokens: IDL.Func([], [IDL.Vec(Data)], ["query"]),
  });
};

export interface ISonicInfoEntry {
  id: bigint;
  volumeUSD1d: number;
  volumeUSD7d: number;
  totalVolumeUSD: number;
  name: string;
  volumeUSD: number;
  feesUSD: number;
  priceUSDChange: number;
  address: string;
  txCount: bigint;
  priceUSD: number;
  standart: string;
  symbol: string;
}

export interface SonicInfoActor {
  getAllTokens: ActorMethod<[], Array<ISonicInfoEntry>>;
}

export async function newSonicInfoActor() {
  const agent = await makeAnonymousAgent();

  return Actor.createActor<SonicInfoActor>(sonicInfoIdl, { canisterId: "ggzvv-5qaaa-aaaag-qck7a-cai", agent });
}
