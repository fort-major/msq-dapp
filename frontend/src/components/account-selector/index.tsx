import { createEffect, createMemo, createSignal, For, Match, on, Show, Switch } from "solid-js";
import { Text } from "../../ui-kit/typography";
import { useThirdPartyWallet } from "../../store/wallets";
import { Principal } from "@dfinity/principal";
import { useAssetData } from "../../store/assets";
import { AccountCard } from "../account-card";
import { AccountCardBase, AccountCardSelected } from "../../pages/integration/payment/style";
import { TAccountId, tokensToStr } from "@fort-major/msq-shared";
import { E8s, EDs } from "../../utils/e8s";
import { Warning } from "../../ui-kit/warning";
import { COLOR_GRAY_190, COLOR_ORANGE } from "../../ui-kit";
import { Copyable } from "../../ui-kit/copyable";
import { AddAccountBtn } from "../add-account-btn";
import { Button, EButtonKind } from "../../ui-kit/button";
import { EIconKind } from "../../ui-kit/icon";

export interface IPaymentAccountSelector {
  assetId: Principal;
  amountPlusFee?: EDs;

  onDismissClick: () => void;
  onContinueClick: (accountId: TAccountId) => void;
  onReceiveClick: (accountId: TAccountId) => void;
}

export const PaymentAccountSelector = (props: IPaymentAccountSelector) => {
  const { connectedWallet, connectedWalletIsThirdParty } = useThirdPartyWallet();
  const { assets, assetMetadata } = useAssetData();

  const [selectedAccountId, setSelectedAccountId] = createSignal<TAccountId>(0);

  const accounts = createMemo(() => assets[props.assetId.toText()]?.accounts);
  const meta = createMemo(() => assetMetadata[props.assetId.toText()]?.metadata);
  const balance = (accountId: TAccountId) =>
    meta() ? EDs.new(accounts()?.[accountId].balance ?? 0n, meta()!.decimals) : EDs.zero(8);
  const canContinue = () => (props.amountPlusFee ? balance(selectedAccountId()).ge(props.amountPlusFee) : false);
  const principal = (accountId: TAccountId) => accounts()?.[accountId].principal;

  createEffect(() => {
    console.log("AMOUNT PLUS FEE", props.amountPlusFee);
  });

  return (
    <div class="flex flex-col gap-6">
      <Text size={20} weight={600}>
        <Switch>
          <Match when={connectedWallet()![0] === "MSQ"}>Select an account to continue:</Match>
          <Match when={connectedWallet()![0] === "NNS"}>
            Refill with{" "}
            <a href="https://nns.ic0.app" class="underline text-chartreuse">
              NNS Dapp
            </a>{" "}
            (or other) to continue:
          </Match>
        </Switch>
      </Text>
      <Show when={props.amountPlusFee}>
        <div class="flex flex-col gap-5">
          <div
            class="grid gap-5"
            classList={{ "grid-cols-1": connectedWalletIsThirdParty(), "grid-cols-2": !connectedWalletIsThirdParty() }}
          >
            <For each={accounts()}>
              {(account, idx) => (
                <AccountCard
                  fullWidth
                  showWalletKindLogo={connectedWallet()![0]}
                  classList={{ [AccountCardBase]: true, [AccountCardSelected]: idx() === selectedAccountId() }}
                  onClick={(accountId) => setSelectedAccountId(accountId)}
                  accountId={idx()}
                  assetId={props.assetId.toText()}
                  name={account.name}
                  balance={account.balance}
                  principal={account.principal}
                  decimals={meta()!.decimals}
                  symbol={meta()!.symbol}
                  targetBalance={props.amountPlusFee!.val}
                />
              )}
            </For>
          </div>
          <Show when={connectedWallet()![0] === "NNS"}>
            <div class="flex flex-col items-stretch gap-4">
              <Warning iconBgColor={COLOR_GRAY_190}>
                <div class="flex gap-1 items-center">
                  <Text weight={500} size={16}>
                    Mare sure to transfer exactly
                  </Text>
                  <Copyable text={props.amountPlusFee!.toString()} after={meta()!.symbol} />
                  <Text weight={500} size={16}>
                    , otherwise you won't be able to complete the payment.
                  </Text>
                </div>
              </Warning>
              <Warning iconBgColor={COLOR_ORANGE}>
                <div class="flex gap-1 items-center">
                  <Text weight={500} size={16}>
                    Make sure your wallet supports ICRC-1 transfers, otherwise your funds may be lost.
                  </Text>
                </div>
              </Warning>
            </div>
          </Show>
        </div>
      </Show>

      <div class="flex gap-2">
        <Button label="dismiss" kind={EButtonKind.Additional} onClick={props.onDismissClick} text="Dismiss" fullWidth />
        <Switch>
          <Match when={canContinue()}>
            <Button
              label="go to checkout"
              kind={EButtonKind.Primary}
              text="Go to Checkout"
              icon={EIconKind.ArrowRightUp}
              fullWidth
              onClick={() => props.onContinueClick(selectedAccountId())}
            />
          </Match>
          <Match when={!canContinue()}>
            <Button
              label="top up the balance"
              kind={EButtonKind.Secondary}
              text="Top up the Balance"
              icon={EIconKind.ArrowLeftDown}
              onClick={() => props.onReceiveClick(selectedAccountId())}
              disabled={!principal(selectedAccountId())}
              fullWidth
            />
          </Match>
        </Switch>
      </div>
    </div>
  );
};
