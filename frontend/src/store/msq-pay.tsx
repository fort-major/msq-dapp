import { createStore, Store } from "solid-js/store";
import { createContext, createSignal, onCleanup, onMount, useContext } from "solid-js";
import { IChildren, ONE_HOUR_MS, ONE_MIN_MS, nowNs } from "../utils";
import { bytesToHex, delay, Principal, unreacheable } from "@fort-major/msq-shared";
import { E8s, EDs } from "../utils/e8s";
import { newMsqPayActor, PubShop } from "../backend";
import { TPrincipalIdStr, TTokenSymbol } from "./assets";

export type IInvoiceStatus =
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

export interface IInvoice {
  id: Uint8Array | number[];
  status: IInvoiceStatus;
  creator: Principal;
  exchange_rates_timestamp: bigint;
  created_at: bigint;
  shop_id: bigint;
  qty_usd: E8s;
}

export interface IToken {
  id: Principal;
  fee: EDs;
  ticker: string;
  logo_src: string;
  xrc_ticker: string;
}

export type TInvoiceId = Uint8Array;
export type TInvoiceIdHex = string;
export type TShopIdStr = string;

export interface IMsqPayStore {
  invoices: Store<Partial<Record<TInvoiceIdHex, IInvoice>>>;
  fetchInvoice: (id: TInvoiceId) => Promise<void>;

  msqUsdExchangeRates: Store<Partial<Record<TTokenSymbol, E8s>>>;
  fetchMsqUsdExchangeRates: () => Promise<void>;

  supportedTokens: Store<Partial<Record<TPrincipalIdStr, IToken>>>;
  fetchSupportedTokens: () => Promise<void>;

  shops: Store<Partial<Record<TShopIdStr, PubShop>>>;
  fetchShopById: (id: bigint) => Promise<void>;

  shopSubaccounts: Store<Partial<Record<string, Uint8Array>>>;
  fetchShopSubaccount: (id: bigint) => Promise<void>;
}

const MsqPayContext = createContext<IMsqPayStore>();

export function useMsqPay(): IMsqPayStore {
  const c = useContext(MsqPayContext);

  if (!c) {
    unreacheable("MSQ Pay context is uninitialized");
  }

  return c;
}

export function MsqPayStore(props: IChildren) {
  const [invoices, setInvoices] = createStore<IMsqPayStore["invoices"]>();
  const [refreshPeriodically, setRefreshPeriodically] = createSignal(true);
  const [msqUsdExchangeRates, setMsqUsdExchangeRates] = createStore<IMsqPayStore["msqUsdExchangeRates"]>();
  const [supportedTokens, setSupportedTokens] = createStore<IMsqPayStore["supportedTokens"]>();
  const [shops, setShops] = createStore<IMsqPayStore["shops"]>();
  const [shopSubaccounts, setShopSubaccounts] = createStore<IMsqPayStore["shopSubaccounts"]>();

  onMount(async () => {
    while (refreshPeriodically()) {
      fetchMsqUsdExchangeRates();
      fetchSupportedTokens();

      await delay(ONE_HOUR_MS);
    }
  });

  onCleanup(() => {
    setRefreshPeriodically(false);
  });

  const fetchMsqUsdExchangeRates: IMsqPayStore["fetchMsqUsdExchangeRates"] = async () => {
    const actor = await newMsqPayActor();
    const resp = await actor.get_exchange_rates({ timestamp: [] });

    const rates = resp.rates[0]!;

    for (let [ticker, rate] of rates) {
      setMsqUsdExchangeRates(ticker, E8s.new(rate));
    }
  };

  const fetchShopSubaccount: IMsqPayStore["fetchShopSubaccount"] = async (shopId: bigint) => {
    const actor = await newMsqPayActor();
    const sub = (await actor.get_shop_subaccount(shopId)) as Uint8Array;

    setShopSubaccounts(shopId.toString(), sub);
  };

  const fetchInvoice: IMsqPayStore["fetchInvoice"] = async (id) => {
    const actor = await newMsqPayActor();
    const { invoice_opt } = await actor.get_invoice({ invoice_id: id });

    if (invoice_opt.length === 0) {
      console.error(`Invoice ${bytesToHex(id)} not found`);
      return;
    }

    const invoice = invoice_opt[0];
    let iStatus: IInvoiceStatus;

    if ("Created" in invoice.status) {
      iStatus = {
        Created: {
          ttl: invoice.status.Created.ttl,
        },
      };
    } else if ("VerifyPayment" in invoice.status) {
      iStatus = {
        VerifyPayment: null,
      };
    } else {
      const status = invoice.status.Paid;
      iStatus = {
        Paid: {
          exchange_rate: EDs.new(status.exchange_rate.val, status.exchange_rate.decimals),
          qty: EDs.new(status.qty.val, status.qty.decimals),
          timestamp: status.timestamp,
          token_id: status.token_id,
        },
      };
    }

    const iInvoice: IInvoice = {
      id: invoice.id,
      shop_id: invoice.shop_id,
      creator: invoice.creator,
      created_at: invoice.created_at,
      exchange_rates_timestamp: invoice.exchange_rates_timestamp,
      qty_usd: E8s.new(invoice.qty_usd),
      status: iStatus,
    };

    const idStr = bytesToHex(iInvoice.id as Uint8Array);

    setInvoices(idStr, iInvoice);
  };

  const fetchSupportedTokens: IMsqPayStore["fetchSupportedTokens"] = async () => {
    const actor = await newMsqPayActor();
    const { supported_tokens } = await actor.get_supported_tokens({});

    for (let token of supported_tokens) {
      const iToken: IToken = {
        id: token.id,
        ticker: token.ticker,
        xrc_ticker: token.xrc_ticker,
        logo_src: token.logo_src,
        fee: EDs.new(token.fee.val, token.fee.decimals),
      };

      setSupportedTokens(iToken.id.toText(), iToken);
    }
  };

  const fetchShopById: IMsqPayStore["fetchShopById"] = async (id) => {
    const actor = await newMsqPayActor();

    console.log(actor);

    const { shop } = await actor.get_shop_by_id({ id });

    if (shop.length === 0) return;

    setShops(id.toString(), shop[0]);
  };

  return (
    <MsqPayContext.Provider
      value={{
        msqUsdExchangeRates,
        fetchMsqUsdExchangeRates,

        invoices,
        fetchInvoice,

        supportedTokens,
        fetchSupportedTokens,

        shops,
        fetchShopById,

        shopSubaccounts,
        fetchShopSubaccount,
      }}
    >
      {props.children}
    </MsqPayContext.Provider>
  );
}
