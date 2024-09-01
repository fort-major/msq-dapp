use std::time::Duration as StdDuration;

use chrono::{Datelike, Days, Duration, TimeZone, Utc};
use ic_cdk::{api::time, spawn};
use ic_cdk_timers::{set_timer, set_timer_interval};

use crate::{
    exchange_rates::refresh_exchange_rates,
    invoices::{archive_inactive_invoices, garbage_collect_invoices},
};

// ------------------------ STATE -------------------------

pub fn init_timers() {
    let now = time();
    let now_utc = Utc.timestamp_nanos(now as i64);

    let todays_2am_utc = Utc
        .with_ymd_and_hms(now_utc.year(), now_utc.month(), now_utc.day(), 2, 0, 0)
        .unwrap();

    let next_2am_utc = if now_utc < todays_2am_utc {
        todays_2am_utc
    } else {
        todays_2am_utc + Days::new(1)
    };

    let closest_2am_utc =
        StdDuration::from_nanos((next_2am_utc - now_utc).num_nanoseconds().unwrap() as u64);
    let each_10_minutes = Duration::minutes(10).to_std().unwrap();

    set_timer(closest_2am_utc, handle_exchange_rates_fetch_timer);

    set_timer(closest_2am_utc, handle_archive_inactive_invoices_timer);

    set_timer_interval(each_10_minutes, handle_discard_expired_invoices_interval);
}

fn handle_exchange_rates_fetch_timer() {
    // should be around 2AM UTC
    let now_utc = Utc.timestamp_nanos(time() as i64);

    let tomorrow_2am_utc = Utc
        .with_ymd_and_hms(now_utc.year(), now_utc.month(), now_utc.day(), 2, 0, 0)
        .unwrap()
        + Days::new(1);

    let next_2am_utc =
        StdDuration::from_nanos((tomorrow_2am_utc - now_utc).num_nanoseconds().unwrap() as u64);

    set_timer(next_2am_utc, handle_exchange_rates_fetch_timer);

    spawn(refresh_exchange_rates());
}

fn handle_archive_inactive_invoices_timer() {
    // should be around 2AM UTC
    let now_utc = Utc.timestamp_nanos(time() as i64);

    let tomorrow_2am_utc = Utc
        .with_ymd_and_hms(now_utc.year(), now_utc.month(), now_utc.day(), 2, 0, 0)
        .unwrap()
        + Days::new(1);

    let next_2am_utc =
        StdDuration::from_nanos((tomorrow_2am_utc - now_utc).num_nanoseconds().unwrap() as u64);

    set_timer(next_2am_utc, handle_archive_inactive_invoices_timer);

    spawn(archive_inactive_invoices());
}

fn handle_discard_expired_invoices_interval() {
    garbage_collect_invoices();
}
