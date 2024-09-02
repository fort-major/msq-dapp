import { idlFactory } from "./declarations/statistics/statistics.did.js";
import { Actor, ActorSubclass, Agent } from "@dfinity/agent";

export type { _SERVICE as StatisticsBackend } from "./declarations/statistics/statistics.did";
import type { _SERVICE as StatisticsBackend } from "./declarations/statistics/statistics.did";
import { bytesToHex } from "@fort-major/msq-shared";

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
