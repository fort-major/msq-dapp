use candid::{CandidType, Principal};
use env::{
    CAN_INVOICE_HISTORY_CANISTER_ID, CAN_PAYMENT_HUB_CANISTER_ID, CAN_ROOT_KEY,
    CAN_STATISTICS_CANISTER_ID,
};
use lazy_static::lazy_static;
use serde::Deserialize;

mod env;

lazy_static! {
    pub static ref ENV_VARS: EnvVarsState = EnvVarsState::new();
}

#[derive(CandidType, Deserialize, Clone)]
pub struct EnvVarsState {
    pub statistics_canister_id: Principal,
    pub payment_hub_canister_id: Principal,
    pub invoice_history_canister_id: Principal,
    pub ic_root_key: Vec<u8>,
}

impl EnvVarsState {
    pub fn new() -> Self {
        Self {
            statistics_canister_id: Principal::from_text(CAN_STATISTICS_CANISTER_ID).unwrap(),
            payment_hub_canister_id: Principal::from_text(CAN_PAYMENT_HUB_CANISTER_ID).unwrap(),
            invoice_history_canister_id: Principal::from_text(CAN_INVOICE_HISTORY_CANISTER_ID)
                .unwrap(),

            ic_root_key: CAN_ROOT_KEY
                .trim_start_matches("[")
                .trim_end_matches("]")
                .split(",")
                .map(|chunk| chunk.trim().parse().expect("Unable to parse ic root key"))
                .collect(),
        }
    }
}
