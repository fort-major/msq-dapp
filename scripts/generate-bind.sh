#!/usr/bin/env bash

rm -rf ./frontend/src/declarations && \
dfx generate statistics && \
dfx generate payment_hub && \
dfx generate invoice_history && \
mv ./src/declarations ./frontend/src/declarations && \
rm ./frontend/src/declarations/statistics/statistics.did && \
rm ./frontend/src/declarations/payment_hub/payment_hub.did && \
rm ./frontend/src/declarations/invoice_history/invoice_history.did && \
rm -rf ./src
