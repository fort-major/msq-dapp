use std::{
    cell::RefCell,
    collections::{hash_map::Entry, BTreeMap, BTreeSet, HashMap},
};

use candid::{CandidType, Nat, Principal};
use ic_cdk::{
    api::{management_canister::main::raw_rand, time},
    caller, id, query, update,
};
use serde::Deserialize;

use crate::{
    exchange_rates::{get_current_exchange_rate_timestamp, ExchangeRatesState, EXCHANGE_RATES},
    shops::SHOPS_STATE,
    tokens::{TokenId, SUPPORTED_TOKENS},
    utils::{
        calc_shop_subaccount, icrc3_block_to_transfer_txn, ICRC1CanisterClient, InvoiceId, ShopId,
        Timestamp, TransferTxn, DEFAULT_TTL, ID_GENERATION_DOMAIN, MEMO_GENERATION_DOMAIN,
        RECYCLING_TTL, USD,
    },
};

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum InvoiceStatus {
    Created {
        ttl: u8,
    },
    VerifyPayment,
    Paid {
        timestamp: Timestamp,
        token_id: TokenId,
        qty: Nat,
        exchange_rate: USD,
    },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Invoice {
    pub id: InvoiceId,
    pub status: InvoiceStatus,
    pub creator: Principal,
    pub qty_usd: Nat,
    pub created_at: Timestamp,
    pub exchange_rates_timestamp: Timestamp,
    pub shop_id: ShopId,
}

#[derive(Default, CandidType, Deserialize, Clone, Debug)]
pub struct InvoicesState {
    pub invoice_id_generator: InvoiceId,

    pub invoices: BTreeMap<InvoiceId, Invoice>,

    pub active_invoices: HashMap<Timestamp, BTreeSet<InvoiceId>>,
    pub inactive_invoices: BTreeSet<InvoiceId>,

    pub total_processed_in_usd: USD,
}

impl InvoicesState {
    #[inline]
    pub fn init_id_seed(&mut self, seed: &[u8]) {
        self.invoice_id_generator.copy_from_slice(seed);
    }

    pub fn create(
        &mut self,
        qty_usd: Nat,
        shop_id: ShopId,
        timestamp: Timestamp,
        exchange_rates_timestamp: Timestamp,
        caller: Principal,
    ) -> InvoiceId {
        let id = self.generate_id(&timestamp.to_le_bytes());

        let inv = Invoice {
            id,
            creator: caller,
            status: InvoiceStatus::Created { ttl: DEFAULT_TTL },
            qty_usd,
            exchange_rates_timestamp,
            created_at: timestamp,
            shop_id,
        };

        match self.active_invoices.entry(inv.exchange_rates_timestamp) {
            Entry::Occupied(mut e) => {
                e.get_mut().insert(id);
            }
            Entry::Vacant(e) => {
                let mut s = BTreeSet::new();
                s.insert(id);

                e.insert(s);
            }
        }

        self.invoices.insert(id, inv);

        id
    }

    pub fn purge_expired(&mut self, exchange_rates_state: &mut ExchangeRatesState) {
        let mut purged_invoices = HashMap::new();

        for (exchange_rates_timestamp, active_invoices) in self.active_invoices.iter() {
            let mut cur_purged_invoices = Vec::new();

            for id in active_invoices {
                let mut remove = false;

                {
                    let invoice = self.invoices.get_mut(id).unwrap();

                    if let InvoiceStatus::Created { ttl } = invoice.status {
                        if ttl > RECYCLING_TTL {
                            invoice.status = InvoiceStatus::Created { ttl: ttl - 1 };
                        } else {
                            remove = true;
                        }
                    } else {
                        unreachable!("Invoice should be in Created state");
                    }
                }

                if remove {
                    self.invoices.remove(id);
                    cur_purged_invoices.push(*id);
                }
            }

            purged_invoices.insert(*exchange_rates_timestamp, cur_purged_invoices);
        }

        for (exchange_rates_timestamp, invoices) in purged_invoices {
            let mut remove = false;

            {
                let active_invoices = self
                    .active_invoices
                    .get_mut(&exchange_rates_timestamp)
                    .unwrap();

                for id in invoices {
                    active_invoices.remove(&id);
                }

                if active_invoices.is_empty() {
                    remove = true;
                }
            }

            if remove {
                self.active_invoices.remove(&exchange_rates_timestamp);
                exchange_rates_state.delete_outdated(&exchange_rates_timestamp);
            }
        }
    }

    pub fn verify_payment(
        &mut self,
        invoice_id: &InvoiceId,
        transfer_txn: TransferTxn,
        exchange_rate: Nat,
        this_canister_id: Principal,
    ) -> Result<(Invoice, bool), String> {
        let invoice = self
            .invoices
            .get_mut(invoice_id)
            .ok_or("Invoice not found".to_string())?;

        if !matches!(invoice.status, InvoiceStatus::VerifyPayment) {
            return Err("Invalid invoice status".to_string());
        }

        // check if the transfer was sent to the correct recepient
        let expected_recepient_principal = this_canister_id;
        let actual_recepient_principal = transfer_txn.to.owner;

        if expected_recepient_principal != actual_recepient_principal {
            return Err(format!(
                "Invalid recepient - funds are lost: expected {}, actual {}",
                expected_recepient_principal, actual_recepient_principal
            ));
        }

        let expected_shop_subaccount = calc_shop_subaccount(invoice.shop_id);
        let actual_shop_subaccount = transfer_txn.to.subaccount.unwrap_or([0u8; 32]);

        if actual_shop_subaccount != expected_shop_subaccount {
            return Err(format!(
                "Invalid recepient subaccount: expected {:?}, actual {:?}",
                expected_shop_subaccount, actual_shop_subaccount
            ));
        }

        // is memo valid
        let expected_memo = Self::make_invoice_memo(invoice_id);
        let actual_memo = transfer_txn.memo;

        if expected_memo != actual_memo {
            return Err(format!(
                "Txn memo field doesn't match the invoice one: expected {:?}, actual {:?}",
                expected_memo, actual_memo
            ));
        }

        // check if the sum sent is enough to cover the invoice
        let expected_qty_usd = invoice.qty_usd.clone();
        let actual_qty_usd = exchange_rate.clone() * transfer_txn.qty.clone();

        if actual_qty_usd < invoice.qty_usd {
            return Err(format!(
                "Insufficient transfer: expected (usd e8s) {}, actual (usd e8s) {}",
                expected_qty_usd, actual_qty_usd
            ));
        }

        invoice.status = InvoiceStatus::Paid {
            timestamp: time(),
            token_id: transfer_txn.token_id,
            qty: transfer_txn.qty,
            exchange_rate,
        };

        // delete the invoice from the list of active invoices (which is segregated by exchange rate used)
        let active_invoices = self
            .active_invoices
            .get_mut(&invoice.exchange_rates_timestamp)
            .unwrap();

        active_invoices.remove(invoice_id);

        // move the invoice to paid list
        self.inactive_invoices.insert(*invoice_id);

        Ok((invoice.clone(), self.active_invoices.is_empty()))
    }

    pub fn prepare_archive_batch(&mut self, size: usize) -> Vec<Invoice> {
        let mut ids_to_archive = Vec::new();

        let mut i = 0;
        for id in self.inactive_invoices.iter() {
            if i == size {
                break;
            }

            ids_to_archive.push(*id);

            i += 1;
        }

        let mut batch = Vec::new();

        for id in ids_to_archive.iter() {
            self.inactive_invoices.remove(id);
            let invoice = self.invoices.remove(id).unwrap();

            batch.push(invoice);
        }

        batch
    }

    pub fn reapply_archive_batch(&mut self, batch: Vec<Invoice>) {
        for invoice in batch {
            self.inactive_invoices.insert(invoice.id);
            self.invoices.insert(invoice.id, invoice);
        }
    }

    fn generate_id(&mut self, salt: &[u8]) -> InvoiceId {
        blake3::Hasher::new()
            .update(&self.invoice_id_generator)
            .update(ID_GENERATION_DOMAIN)
            .update(salt)
            .finalize()
            .into()
    }

    fn make_invoice_memo(id: &InvoiceId) -> [u8; 32] {
        blake3::Hasher::new()
            .update(MEMO_GENERATION_DOMAIN)
            .update(id)
            .finalize()
            .into()
    }
}

// --------------------------- STATE ------------------------

thread_local! {
    pub static INVOICES_STATE: RefCell<InvoicesState> = RefCell::default();
}

#[inline]
pub fn garbage_collect_invoices() {
    INVOICES_STATE.with_borrow_mut(|s| {
        EXCHANGE_RATES.with(|rates| s.purge_expired(&mut rates.borrow_mut()));
    });
}

#[inline]
pub async fn init_invoice_ids_seed() {
    let (rand,) = raw_rand().await.unwrap();

    INVOICES_STATE.with_borrow_mut(|it| it.init_id_seed(&rand));
}

// ----------------------- API -------------------------

#[derive(CandidType, Deserialize)]
pub struct GetInvoiceRequest {
    pub invoice_id: InvoiceId,
}

#[derive(CandidType, Deserialize)]
pub struct GetInvoiceResponse {
    pub invoice_opt: Option<Invoice>,
}

#[query]
fn get_invoice(req: GetInvoiceRequest) -> GetInvoiceResponse {
    let invoice_opt = INVOICES_STATE.with_borrow(|it| it.invoices.get(&req.invoice_id).cloned());

    GetInvoiceResponse { invoice_opt }
}

#[derive(CandidType, Deserialize)]
pub struct CreateInvoiceRequest {
    pub shop_id: ShopId,
    pub qty_usd: USD,
}

#[derive(CandidType, Deserialize)]
pub struct CreateInvoiceResponse {
    pub invoice_id: InvoiceId,
}

#[update]
fn create_invoice(req: CreateInvoiceRequest) -> CreateInvoiceResponse {
    let can_create = SHOPS_STATE.with_borrow(|s| s.can_create_invoices(&req.shop_id, &caller()));
    if !can_create {
        panic!("Access denied");
    }

    let exchange_rates_timestamp = get_current_exchange_rate_timestamp();

    let invoice_id = INVOICES_STATE.with_borrow_mut(|it| {
        it.create(
            req.qty_usd,
            req.shop_id,
            time(),
            exchange_rates_timestamp,
            caller(),
        )
    });

    CreateInvoiceResponse { invoice_id }
}

#[derive(CandidType, Deserialize)]
pub struct VerifyPaymentRequest {
    pub invoice_id: InvoiceId,
    pub asset_id: Principal,
    pub block_idx: Nat,
}

pub type VerifyPaymentResponse = Result<Invoice, String>;

#[update]
async fn verify_payment(req: VerifyPaymentRequest) -> VerifyPaymentResponse {
    let (exchange_rates_timestamp, ttl) = INVOICES_STATE.with_borrow_mut(|s| {
        let invoice = s
            .invoices
            .get_mut(&req.invoice_id)
            .ok_or("Access denied".to_string())?;

        if invoice.creator != caller() {
            return Err("Access denied".to_string());
        }

        let ttl = match invoice.status {
            InvoiceStatus::Created { ttl } => ttl,
            _ => return Err("The invoice is already paid".to_string()),
        };

        invoice.status = InvoiceStatus::VerifyPayment;

        Ok((invoice.exchange_rates_timestamp, ttl))
    })?;

    let token = ICRC1CanisterClient::new(req.asset_id);
    let block = token.find_block(req.block_idx).await?;

    let txn = icrc3_block_to_transfer_txn(&block, req.asset_id)?;

    let ticker = SUPPORTED_TOKENS
        .with_borrow(|s| s.ticker_by_token_id(&txn.token_id))
        .ok_or("Unsuported token".to_string())?;

    let exchange_rate = EXCHANGE_RATES.with_borrow(|s| {
        s.get_exchange_rate(&exchange_rates_timestamp, &ticker)
            .clone()
    });

    let result = INVOICES_STATE
        .with_borrow_mut(|s| s.verify_payment(&req.invoice_id, txn, exchange_rate, id()));

    match result {
        // if failed, reset the invoice and return the error
        Err(err) => INVOICES_STATE.with_borrow_mut(|s| {
            let invoice = s.invoices.get_mut(&req.invoice_id).unwrap();
            invoice.status = InvoiceStatus::Created { ttl };

            Err(err)
        }),
        // if succeed, maybe delete outdated and return the invoice
        Ok((invoice, should_delete_outdated)) => {
            // if the active invoice list is empty now - delete the outdated exchange rates
            if should_delete_outdated {
                EXCHANGE_RATES
                    .with_borrow_mut(|s| s.delete_outdated(&invoice.exchange_rates_timestamp));
            }

            Ok(invoice)
        }
    }
}

pub async fn archive_inactive_invoices() {
    let batch = INVOICES_STATE.with_borrow_mut(|s| s.prepare_archive_batch(100));

    // make external call
    // if failed - reapply batch

    INVOICES_STATE.with_borrow_mut(|s| s.reapply_archive_batch(batch));
}
