#!/usr/bin/env bash

rm -rf ./frontend/src/declarations && \
dfx generate statistics && \
mv ./src/declarations ./frontend/src/declarations && \
rm ./frontend/src/declarations/statistics/statistics.did && \
rm -rf ./src
