/**
 * Insert fake data into CosmosDB database emulator.
 */
import { ContainerResponse } from "@azure/cosmos";
import { Either, left, right } from "fp-ts/lib/Either";
import {
  Profile,
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "io-functions-commons/dist/src/models/profile";
import {
  Service,
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "io-functions-commons/dist/src/models/service";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { cosmosClient } from "../../services/cosmosdb";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const databaseClient = cosmosClient.database(cosmosDbName);

function createDatabase(databaseName: string): Promise<Either<Error, void>> {
  return cosmosClient.databases
    .createIfNotExists({ id: databaseName })
    .then(_ => right<Error, void>(void 0))
    .catch(err => left<Error, void>(new Error(err)));
}

function createCollection(
  collectionName: string,
  partitionKey: string
): Promise<Either<Error, ContainerResponse>> {
  return databaseClient.containers
    .createIfNotExists({
      id: collectionName,
      partitionKey
    })
    .then(_ => right<Error, ContainerResponse>(_))
    .catch(err => left<Error, ContainerResponse>(new Error(err)));
}

const serviceContainer = cosmosClient
  .database(cosmosDbName)
  .container(SERVICE_COLLECTION_NAME);
const serviceModel = new ServiceModel(serviceContainer);

const aService: Service = Service.decode({
  authorizedCIDRs: [],
  authorizedRecipients: [],
  departmentName: "Deparment Name",
  isVisible: true,
  maxAllowedPaymentAmount: 100000,
  organizationFiscalCode: "01234567890",
  organizationName: "Organization name",
  requireSecureChannels: false,
  serviceId: process.env.REQ_SERVICE_ID,
  serviceName: "MyServiceName"
}).getOrElseL(() => {
  throw new Error("Cannot decode service payload.");
});

const profileContainer = cosmosClient
  .database(cosmosDbName)
  .container(PROFILE_COLLECTION_NAME);
const profileModel = new ProfileModel(profileContainer);

const aProfile: Profile = Profile.decode({
  acceptedTosVersion: 1,
  email: "email@example.com",
  fiscalCode: "AAAAAA00A00A000A",
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: true,
  isWebhookEnabled: true
}).getOrElseL(() => {
  throw new Error("Cannot decode profile payload.");
});

createDatabase(cosmosDbName)
  .then(() => createCollection("message-status", "messageId"))
  .then(() => createCollection("messages", "fiscalCode"))
  .then(() => createCollection("notification-status", "notificationId"))
  .then(() => createCollection("notifications", "messageId"))
  .then(() => createCollection("profiles", "fiscalCode"))
  .then(() => createCollection("sender-services", "recipientFiscalCode"))
  .then(() => createCollection("services", "serviceId"))
  .then(() => serviceModel.create({ ...aService, kind: "INewService" }).run())
  // tslint:disable-next-line: no-console
  .then(p => console.log(p.value))
  .then(() => profileModel.create({ ...aProfile, kind: "INewProfile" }).run())
  // tslint:disable-next-line: no-console
  .then(s => console.log(s.value))
  // tslint:disable-next-line: no-console
  .catch(console.error);
