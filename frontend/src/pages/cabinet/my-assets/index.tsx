import { For, Show, createEffect, createSignal, on, onMount } from "solid-js";
import {
  AddAssetForm,
  AddAssetFormWrapper,
  AddAssetInput,
  AddAssetWrapper,
  AssetAccountsWrapper,
  AssetLogo,
  AssetSpoilerContent,
  AssetSpoilerHeader,
  ErrorText,
  MyAssetsPageContent,
  MyAssetsPageHeader,
  MyAssetsShowEmptyToggle,
  NameAndLogo,
} from "./style";
import { Spoiler } from "../../../components/spoiler";
import { AccountCard } from "../../../components/account-card";
import {
  createLocalStorageSignal,
  IAssetMetadata,
  eventHandler,
  getAssetMetadata,
  makeAnonymousAgent,
} from "../../../utils";
import { Principal, TAccountId, debugStringify, logError, tokensToStr } from "@fort-major/msq-shared";
import { useMsqClient } from "../../../store/global";
import { IcrcLedgerCanister } from "@dfinity/ledger-icrc";
import { useNavigate } from "@solidjs/router";
import { ISendPageProps } from "./send";
import { ColorGray115, ColorGray130, H2, H4, H5, Text } from "../../../ui-kit/typography";
import { Button, EButtonKind } from "../../../ui-kit/button";
import { IReceivePopupProps, ReceivePopup } from "./receive";
import { AddAccountBtn } from "../../../components/add-account-btn";
import { useAssetData } from "../../../store/assets";
import { COLOR_ERROR_RED, COLOR_WHITE, CabinetContent, CabinetPage, FONT_WEIGHT_SEMI_BOLD } from "../../../ui-kit";
import { CabinetNav } from "../../../components/cabinet-nav";
import { Toggle } from "../../../components/toggle";
import { ErrorPin } from "../../../ui-kit/error-pin";
import { ROOT } from "../../../routes";

export function MyAssetsPage() {
  const msqClient = useMsqClient();
  const { assets, assetMetadata, init, refreshBalances, addAccount, editAccount, addAsset, removeAssetLogo } =
    useAssetData();

  const [newAssetId, setNewAssetId] = createSignal<string>("");
  const [newAssetMetadata, setNewAssetMetadata] = createSignal<IAssetMetadata | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const [loading, setLoading] = createSignal(false);
  const [addingAccount, setAddingAccount] = createSignal(false);

  const [receivePopupProps, setReceivePopupProps] = createSignal<IReceivePopupProps | null>(null);

  const navigate = useNavigate();

  onMount(() => {
    if (msqClient()) init();
  });

  createEffect(
    on(msqClient, (msq) => {
      if (msq) init();
    })
  );

  const handleNewAssetIdInput = eventHandler(async (e: Event & { target: HTMLInputElement }) => {
    setNewAssetId(e.target.value.trim());
    setError(null);

    try {
      const principal = Principal.fromText(newAssetId());

      const existing = assets[newAssetId()];
      if (existing) {
        setError(`Token ${assetMetadata[newAssetId()]!.metadata.symbol} (${newAssetId()}) already exists`);
        return;
      }

      const agent = await makeAnonymousAgent();
      const ledger = IcrcLedgerCanister.create({ agent, canisterId: principal });

      const metadata = await getAssetMetadata(ledger, false);

      setNewAssetMetadata(metadata);
    } catch (e) {
      setError(`Invalid canister ID - ${debugStringify(e)}`);
    }
  });

  const handleEdit = async (assetId: string, accountId: TAccountId, newName: string) => {
    setLoading(true);
    document.body.style.cursor = "wait";
    await editAccount!(assetId, accountId, newName);
    document.body.style.cursor = "unset";
    setLoading(false);
  };

  const handleAddAccount = async (assetId: string, assetName: string, symbol: string) => {
    setLoading(true);
    setAddingAccount(true);
    document.body.style.cursor = "wait";

    await addAccount!(assetId, assetName, symbol);

    document.body.style.cursor = "unset";
    setLoading(false);
    setAddingAccount(false);
  };

  const handleAddAsset = async () => {
    const assetId = newAssetId();

    setLoading(true);
    document.body.style.cursor = "wait";

    try {
      addAsset!(assetId);
    } catch (e) {
      logError(e);
      setError(`Token ${assetId} is not a valid ICRC-1 token or unresponsive`);
    } finally {
      document.body.style.cursor = "unset";
      setLoading(false);
    }
  };

  const handleSend = (accountId: TAccountId, assetId: string) => {
    const assetData = assets[assetId]!;
    const { metadata } = assetMetadata[assetId]!;
    const account = assetData.accounts[accountId];

    const sendProps: ISendPageProps = {
      accountId,
      assetId,
      balance: account.balance!,
      name: account.name,
      principal: account.principal!,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      fee: metadata.fee,

      onComplete: (result: boolean) => handleCancelSend(result, assetId),
      onCancel: () => handleCancelSend(false, assetId),
    };

    navigate(ROOT["/"].cabinet["/"]["my-assets"]["/"].send.path, { state: sendProps });
  };

  const handleCancelSend = async (result: boolean, assetId: string) => {
    navigate(ROOT["/"].cabinet["/"]["my-assets"].path);

    if (result) {
      setLoading(true);
      document.body.style.cursor = "wait";

      await refreshBalances!([assetId]);

      document.body.style.cursor = "unset";
      setLoading(false);
    }
  };

  const handleReceive = (assetId: string, symbol: string, principalId: string) => {
    setReceivePopupProps({
      assetId,
      principal: principalId,
      symbol,
      onClose: handleReceiveClose,
    });
  };

  const handleReceiveClose = () => {
    setReceivePopupProps(null);
  };

  const [hideEmpty, setHideEmpty] = createLocalStorageSignal<boolean>("msq-assets-hide-empty");

  const getAssetKeys = () =>
    Object.keys(assets).filter((key) => (hideEmpty() ? (assets[key]?.totalBalance ?? 0) > 0 : true));

  return (
    <CabinetPage>
      <CabinetNav />
      <CabinetContent>
        <MyAssetsPageHeader>
          <H2>My Assets</H2>
          <MyAssetsShowEmptyToggle>
            <Toggle defaultValue={hideEmpty()} onToggle={setHideEmpty} />
            <Text size={16} weight={FONT_WEIGHT_SEMI_BOLD} letterSpacing={-1} color={COLOR_WHITE}>
              Hide Empty
            </Text>
          </MyAssetsShowEmptyToggle>
        </MyAssetsPageHeader>
        <MyAssetsPageContent>
          <For
            each={getAssetKeys()}
            fallback={
              <H5>
                <span class={ColorGray115}>No assets yet</span>
              </H5>
            }
          >
            {(assetId, idx) => (
              <Spoiler
                last={idx() === getAssetKeys().length - 1}
                defaultOpen={
                  !!assets[assetId] &&
                  (assets[assetId]!.totalBalance > 0n || assets[assetId]!.accounts[0].name === "Creating...")
                }
                header={
                  <AssetSpoilerHeader>
                    <Show
                      when={assetMetadata[assetId]?.metadata}
                      fallback={
                        <Text size={20} weight={600}>
                          {assetId}
                          <Show when={assets[assetId]?.erroed}>
                            <ErrorPin />
                          </Show>
                        </Text>
                      }
                    >
                      <NameAndLogo>
                        <Show when={assetMetadata[assetId]!.metadata!.logoSrc}>
                          <AssetLogo
                            onError={() => removeAssetLogo(assetId)}
                            src={assetMetadata[assetId]!.metadata!.logoSrc}
                            alt="logo"
                          />
                        </Show>
                        <Text size={20} weight={600}>
                          {assetMetadata[assetId]!.metadata!.name}
                          <Show when={assets[assetId]?.erroed}>
                            <ErrorPin />
                          </Show>
                        </Text>
                      </NameAndLogo>
                    </Show>
                    <Show
                      when={assetMetadata[assetId]?.metadata}
                      fallback={
                        <Text size={20} weight={600}>
                          0 <span class={ColorGray130}>TOK</span>
                        </Text>
                      }
                    >
                      <Text size={20} weight={600}>
                        {tokensToStr(
                          assets[assetId]!.totalBalance,
                          assetMetadata[assetId]!.metadata!.decimals,
                          undefined,
                          true
                        )}{" "}
                        <span class={ColorGray130}>{assetMetadata[assetId]!.metadata!.symbol}</span>
                      </Text>
                    </Show>
                  </AssetSpoilerHeader>
                }
              >
                <Show when={assetMetadata[assetId]?.metadata}>
                  <AssetSpoilerContent>
                    <AssetAccountsWrapper>
                      <For each={assets[assetId]!.accounts}>
                        {(account, idx) => (
                          <AccountCard
                            accountId={idx()}
                            assetId={assetId}
                            name={account.name}
                            principal={account.principal}
                            balance={account.balance}
                            symbol={assetMetadata[assetId]!.metadata!.symbol}
                            decimals={assetMetadata[assetId]!.metadata!.decimals}
                            onSend={handleSend}
                            onReceive={handleReceive}
                            onEdit={(newName) => handleEdit(assetId, idx(), newName)}
                            showAccountHistory
                          />
                        )}
                      </For>
                    </AssetAccountsWrapper>
                    <AddAccountBtn
                      disabled={addingAccount()}
                      loading={addingAccount()}
                      onClick={() =>
                        handleAddAccount(
                          assetId,
                          assetMetadata[assetId]!.metadata!.name,
                          assetMetadata[assetId]!.metadata!.symbol
                        )
                      }
                      symbol={assetMetadata[assetId]!.metadata!.symbol}
                    />
                  </AssetSpoilerContent>
                </Show>
              </Spoiler>
            )}
          </For>
          <AddAssetWrapper>
            <H4>Add custom ICRC-1 asset</H4>
            <AddAssetFormWrapper>
              <AddAssetForm>
                <AddAssetInput
                  classList={{ error: error() !== null }}
                  disabled={loading()}
                  placeholder="Type token’s canister ID here..."
                  value={newAssetId()}
                  onInput={handleNewAssetIdInput}
                />
                <Button
                  label="add token"
                  disabled={loading() || newAssetId() === "" || error() !== null || newAssetMetadata() === null}
                  kind={EButtonKind.Primary}
                  onClick={handleAddAsset}
                  text={`Add ${
                    newAssetMetadata() ? `${newAssetMetadata()!.name} (${newAssetMetadata()!.symbol})` : "token"
                  }`}
                />
              </AddAssetForm>
              <Show when={error()}>
                <Text size={12} weight={500} color={COLOR_ERROR_RED} class={ErrorText}>
                  {error()}
                </Text>
              </Show>
            </AddAssetFormWrapper>
          </AddAssetWrapper>
        </MyAssetsPageContent>
        <Show when={receivePopupProps()}>
          <ReceivePopup {...receivePopupProps()!} />
        </Show>
      </CabinetContent>
    </CabinetPage>
  );
}
