use std::cell::RefCell;

use ic_cdk::{
    api::time,
    export_candid, init, post_upgrade, pre_upgrade, query,
    storage::{stable_restore, stable_save},
    update,
};
use shared::statistics::{
    state::StatisticsState,
    types::{Data, Statistics, ONE_DAY_NS},
};

#[update]
fn increment_stats(data: Data) {
    STATE.with_borrow_mut(|s| {
        let current_timestamp = time();

        if s.statistics.is_empty() {
            let stats = Statistics {
                data,
                timestamp: current_timestamp,
            };

            s.statistics.push(stats);
            return;
        }

        let last_idx = s.statistics.len() - 1;
        let last_entry = s.statistics.get_mut(last_idx).unwrap();

        if current_timestamp - last_entry.timestamp >= ONE_DAY_NS {
            let stats = Statistics {
                data,
                timestamp: current_timestamp,
            };

            s.statistics.push(stats);
        } else {
            last_entry.data.merge(data);
        }
    });
}

#[query]
fn get_stats() -> Vec<Statistics> {
    STATE.with_borrow(|s| s.statistics.clone())
}

thread_local! {
    static STATE: RefCell<StatisticsState> = RefCell::default();
}

#[init]
fn init_hook() {
    STATE.with(|s| s.replace(StatisticsState::default()));
}

#[pre_upgrade]
fn pre_upgrade_hook() {
    STATE.with(|s| {
        let state = s.replace(StatisticsState::default());

        stable_save((state,)).expect("Unable to save data in stable memory");
    });
}

#[post_upgrade]
fn post_upgrade_hook() {
    STATE.with(|s| {
        let (state,): (StatisticsState,) =
            stable_restore().expect("Unable to restore data from stable memory");

        s.replace(state);
    });
}

export_candid!();
