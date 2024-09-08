import { Principal, TAccountId, tokensToStr } from "@fort-major/msq-shared";
import {
  DEFAULT_PRINCIPAL,
  canCreateTransactionHistoryLink,
  createTransactionHistoryLink,
  eventHandler,
} from "../../utils";
import {
  AccountCardCheckIconWrapper,
  AccountCardDivider,
  AccountCardFooter,
  AccountCardFooterBalance,
  AccountCardFooterBalanceWrapper,
  AccountCardFooterButtons,
  AccountCardFooterContent,
  AccountCardFooterInsufficientBalance,
  AccountCardHeader,
  AccountCardHeaderNameWrapper,
  AccountCardHeaderPrincipal,
  AccountCardHeaderWrapper,
  AccountCardInput,
  AccountCardWrapper,
  DotsIcon,
} from "./style";
import { Match, Show, Switch, createMemo, createSignal } from "solid-js";
import { Input } from "../../ui-kit/input";
import { Button, EButtonKind } from "../../ui-kit/button";
import { EIconKind, Icon } from "../../ui-kit/icon";
import { ColorGray150, H5, StrikedText, Text } from "../../ui-kit/typography";
import { COLOR_ACCENT, COLOR_GRAY_125, COLOR_GRAY_140 } from "../../ui-kit";
import { TThirdPartyWalletKind } from "../../store/wallets";
import { Block, Img } from "../markup";
import { useAssetData } from "../../store/assets";
import { EDs } from "../../utils/e8s";

export interface IAccountCardProps {
  accountId: TAccountId;
  assetId: string;
  name: string;
  principal: string | undefined;
  balance: bigint | undefined;
  decimals: number;
  symbol: string;
  fullWidth?: boolean | undefined;
  targetBalance?: bigint | undefined;
  classList?: { [k: string]: boolean | undefined };

  transferSuccess?: bigint | undefined;

  onClick?: (accountId: TAccountId, assetId: string) => void;

  onSend?: (accountId: TAccountId, assetId: string) => void;
  onReceive?: (assetId: string, symbol: string, principal: string) => void;
  onEdit?: (newName: string) => void;
  showAccountHistory?: boolean;
  showWalletKindLogo?: TThirdPartyWalletKind;
}

export function AccountCard(props: IAccountCardProps) {
  const { sonicUsdExchangeRates } = useAssetData();

  const [edited, setEdited] = createSignal(false);

  const usdBalance = createMemo(() => {
    const rate = sonicUsdExchangeRates[props.symbol];
    if (!rate) return undefined;

    const b = props.balance;
    if (!b) return undefined;

    const bEds = EDs.new(b, props.decimals);

    return bEds.toDecimals(8).toE8s().mul(rate);
  });

  const handleEditStart = eventHandler((e: Event) => {
    if (props.onEdit === undefined) return;

    if (!edited()) {
      setEdited(true);
      return;
    }
  });

  const handleClick = eventHandler(() => {
    props.onClick?.(props.accountId, props.assetId);
  });

  const handleChange = (newName: string) => {
    setEdited(false);

    props.onEdit?.(newName);
  };

  const handleSend = () => {
    props.onSend!(props.accountId, props.assetId);
  };

  const handleReceive = () => {
    props.onReceive!(props.assetId, props.symbol, props.principal!);
  };

  return (
    <AccountCardWrapper classList={props.classList} onClick={handleClick} fullWidth={props.fullWidth}>
      <AccountCardHeaderWrapper>
        <Show when={props.showWalletKindLogo}>
          <Img src={`/${props.showWalletKindLogo!.toLowerCase()}-wallet.png`} w="40px" h="40px" rounded />
        </Show>
        <AccountCardHeader>
          <Switch>
            <Match when={edited()}>
              <Input
                label="Account Name"
                required
                autofocus
                classList={{ [AccountCardInput]: true }}
                KindString={{
                  defaultValue: props.name,
                  onChange: handleChange,
                  validate: (name) => (name.length === 0 ? "Please type something..." : null),
                }}
              />
            </Match>
            <Match when={!edited()}>
              <AccountCardHeaderNameWrapper classList={{ editable: !!props.onEdit }} onClick={handleEditStart}>
                <Text size={16} weight={600}>
                  {props.name}
                </Text>
                <Show when={props.onEdit}>
                  <Icon kind={EIconKind.Edit} size={12} />
                </Show>
              </AccountCardHeaderNameWrapper>
            </Match>
          </Switch>
          <Show
            when={props.principal}
            fallback={
              <Text size={12} class={AccountCardHeaderPrincipal}>
                {DEFAULT_PRINCIPAL}
              </Text>
            }
          >
            <Text size={12} color={COLOR_GRAY_140} class={AccountCardHeaderPrincipal}>
              {props.principal}
            </Text>
          </Show>
        </AccountCardHeader>

        <Show when={props.showAccountHistory && canCreateTransactionHistoryLink(props.assetId, props.principal)}>
          <a
            href={
              createTransactionHistoryLink(Principal.fromText(props.assetId), Principal.fromText(props.principal!))!
            }
            target="_blank"
          >
            <Icon kind={EIconKind.Dots} classList={{ [DotsIcon]: true }} />
          </a>
        </Show>
      </AccountCardHeaderWrapper>
      <AccountCardFooter>
        <AccountCardDivider />
        <AccountCardFooterContent>
          <AccountCardFooterBalanceWrapper>
            <AccountCardFooterBalance>
              <Switch>
                <Match when={props.transferSuccess}>
                  <H5>
                    <span style={{ display: "flex", gap: "15px", "align-items": "center" }}>
                      <span classList={{ [StrikedText]: true, [ColorGray150]: true }}>
                        {tokensToStr(props.balance || 0n, props.decimals, undefined, true)}
                      </span>

                      <Icon kind={EIconKind.ArrowRightWide} color={COLOR_ACCENT} />

                      <span>
                        {tokensToStr(props.balance! - props.transferSuccess!, props.decimals, undefined, true)}
                      </span>
                    </span>
                  </H5>
                </Match>
                <Match when={!props.transferSuccess && !usdBalance()}>
                  <H5>{tokensToStr(props.balance || 0n, props.decimals, undefined, true)}</H5>
                  <Text size={12} weight={600}>
                    {props.symbol}
                  </Text>
                </Match>
                <Match when={!props.transferSuccess && usdBalance()}>
                  <div class="flex flex-col gap-1">
                    <Text size={16} weight={500} color={COLOR_GRAY_125}>
                      {tokensToStr(props.balance || 0n, props.decimals, undefined, true)} {props.symbol}
                    </Text>
                    <H5>${usdBalance()!.toDynamic().toDecimals(4).toString()}</H5>
                  </div>
                </Match>
              </Switch>
            </AccountCardFooterBalance>
            <Show when={props.targetBalance && (props.balance || 0n) < props.targetBalance}>
              <AccountCardFooterInsufficientBalance>
                <Icon kind={EIconKind.Warning} />
                <Text size={14} weight={600}>
                  Insufficient Funds
                </Text>
              </AccountCardFooterInsufficientBalance>
            </Show>
          </AccountCardFooterBalanceWrapper>
          <AccountCardFooterButtons>
            <Show when={props.onSend}>
              <Button
                label="send"
                kind={EButtonKind.Primary}
                icon={EIconKind.ArrowRightUp}
                iconOnlySize={40}
                disabled={props.balance === undefined}
                onClick={handleSend}
              />
            </Show>
            <Show when={props.onReceive}>
              <Button
                label="receive"
                kind={EButtonKind.Secondary}
                icon={EIconKind.ArrowLeftDown}
                iconOnlySize={40}
                disabled={props.principal === undefined}
                onClick={handleReceive}
              />
            </Show>
          </AccountCardFooterButtons>
        </AccountCardFooterContent>
      </AccountCardFooter>
    </AccountCardWrapper>
  );
}
