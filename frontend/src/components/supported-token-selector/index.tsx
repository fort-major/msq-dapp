import { Principal } from "@dfinity/principal";
import { useMsqPay } from "../../store/msq-pay";
import { createMemo, For } from "solid-js";
import { Img } from "../markup";
import { Text } from "../../ui-kit/typography";
import { COLOR_WHITE } from "../../ui-kit";
import { eventHandler } from "../../utils";
import { Button, EButtonKind } from "../../ui-kit/button";
import { Plate } from "../plate";

export interface ISupportedTokenSelectorProps {
  onSelect: (assetId: Principal) => void;
  onDismiss: () => void;
}

export const SupportedTokenSelector = (props: ISupportedTokenSelectorProps) => {
  const { supportedTokens } = useMsqPay();

  const tokenIds = createMemo(() => Object.keys(supportedTokens));

  return (
    <div class="flex flex-col gap-10">
      <Text size={20} weight={600}>
        Select a cryptocurrency to pay with:
      </Text>

      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-5">
          <For each={tokenIds()}>
            {(tokenId) => (
              <Plate bgHover pointer onClick={eventHandler(() => props.onSelect(supportedTokens[tokenId]!.id))}>
                <div class="flex gap-6 items-center">
                  <Img src={supportedTokens[tokenId]!.logo_src} w="24px" h="24px" rounded />
                  <div class="flex flex-col gap-1">
                    <Text size={16} weight={600} color={COLOR_WHITE}>
                      {supportedTokens[tokenId]!.ticker}
                    </Text>
                  </div>
                </div>
              </Plate>
            )}
          </For>
        </div>

        <Button label="dismiss" kind={EButtonKind.Additional} onClick={props.onDismiss} text="Back to Wallets" />
      </div>
    </div>
  );
};
