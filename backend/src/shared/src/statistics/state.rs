use candid::CandidType;
use serde::Deserialize;

use super::types::Statistics;

#[derive(Default, CandidType, Deserialize)]
pub struct StatisticsState {
    pub statistics: Vec<Statistics>,
}
