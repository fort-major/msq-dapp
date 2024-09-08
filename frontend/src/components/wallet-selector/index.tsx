import { For, Match, Switch } from "solid-js";
import { TThirdPartyWalletKind, useThirdPartyWallet } from "../../store/wallets";
import { eventHandler } from "../../utils";
import { Plate } from "../plate";
import { Img } from "../markup";
import { Text } from "../../ui-kit/typography";
import { COLOR_GRAY_140, COLOR_WHITE } from "../../ui-kit";
import { Button, EButtonKind } from "../../ui-kit/button";

export interface IWalletSelectorProps {
  onConnect: (kind: TThirdPartyWalletKind) => void;
  onDismiss: () => void;
}

export const WalletSelector = (props: IWalletSelectorProps) => {
  const { connectWallet } = useThirdPartyWallet();

  const handleConnectWallet = async (kind: TThirdPartyWalletKind) => {
    await connectWallet(kind);
    props.onConnect(kind);
  };

  const supportedWallets: ["MSQ", "Plug", "NNS"] = ["MSQ", "Plug", "NNS"];

  return (
    <div class="flex flex-col gap-10">
      <div class="flex flex-col gap-6">
        <Text size={20} weight={600}>
          Select a wallet to pay with:
        </Text>

        <div class="flex flex-col gap-5 items-stretch">
          <For each={supportedWallets}>
            {(walletName) => (
              <Plate pointer bgHover onClick={eventHandler(() => handleConnectWallet(walletName))}>
                <div class="flex gap-4 items-center">
                  <Img src={`/${walletName.toLowerCase()}-wallet.png`} w="50px" h="50px" rounded />
                  <div class="flex flex-col gap-4">
                    <Text size={16} weight={600} color={COLOR_WHITE}>
                      {walletName}
                    </Text>
                    <Text size={12} weight={500} color={COLOR_GRAY_140}>
                      <Switch>
                        <Match when={walletName === "MSQ"}>Phishing-proof MetaMask ICP Wallet</Match>
                        <Match when={walletName === "NNS"}>Use Internet Identity to pay via the NNS dapp</Match>
                        <Match when={walletName === "Plug"}>IC Wallet by Funded</Match>
                      </Switch>
                    </Text>
                  </div>
                </div>
              </Plate>
            )}
          </For>
        </div>
      </div>

      <Button kind={EButtonKind.Additional} text="Dismiss" label="dismiss" onClick={props.onDismiss} />
    </div>
  );
};
