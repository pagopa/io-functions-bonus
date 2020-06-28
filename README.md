# IO Functions bonus

[![codecov](https://codecov.io/gh/pagopa/io-functions-bonus/branch/master/graph/badge.svg)](https://codecov.io/gh/pagopa/io-functions-bonus)

## Develop locally

1. Install dotnet sdk: https://dotnet.microsoft.com/download
1. Modify env.example to include CosmosDB and Azure Storage Account connection strings

```shell
cp env.example .env
yarn install
yarn start

func durable start-new --function-name StartBonusActivationOrchestrator \
  --connection-string-setting BONUS_STORAGE_CONNECTION_STRING --task-hub-name FunctionHub \
  --input @fixtures/input.json

```

## Notable environment variables

See [env.example](./env.example)
