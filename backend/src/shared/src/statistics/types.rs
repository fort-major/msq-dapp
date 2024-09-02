use candid::CandidType;
use serde::Deserialize;

pub const ONE_DAY_NS: u64 = 1_000_000_000 * 60 * 60 * 24;

#[derive(Clone, CandidType, Deserialize)]
pub struct Data {
    pub login: u32,
    pub transfer: u32,
    pub origin_link: u32,
    pub origin_unlink: u32,
}

impl Data {
    pub fn merge(&mut self, other: Data) {
        self.login += other.login;
        self.transfer += other.transfer;
        self.origin_link += other.origin_link;
        self.origin_unlink += other.origin_unlink;
    }
}

#[derive(Clone, CandidType, Deserialize)]
pub struct Statistics {
    pub timestamp: u64,
    pub data: Data,
}
