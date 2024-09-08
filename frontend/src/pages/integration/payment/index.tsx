import {
  Match,
  Show,
  Switch,
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { Principal } from "@dfinity/principal";
import { PaymentPageContainer, PaymentPageHeading, PaymentPageWrapper } from "./style";
import { ColorAccent, H3, Text } from "../../../ui-kit/typography";
import {
  ErrorCode,
  IICRC1TransferRequest,
  IMSQPayRequest,
  TAccountId,
  bytesToHex,
  delay,
  err,
  hexToBytes,
  originToHostname,
  tokensToStr,
} from "@fort-major/msq-shared";
import { IReceivePopupProps, ReceivePopup } from "../../cabinet/my-assets/receive";
import { IPaymentCheckoutPageProps } from "./checkout";
import { useAssetData } from "../../../store/assets";
import { ROOT } from "../../../routes";
import { TThirdPartyWalletKind, useThirdPartyWallet } from "../../../store/wallets";
import { useICRC35Store } from "../../../store/icrc-35";
import { WalletSelector } from "../../../components/wallet-selector";
import { PaymentAccountSelector } from "../../../components/account-selector";
import { useMsqPay } from "../../../store/msq-pay";
import { MSQ_PAY_PRINCIPAL } from "../../../backend";
import { calcInvoiceMemo, nowNs } from "../../../utils";
import { SupportedTokenSelector } from "../../../components/supported-token-selector";
import { EDs } from "../../../utils/e8s";
import { Shop } from "../../../components/shop";

export type TPaymentPageMode = "msq-pay-icrc-35" | "msq-pay-url" | "icrc-1-icrc-35" | "icrc-1-url";

export function PaymentPage() {
  const { assets, assetMetadata } = useAssetData();
  const { getIcrc35Request } = useICRC35Store();
  const navigate = useNavigate();
  const { initWallet, setWalletAccount } = useThirdPartyWallet();
  const [searchParams] = useSearchParams();
  const { invoices, fetchInvoice, shops, fetchShopById, msqUsdExchangeRates, shopSubaccounts, fetchShopSubaccount } =
    useMsqPay();

  const [receivePopupProps, setReceivePopupProps] = createSignal<IReceivePopupProps | null>(null);
  const [pageState, setPageState] = createSignal<"wallet-select" | "asset-select" | "account-select">("wallet-select");
  const [assetId, setAssetId] = createSignal<Principal | undefined>();
  const [amount, setAmount] = createSignal<EDs | undefined>();

  const icrc35Icrc1PaymentRequest = createMemo(() => {
    const req = getIcrc35Request<IICRC1TransferRequest>();

    if (!req || !req.payload.canisterId) return undefined;

    return req;
  });
  const icrc35MsqPaymentRequest = createMemo(() => {
    const req = getIcrc35Request<IMSQPayRequest>();

    if (!req || !req.payload.invoiceId) return undefined;

    return req;
  });

  const urlIcrc1PaymentRequest = createMemo(() => {
    if (!searchParams["canister-id"] || !searchParams["to-principal"] || !searchParams["amount"]) return undefined;

    const req: IICRC1TransferRequest = {
      canisterId: searchParams["canister-id"],
      to: {
        owner: searchParams["to-principal"],
        subaccount: searchParams["to-subaccount"] ? hexToBytes(searchParams["to-subaccount"]) : undefined,
      },
      memo: searchParams.memo ? hexToBytes(searchParams.memo) : undefined,
      amount: BigInt(searchParams.amount),
    };

    return req;
  });

  const urlMsqPaymentRequest = createMemo(() => {
    if (!searchParams["invoice-id"]) return undefined;

    const invoiceId = hexToBytes(searchParams["invoice-id"]);

    const req: IMSQPayRequest = {
      invoiceId,
    };

    return req;
  });

  const icrc1TransferReq = createMemo(() => {
    const icrc35 = icrc35Icrc1PaymentRequest();
    if (icrc35) return icrc35.payload;

    const url = urlIcrc1PaymentRequest();
    if (url) return url;

    return undefined;
  });

  const msqPayReq = createMemo(() => {
    const icrc35 = icrc35MsqPaymentRequest();
    if (icrc35) return icrc35.payload;

    const url = urlMsqPaymentRequest();
    if (url) return url;

    return undefined;
  });

  const msqPayInvoice = () => {
    const req = msqPayReq();
    if (!req) return;

    return invoices[bytesToHex(req.invoiceId)];
  };

  const msqPayShop = () => {
    const invoice = msqPayInvoice();
    if (!invoice) return undefined;

    return shops[invoice.shop_id.toString()];
  };

  createEffect(
    on(msqPayInvoice, (inv) => {
      if (!inv) return;
      fetchShopSubaccount(inv.shop_id);
    })
  );

  const msqPayShopSubaccount = () => {
    const inv = msqPayInvoice();
    if (!inv) return;

    return shopSubaccounts[inv.shop_id.toString()];
  };

  const [msqPayInvoiceMemo] = createResource(msqPayInvoice, (inv) => calcInvoiceMemo(inv.id as Uint8Array));

  const mode = (): TPaymentPageMode | undefined => {
    if (urlMsqPaymentRequest()) return "msq-pay-url";
    if (urlIcrc1PaymentRequest()) return "icrc-1-url";
    if (icrc35MsqPaymentRequest()) return "msq-pay-icrc-35";
    if (icrc35Icrc1PaymentRequest()) return "icrc-1-icrc-35";

    return undefined;
  };

  // for ICRC-1 flows, sets the assetId signal to what is set by the request
  createEffect(
    on(icrc1TransferReq, (req) => {
      if (!req) return;

      // TODO: handle this error
      setAssetId(Principal.fromText(req.canisterId));
    })
  );

  // for MSQ pay flows, fetches the invoice as soon as possible
  createEffect(
    on(msqPayReq, async (req) => {
      if (req) {
        await fetchInvoice(req.invoiceId);

        const inv = msqPayInvoice();
        if (!inv) {
          navigate(ROOT["/"].error["/"]["invoice-not-found"].path);
          return;
        }
      }
    })
  );

  // for MSQ pay flows, fetches the shop info as soon as possible
  createEffect(
    on(msqPayInvoice, (invoice) => {
      if (invoice) {
        fetchShopById(invoice.shop_id);
      }
    })
  );

  createEffect(
    on(assetId, async (a) => {
      if (!a) return;

      await initWallet([a.toText()]);
    })
  );

  const getToPrincipal = () => {
    const icrc1 = icrc1TransferReq();
    if (icrc1) return Principal.fromText(icrc1.to.owner);

    const invoice = msqPayInvoice();
    if (!invoice) return undefined;

    return MSQ_PAY_PRINCIPAL;
  };

  const getToSubaccount = () => {
    const icrc1 = icrc1TransferReq();
    if (icrc1) return icrc1.to.subaccount;

    return msqPayShopSubaccount();
  };

  const getMemo = () => {
    const icrc1 = icrc1TransferReq();
    if (icrc1) return icrc1.memo;

    return msqPayInvoiceMemo();
  };

  const getAmountToTransfer = () => {
    const qty = amount();
    if (!qty) return undefined;

    const m = meta();
    if (!m) return undefined;

    return qty.add(EDs.new(m.fee, m.decimals));
  };

  const getCreatedAt = () => {
    const icrc1 = icrc1TransferReq();
    if (icrc1) return icrc1.createdAt;

    return nowNs();
  };

  // returns true if at least some flow (MSQ Pay or ICRC1) is present
  const isValidRequest = () => {
    const icrc1 = icrc1TransferReq();
    if (icrc1 && icrc1.canisterId && icrc1.to && icrc1.amount) return true;

    const pay = msqPayReq();
    if (pay && pay.invoiceId) return true;

    return false;
  };

  // if the request is invalid - show error page
  createEffect(
    on(isValidRequest, (is) => {
      if (!is) {
        navigate(ROOT["/"].error["/"]["bad-payment-request"].path);
      }
    })
  );

  // return an origin of the website who had initiated the payment request
  const getInitiatorOrigin = () => {
    switch (mode()) {
      case "icrc-1-icrc-35":
        return icrc35Icrc1PaymentRequest()!.peerOrigin;
      case "msq-pay-icrc-35":
        return icrc35MsqPaymentRequest()!.peerOrigin;
      case "icrc-1-url":
      case "msq-pay-url":
        return window.document.referrer ? new URL(window.document.referrer).origin : window.location.origin;
      default:
        return window.location.origin;
    }
  };

  // return metadata of the chosen assetId
  const meta = () => {
    const a = assetId();
    if (!a) return;

    return assetMetadata[a.toText()]?.metadata;
  };

  // sets the amount for ICRC-1 flow
  createEffect(
    on(meta, (m) => {
      if (!m) return;

      const icrc1 = icrc1TransferReq();
      if (!icrc1) return;

      setAmount(EDs.new(icrc1.amount, m.decimals));
    })
  );

  // returns exchange rate for MSQ Pay flow
  const exchangeRate = () => {
    const m = meta();
    if (!m) return undefined;

    return msqUsdExchangeRates[m.symbol];
  };

  // when asset id is changed at MSQ Pay flow, calculate the amount
  createEffect(() => {
    const a = assetId();
    if (!a) return;

    const inv = msqPayInvoice();

    console.log("invoice", inv);

    if (!inv) return;

    const rate = exchangeRate();

    console.log("rate", rate);

    if (!rate) return;

    const m = meta();

    console.log("meta", m);

    if (!m) return;

    const qty = inv.qty_usd.toDynamic().toDecimals(m.decimals).div(rate.toDynamic().toDecimals(m.decimals));

    setAmount(qty);
  });

  const handleReceive = (accountId: TAccountId) => {
    const a = assetId()!.toText();

    setReceivePopupProps({
      assetId: a,
      principal: assets[a]!.accounts[accountId].principal!,
      symbol: assetMetadata[a]!.metadata!.symbol,
      onClose: handleReceiveClose,
    });
  };

  const handleReceiveClose = () => {
    setReceivePopupProps(null);
  };

  const handleCheckoutStart = (accountId: TAccountId) => {
    const a = assetId()!.toText();
    setWalletAccount(a, accountId);

    const asset = assets[a]!;
    const { metadata } = assetMetadata[a]!;

    const p: IPaymentCheckoutPageProps = {
      mode: mode()!,

      accountId,
      accountName: asset.accounts[accountId].name,
      accountBalance: asset.accounts[accountId].balance!,
      accountPrincipal: asset.accounts[accountId].principal,

      assetId: a,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      fee: metadata.fee,

      peerOrigin: getInitiatorOrigin(),

      amount: amount()!.val,
      recepientPrincipal: getToPrincipal()!.toText(),
      recepientSubaccount: getToSubaccount(),
      memo: getMemo(),
      createdAt: getCreatedAt(),
    };

    navigate(ROOT["/"].integration["/"].pay["/"].checkout.path, { state: p });
  };

  const handleBack = () => {
    switch (pageState()) {
      case "wallet-select":
        window.close();
        break;
      case "asset-select":
        batch(() => {
          setPageState("wallet-select");
          setAssetId(undefined);
          setAmount(undefined);
        });
        break;
      case "account-select":
        setPageState("asset-select");
        break;
    }
  };

  const handleConnectWallet = async (_kind: TThirdPartyWalletKind) => {
    const a = assetId();
    if (!a) {
      setPageState("asset-select");
      return;
    }

    setPageState("account-select");
  };

  const handleAssetSelect = async (id: Principal) => {
    setAssetId(id);
    setPageState("account-select");
  };

  return (
    <Show when={isValidRequest()}>
      <PaymentPageContainer>
        <div class="w-full max-w-[880px] flex flex-col gap-10">
          <div class="flex flex-col gap-4">
            <Text size={20} weight={600}>
              Pending payment request{" "}
              <Show when={getInitiatorOrigin()}>
                initiated by <span class={ColorAccent}>{originToHostname(getInitiatorOrigin()!)}</span>
              </Show>
            </Text>

            <Show when={!msqPayInvoice() && meta() && amount()}>
              <H3>
                {amount()!.toString()} {meta()!.symbol}
              </H3>
            </Show>
            <Show when={msqPayInvoice()}>
              <H3>${msqPayInvoice()!.qty_usd.toString()}</H3>
            </Show>
          </div>

          <Show when={msqPayShop()}>
            <Shop
              id={msqPayShop()!.id}
              name={msqPayShop()!.name}
              description={msqPayShop()!.description}
              iconSrc={msqPayShop()!.icon_base64}
            />
          </Show>

          <Switch>
            <Match when={pageState() === "wallet-select"}>
              <WalletSelector onConnect={handleConnectWallet} onDismiss={handleBack} />
            </Match>
            <Match when={pageState() === "asset-select"}>
              <SupportedTokenSelector onSelect={handleAssetSelect} onDismiss={handleBack} />
            </Match>
            <Match when={pageState() === "account-select"}>
              <PaymentAccountSelector
                assetId={assetId()!}
                amountPlusFee={getAmountToTransfer()}
                onDismissClick={handleBack}
                onReceiveClick={handleReceive}
                onContinueClick={handleCheckoutStart}
              />
            </Match>
          </Switch>
        </div>
        <Show when={receivePopupProps()}>
          <ReceivePopup {...receivePopupProps()!} />
        </Show>
      </PaymentPageContainer>
    </Show>
  );
}
